import { Sandbox } from '@vercel/sandbox';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

/**
 * Constructs the full prompt by combining the agent's base task description
 * with the user's specific request.
 */
function buildFullPrompt(config: AgentConfig, userPrompt: string): string {
  if (config.prompt && config.prompt.trim()) {
    return `## Agent Task
${config.prompt}

## User Request
${userPrompt}

## Instructions
Complete the user request following your agent task guidelines.`;
  }
  
  return userPrompt;
}

/**
 * Run agent using Vercel Sandbox with Claude Agent SDK
 * This creates an isolated VM that can run the full agent loop with all tools
 */
export async function runAgent(
  config: AgentConfig,
  sessionId: string,
  prompt: string,
  onMessage?: MessageCallback
): Promise<AgentResult> {
  await agentStore.updateSessionStatus(sessionId, 'running');

  const fullPrompt = buildFullPrompt(config, prompt);

  // Add user message
  const userMessage = await agentStore.addMessage(sessionId, {
    type: 'user',
    content: prompt,
  });
  onMessage?.(userMessage);

  const startTime = Date.now();

  try {
    // Create Vercel Sandbox with Node 22 runtime
    const sandbox = await Sandbox.create({
      runtime: 'node22',
      timeout: 300000, // 5 minutes
      resources: { vcpus: 2 },
    });

    try {
      // 1) Install Claude Code CLI globally
      await sandbox.runCommand({
        cmd: 'npm',
        args: ['install', '-g', '@anthropic-ai/claude-code'],
        sudo: true,
      });

      // 2) Initialize npm and install Agent SDK in working directory
      await sandbox.runCommand({
        cmd: 'npm',
        args: ['init', '-y'],
      });

      await sandbox.runCommand({
        cmd: 'npm',
        args: ['install', '@anthropic-ai/claude-agent-sdk'],
      });

      // 3) Create the agent script
      const agentScript = `
import { query } from "@anthropic-ai/claude-agent-sdk";

const prompt = ${JSON.stringify(fullPrompt)};
const systemPrompt = ${JSON.stringify(config.systemPrompt || 'You are a helpful AI assistant.')};
const allowedTools = ${JSON.stringify(config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep'])};
const permissionMode = ${JSON.stringify(config.permissionMode || 'acceptEdits')};
const maxTurns = ${config.maxTurns || 20};

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
      // Output structured messages for parsing
      console.log('__MSG__' + JSON.stringify({
        type: msg.type,
        text: msg.type === 'assistant' ? (msg.message?.content || []).filter(b => b.type === 'text').map(b => b.text).join('') : undefined,
        toolUse: msg.type === 'assistant' ? (msg.message?.content || []).filter(b => b.type === 'tool_use') : undefined,
        toolResult: msg.type === 'user' ? (msg.message?.content || []).filter(b => b.type === 'tool_result') : undefined,
        result: msg.type === 'result' ? msg : undefined,
        subtype: msg.subtype,
      }));
    }
    console.log('__DONE__');
  } catch (error) {
    console.log('__ERR__' + (error.message || String(error)));
  }
}

run();
`;

      // Write the agent script to sandbox
      await sandbox.writeFiles([
        { path: '/vercel/sandbox/agent.mjs', content: Buffer.from(agentScript) },
      ]);

      // 4) Run the agent script with API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }

      const run = await sandbox.runCommand({
        cmd: 'node',
        args: ['agent.mjs'],
        env: {
          ANTHROPIC_API_KEY: apiKey,
        },
      });

      // Get stdout and stderr from the command
      const stdout = await run.stdout();
      const stderr = await run.stderr();

      // Process the output
      const lines = (stdout || '').split('\n');
      let numTurns = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalResult = '';

      for (const line of lines) {
        if (line.startsWith('__MSG__')) {
          try {
            const msg = JSON.parse(line.slice(7));
            
            // Process assistant text
            if (msg.type === 'assistant' && msg.text) {
              numTurns++;
              finalResult = msg.text;
              const assistantMessage = await agentStore.addMessage(sessionId, {
                type: 'assistant',
                content: msg.text,
              });
              onMessage?.(assistantMessage);
            }

            // Process tool use
            if (msg.toolUse && Array.isArray(msg.toolUse)) {
              for (const tool of msg.toolUse) {
                const toolMessage = await agentStore.addMessage(sessionId, {
                  type: 'tool_use',
                  content: `Using tool: ${tool.name}`,
                  toolName: tool.name,
                  toolInput: tool.input,
                });
                onMessage?.(toolMessage);
              }
            }

            // Process tool results
            if (msg.toolResult && Array.isArray(msg.toolResult)) {
              for (const result of msg.toolResult) {
                const content = typeof result.content === 'string' 
                  ? result.content 
                  : JSON.stringify(result.content);
                const toolResultMessage = await agentStore.addMessage(sessionId, {
                  type: 'tool_result',
                  content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
                  toolResult: result.content,
                  parentToolUseId: result.tool_use_id,
                });
                onMessage?.(toolResultMessage);
              }
            }

            // Process final result
            if (msg.result) {
              totalInputTokens = msg.result.usage?.input_tokens || 0;
              totalOutputTokens = msg.result.usage?.output_tokens || 0;
              finalResult = msg.result.result || finalResult;
            }

            // Process system messages
            if (msg.type === 'system') {
              const systemMessage = await agentStore.addMessage(sessionId, {
                type: 'system',
                content: `System: ${msg.subtype || 'message'}`,
              });
              onMessage?.(systemMessage);
            }

          } catch (e) {
            console.error('Failed to parse message:', line, e);
          }
        } else if (line.startsWith('__ERR__')) {
          throw new Error(line.slice(7));
        }
      }

      // Handle stderr errors
      if (stderr && run.exitCode !== 0) {
        console.error('Sandbox stderr:', stderr);
      }

      const result: AgentResult = {
        success: run.exitCode === 0,
        result: finalResult,
        error: run.exitCode !== 0 ? (stderr || 'Unknown error') : undefined,
        durationMs: Date.now() - startTime,
        totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
        numTurns,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };

      await agentStore.setSessionResult(sessionId, result);
      await agentStore.updateSessionStatus(sessionId, result.success ? 'completed' : 'error');
      return result;

    } finally {
      // Always stop the sandbox
      await sandbox.stop();
    }

  } catch (error) {
    const errorResult: AgentResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      totalCostUsd: 0,
      numTurns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    await agentStore.setSessionResult(sessionId, errorResult);
    await agentStore.updateSessionStatus(sessionId, 'error');
    return errorResult;
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet pricing (approximate)
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
