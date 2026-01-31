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
import { getToolDefinitions, executeToolCall, hasWebSearchTool } from './tools';

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
      this.sessionData = (await this.state.storage.get<SessionState>('session')) || null;
    });
  }

  /**
   * Initialize a new session
   * @param config - Session configuration
   * @param originalSessionId - The original session ID used to create this DO (for consistent R2 paths)
   */
  async initialize(config: Partial<SessionConfig>, originalSessionId?: string): Promise<SessionState> {
    const now = new Date().toISOString();
    // Use the original sessionId if provided, otherwise fall back to DO's internal ID
    // This ensures R2 file paths match the URLs used by the frontend
    const sessionId = originalSessionId || this.state.id.toString();
    this.sessionData = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      messages: [],
      files: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      config: {
        systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
        allowedTools:
          config.allowedTools || (['web_search', 'read_file', 'write_file', 'list_files'] as ToolName[]),
        permissionMode: config.permissionMode || 'default',
        maxTurns: config.maxTurns || 10,
        model: config.model,
        temperature: config.temperature,
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
    const customTools = getToolDefinitions(session.config.allowedTools);
    const useWebSearch = hasWebSearchTool(session.config.allowedTools);
    const model = session.config.model || 'claude-sonnet-4-20250514';

    // Build combined tools array: custom tools + server tools (web_search)
    const allTools: Anthropic.Tool[] = [
      ...(customTools as Anthropic.Tool[]),
      // Add Anthropic's built-in server-side web search if enabled
      ...(useWebSearch ? [{
        type: 'web_search_20250305' as const,
        name: 'web_search',
        max_uses: 10,
      }] : []),
    ];

    // Add user message
    session.messages.push({
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    });
    session.status = 'running';
    await persist();

    // Get sandbox DO for tool execution if available
    let sandboxDO: DurableObjectStub | undefined;
    if (env.SANDBOX_DO) {
      const sandboxId = env.SANDBOX_DO.idFromName(session.id);
      sandboxDO = env.SANDBOX_DO.get(sandboxId);
    }

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

            // Build messages for API
            const apiMessages = session.messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content as MessageParam['content'],
            })) as MessageParam[];

            const response = await anthropic.messages.create({
              model,
              max_tokens: 4096,
              system: session.config.systemPrompt,
              messages: apiMessages,
              tools: allTools.length > 0 ? allTools : undefined,
              temperature: session.config.temperature,
            });

            // Update usage
            session.usage.inputTokens += response.usage.input_tokens;
            session.usage.outputTokens += response.usage.output_tokens;

            // Process response blocks
            const contentBlocks: ContentBlock[] = [];
            let hasToolUse = false;
            let hasServerToolUse = false;

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
              } else if (block.type === 'server_tool_use') {
                // Server tool (web_search) - executed by Anthropic's servers
                hasServerToolUse = true;
                const serverBlock = block as { type: 'server_tool_use'; id: string; name: string; input: unknown };
                sendEvent({
                  type: 'tool_use',
                  toolName: serverBlock.name,
                  toolInput: serverBlock.input,
                  toolUseId: serverBlock.id,
                });
                contentBlocks.push({
                  type: 'server_tool_use',
                  id: serverBlock.id,
                  name: serverBlock.name,
                  input: serverBlock.input,
                } as ContentBlock);
              } else if (block.type === 'web_search_tool_result') {
                // Server tool result - already executed, just display
                const resultBlock = block as { type: 'web_search_tool_result'; tool_use_id: string; content: unknown };
                const resultContent = typeof resultBlock.content === 'string'
                  ? resultBlock.content
                  : JSON.stringify(resultBlock.content, null, 2);
                sendEvent({
                  type: 'tool_result',
                  toolUseId: resultBlock.tool_use_id,
                  toolName: 'web_search',
                  toolResult: resultContent,
                  content: resultContent,
                });
                contentBlocks.push({
                  type: 'web_search_tool_result',
                  tool_use_id: resultBlock.tool_use_id,
                  content: resultBlock.content,
                } as ContentBlock);
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
                      {
                        sessionId: session.id,
                        env,
                        fileStorage: env.FILE_STORAGE,
                        sandboxDO,
                      }
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

          console.log('Sending done event with usage:', JSON.stringify(session.usage));

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
    const customTools = getToolDefinitions(this.sessionData!.config.allowedTools);
    const useWebSearch = hasWebSearchTool(this.sessionData!.config.allowedTools);
    const model = this.sessionData!.config.model || 'claude-sonnet-4-20250514';

    // Build combined tools array
    const allTools: Anthropic.Tool[] = [
      ...(customTools as Anthropic.Tool[]),
      ...(useWebSearch ? [{
        type: 'web_search_20250305' as const,
        name: 'web_search',
        max_uses: 10,
      }] : []),
    ];

    // Get sandbox DO for tool execution if available
    let sandboxDO: DurableObjectStub | undefined;
    if (this.env.SANDBOX_DO) {
      const sandboxId = this.env.SANDBOX_DO.idFromName(this.sessionData!.id);
      sandboxDO = this.env.SANDBOX_DO.get(sandboxId);
    }

    while (iterations < this.sessionData!.config.maxTurns) {
      iterations++;

      // Build messages for API
      const apiMessages = this.sessionData!.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as MessageParam['content'],
      })) as MessageParam[];

      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: this.sessionData!.config.systemPrompt,
        messages: apiMessages,
        tools: allTools.length > 0 ? allTools : undefined,
        temperature: this.sessionData!.config.temperature,
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
        } else if (block.type === 'server_tool_use') {
          // Server tool (web_search) - executed by Anthropic's servers
          const serverBlock = block as { type: 'server_tool_use'; id: string; name: string; input: unknown };
          outputMessages.push({
            type: 'tool_use',
            toolName: serverBlock.name,
            toolInput: serverBlock.input,
            toolUseId: serverBlock.id,
          });
          contentBlocks.push({
            type: 'server_tool_use',
            id: serverBlock.id,
            name: serverBlock.name,
            input: serverBlock.input,
          } as ContentBlock);
        } else if (block.type === 'web_search_tool_result') {
          // Server tool result
          const resultBlock = block as { type: 'web_search_tool_result'; tool_use_id: string; content: unknown };
          const resultContent = typeof resultBlock.content === 'string'
            ? resultBlock.content
            : JSON.stringify(resultBlock.content, null, 2);
          outputMessages.push({
            type: 'tool_result',
            toolUseId: resultBlock.tool_use_id,
            toolName: 'web_search',
            toolResult: resultContent,
            content: resultContent,
          });
          contentBlocks.push({
            type: 'web_search_tool_result',
            tool_use_id: resultBlock.tool_use_id,
            content: resultBlock.content,
          } as ContentBlock);
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
                  sandboxDO,
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
          const initBody = (await request.json()) as Partial<SessionConfig> & { sessionId?: string };
          const { sessionId: initSessionId, ...initConfig } = initBody;
          const state = await this.initialize(initConfig, initSessionId);
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
