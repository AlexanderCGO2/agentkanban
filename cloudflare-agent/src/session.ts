/**
 * Durable Object for agent session state persistence
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type {
  Env,
  SessionState,
  SessionConfig,
  ContentBlock,
  AgentMessage,
  TokenUsage,
  FileReference,
  ToolName,
} from './types';
import { getToolDefinitions, executeToolCall } from './tools';

export class AgentSession {
  private state: DurableObjectState;
  private env: Env;
  private sessionData: SessionState | null = null;
  private anthropic: Anthropic;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Load state on construction
    this.state.blockConcurrencyWhile(async () => {
      this.sessionData = await this.state.storage.get<SessionState>('session') || null;
    });
  }

  /**
   * Initialize a new session
   */
  async initialize(config: Partial<SessionConfig>): Promise<SessionState> {
    const now = new Date().toISOString();
    this.sessionData = {
      id: this.state.id.toString(),
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      messages: [],
      files: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      config: {
        systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
        allowedTools: config.allowedTools || ['web_search', 'read_file', 'write_file', 'list_files'],
        permissionMode: config.permissionMode || 'default',
        maxTurns: config.maxTurns || 10,
      },
    };
    await this.persist();
    return this.sessionData;
  }

  /**
   * Get current session state
   */
  async getState(): Promise<SessionState | null> {
    return this.sessionData;
  }

  /**
   * Run agent (non-streaming, returns full result)
   */
  async run(prompt: string): Promise<{
    success: boolean;
    result?: string;
    messages: AgentMessage[];
    usage: TokenUsage;
    error?: string;
  }> {
    if (!this.sessionData) {
      return {
        success: false,
        messages: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        error: 'Session not initialized',
      };
    }

    this.sessionData.status = 'running';
    this.sessionData.updatedAt = new Date().toISOString();
    await this.persist();

    const outputMessages: AgentMessage[] = [];

    // Add user message
    this.sessionData.messages.push({
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.executeAgentLoop(outputMessages);

      this.sessionData.status = 'completed';
      this.sessionData.updatedAt = new Date().toISOString();
      await this.persist();

      return {
        success: true,
        result,
        messages: outputMessages,
        usage: this.sessionData.usage,
      };
    } catch (error) {
      this.sessionData.status = 'error';
      await this.persist();

      return {
        success: false,
        messages: outputMessages,
        usage: this.sessionData.usage,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stream agent execution (returns ReadableStream for SSE)
   */
  async stream(prompt: string): Promise<ReadableStream<Uint8Array>> {
    if (!this.sessionData) {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', content: 'Session not initialized' })}\n\n`)
          );
          controller.close();
        },
      });
    }

    const encoder = new TextEncoder();
    const session = this.sessionData;
    const anthropic = this.anthropic;
    const env = this.env;
    const persist = this.persist.bind(this);
    const tools = getToolDefinitions(session.config.allowedTools);

    // Add user message
    session.messages.push({
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    });
    session.status = 'running';
    await persist();

    return new ReadableStream({
      async start(controller) {
        const sendEvent = (message: AgentMessage) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        };

        try {
          let iterations = 0;
          let lastResult = '';

          while (iterations < session.config.maxTurns) {
            iterations++;

            // Build messages for API - cast to Anthropic's expected types
            const apiMessages = session.messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content as MessageParam['content'],
            })) as MessageParam[];

            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: session.config.systemPrompt,
              messages: apiMessages,
              tools: tools.length > 0 ? (tools as Anthropic.Tool[]) : undefined,
            });

            // Update usage
            session.usage.inputTokens += response.usage.input_tokens;
            session.usage.outputTokens += response.usage.output_tokens;

            // Process response blocks
            const contentBlocks: ContentBlock[] = [];
            let hasToolUse = false;

            for (const block of response.content) {
              if (block.type === 'text') {
                lastResult = block.text;
                sendEvent({ type: 'assistant', content: block.text });
                contentBlocks.push({ type: 'text', text: block.text });
              } else if (block.type === 'tool_use') {
                hasToolUse = true;
                sendEvent({
                  type: 'tool_use',
                  toolName: block.name,
                  toolInput: block.input,
                  toolUseId: block.id,
                });
                contentBlocks.push({
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input,
                });
              }
            }

            // Add assistant message
            session.messages.push({
              role: 'assistant',
              content: contentBlocks,
              timestamp: new Date().toISOString(),
            });

            // Execute tools if needed
            if (hasToolUse) {
              const toolResults: ContentBlock[] = [];

              for (const block of response.content) {
                if (block.type === 'tool_use') {
                  try {
                    const result = await executeToolCall(
                      block.name as ToolName,
                      block.input as Record<string, unknown>,
                      { sessionId: session.id, env, fileStorage: env.FILE_STORAGE }
                    );

                    sendEvent({
                      type: 'tool_result',
                      toolUseId: block.id,
                      toolName: block.name,
                      toolResult: result,
                      content: result,
                    });

                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: result,
                    });
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    sendEvent({
                      type: 'tool_result',
                      toolUseId: block.id,
                      toolName: block.name,
                      toolResult: `Error: ${errorMsg}`,
                      content: `Error: ${errorMsg}`,
                    });
                    toolResults.push({
                      type: 'tool_result',
                      tool_use_id: block.id,
                      content: `Error: ${errorMsg}`,
                    });
                  }
                }
              }

              // Add tool results as user message
              session.messages.push({
                role: 'user',
                content: toolResults,
                timestamp: new Date().toISOString(),
              });
            }

            // Check if we should stop
            if (response.stop_reason === 'end_turn' && !hasToolUse) {
              break;
            }

            await persist();
          }

          // Send completion
          session.status = 'completed';
          await persist();

          sendEvent({
            type: 'done',
            content: lastResult,
            usage: session.usage,
          });
        } catch (error) {
          session.status = 'error';
          await persist();

          sendEvent({
            type: 'error',
            content: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });
  }

  /**
   * Add a file reference
   */
  async addFile(file: Omit<FileReference, 'createdAt'>): Promise<void> {
    if (!this.sessionData) return;

    this.sessionData.files.push({
      ...file,
      createdAt: new Date().toISOString(),
    });
    await this.persist();
  }

  /**
   * List files in session
   */
  async listFiles(): Promise<FileReference[]> {
    return this.sessionData?.files || [];
  }

  private async persist(): Promise<void> {
    if (this.sessionData) {
      this.sessionData.updatedAt = new Date().toISOString();
      await this.state.storage.put('session', this.sessionData);
    }
  }

  private async executeAgentLoop(outputMessages: AgentMessage[]): Promise<string> {
    let lastResult = '';
    let iterations = 0;
    const tools = getToolDefinitions(this.sessionData!.config.allowedTools);

    while (iterations < this.sessionData!.config.maxTurns) {
      iterations++;

      // Build messages for API - cast to Anthropic's expected types
      const apiMessages = this.sessionData!.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as MessageParam['content'],
      })) as MessageParam[];

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.sessionData!.config.systemPrompt,
        messages: apiMessages,
        tools: tools.length > 0 ? (tools as Anthropic.Tool[]) : undefined,
      });

      this.sessionData!.usage.inputTokens += response.usage.input_tokens;
      this.sessionData!.usage.outputTokens += response.usage.output_tokens;

      const contentBlocks: ContentBlock[] = [];
      let hasToolUse = false;

      for (const block of response.content) {
        if (block.type === 'text') {
          lastResult = block.text;
          outputMessages.push({ type: 'assistant', content: block.text });
          contentBlocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          hasToolUse = true;
          outputMessages.push({
            type: 'tool_use',
            toolName: block.name,
            toolInput: block.input,
            toolUseId: block.id,
          });
          contentBlocks.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      this.sessionData!.messages.push({
        role: 'assistant',
        content: contentBlocks,
        timestamp: new Date().toISOString(),
      });

      if (hasToolUse) {
        const toolResults: ContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await executeToolCall(
                block.name as ToolName,
                block.input as Record<string, unknown>,
                {
                  sessionId: this.sessionData!.id,
                  env: this.env,
                  fileStorage: this.env.FILE_STORAGE,
                }
              );

              outputMessages.push({
                type: 'tool_result',
                toolUseId: block.id,
                toolName: block.name,
                toolResult: result,
                content: result,
              });

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              outputMessages.push({
                type: 'tool_result',
                toolUseId: block.id,
                toolName: block.name,
                toolResult: `Error: ${errorMsg}`,
                content: `Error: ${errorMsg}`,
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${errorMsg}`,
              });
            }
          }
        }

        this.sessionData!.messages.push({
          role: 'user',
          content: toolResults,
          timestamp: new Date().toISOString(),
        });
      }

      if (response.stop_reason === 'end_turn' && !hasToolUse) {
        break;
      }

      await this.persist();
    }

    return lastResult;
  }

  /**
   * Fetch handler for HTTP requests to Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/init':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          const initConfig = (await request.json()) as Partial<SessionConfig>;
          const state = await this.initialize(initConfig);
          return Response.json(state);

        case '/state':
          const currentState = await this.getState();
          return Response.json(currentState || { error: 'Not initialized' });

        case '/run':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          const runBody = (await request.json()) as { prompt: string };
          const result = await this.run(runBody.prompt);
          return Response.json(result);

        case '/stream':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          const streamBody = (await request.json()) as { prompt: string };
          const stream = await this.stream(streamBody.prompt);
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });

        case '/files':
          const files = await this.listFiles();
          return Response.json(files);

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Durable Object error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      );
    }
  }
}
