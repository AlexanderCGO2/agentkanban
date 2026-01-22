/**
 * Cloudflare Agent Worker
 * 
 * Runs Claude Agent SDK in Cloudflare Sandbox - fast, no cold-start issues!
 * Called from Vercel frontend API routes.
 * 
 * Based on: https://developers.cloudflare.com/sandbox/tutorials/claude-code/
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
  // Sandbox binding - defined in wrangler.toml
  SANDBOX: {
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
        hasSandbox: !!env.SANDBOX 
      }), {
        headers: { 'Content-Type': 'application/json' },
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
    const { prompt, systemPrompt, allowedTools, permissionMode, maxTurns } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create sandbox instance
    const sandbox = await env.SANDBOX.create();

    try {
      // Create agent script
      const agentScript = buildAgentScript({
        prompt,
        systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
        allowedTools: allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep'],
        permissionMode: permissionMode || 'acceptEdits',
        maxTurns: maxTurns || 20,
      });

      // Write script to sandbox
      await sandbox.writeFile('/home/user/agent.mjs', agentScript);

      // Run the agent - Claude Code is pre-installed in the sandbox template!
      const result = await sandbox.exec('node', ['agent.mjs'], {
        cwd: '/home/user',
        env: {
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        },
        timeout: 300000, // 5 minutes
      });

      // Parse output
      const messages: AgentMessage[] = [];
      const lines = (result.stdout || '').split('\n');
      let finalResult = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for (const line of lines) {
        if (line.startsWith('__MSG__')) {
          try {
            const msg = JSON.parse(line.slice(7));
            messages.push(processMessage(msg));

            if (msg.type === 'assistant' && msg.text) {
              finalResult = msg.text;
            }
            if (msg.result) {
              totalInputTokens = msg.result.usage?.input_tokens || 0;
              totalOutputTokens = msg.result.usage?.output_tokens || 0;
              if (msg.result.result) finalResult = msg.result.result;
            }
          } catch {
            // Skip malformed lines
          }
        } else if (line.startsWith('__ERR__')) {
          messages.push({ type: 'error', content: line.slice(7) });
        }
      }

      return new Response(JSON.stringify({
        success: result.exitCode === 0,
        result: finalResult,
        messages,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        error: result.exitCode !== 0 ? result.stderr : undefined,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } finally {
      await sandbox.destroy();
    }

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
  const { prompt, systemPrompt, allowedTools, permissionMode, maxTurns } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start processing in background
  (async () => {
    let sandbox: Sandbox | null = null;
    try {
      // Create sandbox
      sandbox = await env.SANDBOX.create();

      const agentScript = buildAgentScript({
        prompt,
        systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
        allowedTools: allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep'],
        permissionMode: permissionMode || 'acceptEdits',
        maxTurns: maxTurns || 20,
      });

      await sandbox.writeFile('/home/user/agent.mjs', agentScript);

      // Stream output line by line
      const process = sandbox.spawn('node', ['agent.mjs'], {
        cwd: '/home/user',
        env: {
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        },
      });

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let buffer = '';

      // Read stdout
      for await (const chunk of process.stdout) {
        buffer += new TextDecoder().decode(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('__MSG__')) {
            try {
              const msg = JSON.parse(line.slice(7));
              const processed = processMessage(msg);

              if (msg.result) {
                totalInputTokens = msg.result.usage?.input_tokens || 0;
                totalOutputTokens = msg.result.usage?.output_tokens || 0;
              }

              await writer.write(encoder.encode(`data: ${JSON.stringify(processed)}\n\n`));
            } catch {
              // Skip malformed
            }
          } else if (line.startsWith('__ERR__')) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: line.slice(7) })}\n\n`));
          } else if (line.startsWith('__DONE__')) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens } })}\n\n`));
          }
        }
      }

      await process.wait();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`));
    } finally {
      if (sandbox) {
        await sandbox.destroy();
      }
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

function processMessage(msg: Record<string, unknown>): AgentMessage {
  if (msg.type === 'assistant' && msg.text) {
    return { type: 'assistant', content: msg.text as string };
  }

  if (msg.toolUse && Array.isArray(msg.toolUse) && msg.toolUse.length > 0) {
    const tool = msg.toolUse[0];
    return {
      type: 'tool_use',
      toolName: tool.name,
      toolInput: tool.input,
      content: `Using tool: ${tool.name}`,
    };
  }

  if (msg.toolResult && Array.isArray(msg.toolResult) && msg.toolResult.length > 0) {
    const result = msg.toolResult[0];
    return {
      type: 'tool_result',
      toolResult: result.content,
      content: typeof result.content === 'string'
        ? result.content.substring(0, 500)
        : JSON.stringify(result.content).substring(0, 500),
    };
  }

  if (msg.type === 'system') {
    return { type: 'system', content: `System: ${msg.subtype || 'message'}` };
  }

  if (msg.result) {
    return {
      type: 'done',
      content: (msg.result as Record<string, unknown>).result as string,
      usage: {
        inputTokens: ((msg.result as Record<string, unknown>).usage as Record<string, number>)?.input_tokens || 0,
        outputTokens: ((msg.result as Record<string, unknown>).usage as Record<string, number>)?.output_tokens || 0,
      },
    };
  }

  return { type: 'system', content: JSON.stringify(msg) };
}

function buildAgentScript(config: {
  prompt: string;
  systemPrompt: string;
  allowedTools: string[];
  permissionMode: string;
  maxTurns: number;
}): string {
  // Note: In the Cloudflare Sandbox, Claude Code is pre-installed
  // The agent-sdk uses it to execute tools
  return `
import { query } from "@anthropic-ai/claude-agent-sdk";

const prompt = ${JSON.stringify(config.prompt)};
const systemPrompt = ${JSON.stringify(config.systemPrompt)};
const allowedTools = ${JSON.stringify(config.allowedTools)};
const permissionMode = ${JSON.stringify(config.permissionMode)};
const maxTurns = ${config.maxTurns};

async function run() {
  try {
    const it = query({
      prompt,
      options: {
        systemPrompt,
        allowedTools,
        permissionMode,
        maxTurns,
      },
    });

    for await (const msg of it) {
      const output = {
        type: msg.type,
        subtype: msg.subtype,
      };

      if (msg.type === "assistant" && msg.message && msg.message.content) {
        const textBlocks = msg.message.content.filter(b => b.type === "text");
        const toolBlocks = msg.message.content.filter(b => b.type === "tool_use");
        output.text = textBlocks.map(b => b.text).join("");
        output.toolUse = toolBlocks;
      }

      if (msg.type === "user" && msg.message && msg.message.content) {
        const toolResults = msg.message.content.filter(b => b.type === "tool_result");
        output.toolResult = toolResults;
      }

      if (msg.type === "result") {
        output.result = msg;
      }

      console.log("__MSG__" + JSON.stringify(output));
    }
    console.log("__DONE__");
  } catch (error) {
    console.log("__ERR__" + (error.message || String(error)));
  }
}

run();
`;
}
