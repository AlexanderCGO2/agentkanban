/**
 * Cloudflare Agent Worker
 * 
 * Runs Claude Agent SDK in Cloudflare Sandbox when available,
 * or falls back to direct Anthropic API.
 */

import Anthropic from '@anthropic-ai/sdk';

interface Env {
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
  // Sandbox binding - may not be available on all accounts
  SANDBOX?: {
    create(): Promise<Sandbox>;
  };
}

interface Sandbox {
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>;
  spawn(command: string, args?: string[], options?: ExecOptions): SpawnProcess;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  destroy(): Promise<void>;
}

interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface SpawnProcess {
  stdout: AsyncIterable<Uint8Array>;
  stderr: AsyncIterable<Uint8Array>;
  wait(): Promise<{ exitCode: number }>;
}

interface AgentRequest {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  sessionId?: string;
}

interface AgentMessage {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        env: env.ENVIRONMENT,
        hasSandbox: !!env.SANDBOX,
        mode: env.SANDBOX ? 'sandbox' : 'direct-api'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Run agent endpoint
    if (url.pathname === '/run' && request.method === 'POST') {
      return handleRunAgent(request, env);
    }

    // Stream agent endpoint (Server-Sent Events)
    if (url.pathname === '/stream' && request.method === 'POST') {
      return handleStreamAgent(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleRunAgent(request: Request, env: Env): Promise<Response> {
  try {
    const body: AgentRequest = await request.json();
    const { prompt, systemPrompt, maxTurns } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Use direct Anthropic API (Sandbox requires paid plan + enablement)
    const result = await runAgentDirect(env, {
      prompt,
      systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
      maxTurns: maxTurns || 10,
    });

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Agent error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function handleStreamAgent(request: Request, env: Env): Promise<Response> {
  const body: AgentRequest = await request.json();
  const { prompt, systemPrompt, maxTurns } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process in background
  (async () => {
    try {
      const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: any[] = [{ role: 'user', content: prompt }];

      const maxIterations = maxTurns || 10;

      for (let i = 0; i < maxIterations; i++) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt || 'You are a helpful AI assistant.',
          messages,
        });

        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;

        // Process response
        for (const block of response.content) {
          if (block.type === 'text') {
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              type: 'assistant',
              content: block.text,
            })}\n\n`));
          }
        }

        // Add to history
        messages.push({ role: 'assistant', content: response.content });

        // Check if done
        if (response.stop_reason === 'end_turn') {
          break;
        }
      }

      // Send done message
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        type: 'done',
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      })}\n\n`));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function runAgentDirect(
  env: Env,
  config: { prompt: string; systemPrompt: string; maxTurns: number }
): Promise<{
  success: boolean;
  result?: string;
  messages: AgentMessage[];
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}> {
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  const messages: AgentMessage[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalResult = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversationHistory: any[] = [{ role: 'user', content: config.prompt }];

  for (let i = 0; i < config.maxTurns; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: config.systemPrompt,
      messages: conversationHistory,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process response
    for (const block of response.content) {
      if (block.type === 'text') {
        finalResult = block.text;
        messages.push({ type: 'assistant', content: block.text });
      }
    }

    // Add to history
    conversationHistory.push({ role: 'assistant', content: response.content });

    // Check if done
    if (response.stop_reason === 'end_turn') {
      break;
    }
  }

  return {
    success: true,
    result: finalResult,
    messages,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };
}
