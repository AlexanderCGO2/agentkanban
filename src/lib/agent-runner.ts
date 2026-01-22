/**
 * Agent Runner - Uses Vercel Sandbox with Golden Snapshots
 * 
 * The snapshot has Claude Code + Agent SDK pre-installed, so agent runs
 * skip the expensive dependency installation.
 */

import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';
import { ensureGoldenSnapshot, createSandboxFromSnapshot, getSnapshotId } from './sandbox-snapshot';

export type MessageCallback = (message: AgentMessage) => void;

/**
 * Build full prompt with agent context
 */
function buildFullPrompt(config: AgentConfig, userPrompt: string): string {
  return `## Your Task
${config.prompt || 'Help the user with their request.'}

## User Request
${userPrompt}

## Instructions
Complete the user request following your agent task guidelines.`;
}

/**
 * Run agent using Vercel Sandbox with pre-built snapshot
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
    // Get or create golden snapshot
    let snapshotId = await getSnapshotId();
    
    if (!snapshotId) {
      // No snapshot exists - create one (this will be slow first time)
      console.log('No snapshot found, creating golden snapshot...');
      snapshotId = await ensureGoldenSnapshot();
    }

    console.log('Creating sandbox from snapshot: ' + snapshotId);
    
    // Create sandbox from snapshot - FAST because deps are pre-installed
    const sandbox = await createSandboxFromSnapshot(snapshotId);

    try {
      // Create the agent script - use regular string concatenation to avoid template issues
      const agentScript = [
        'import { query } from "@anthropic-ai/claude-agent-sdk";',
        '',
        'const prompt = ' + JSON.stringify(fullPrompt) + ';',
        'const systemPrompt = ' + JSON.stringify(config.systemPrompt || 'You are a helpful AI assistant.') + ';',
        'const allowedTools = ' + JSON.stringify(config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep']) + ';',
        'const permissionMode = ' + JSON.stringify(config.permissionMode || 'acceptEdits') + ';',
        'const maxTurns = ' + (config.maxTurns || 20) + ';',
        '',
        'async function run() {',
        '  try {',
        '    const it = query({',
        '      prompt,',
        '      options: {',
        '        systemPrompt,',
        '        allowedTools,',
        '        permissionMode,',
        '        maxTurns,',
        '      },',
        '    });',
        '',
        '    for await (const msg of it) {',
        '      const output = {',
        '        type: msg.type,',
        '        subtype: msg.subtype,',
        '      };',
        '',
        '      if (msg.type === "assistant" && msg.message && msg.message.content) {',
        '        const textBlocks = msg.message.content.filter(b => b.type === "text");',
        '        const toolBlocks = msg.message.content.filter(b => b.type === "tool_use");',
        '        output.text = textBlocks.map(b => b.text).join("");',
        '        output.toolUse = toolBlocks;',
        '      }',
        '',
        '      if (msg.type === "user" && msg.message && msg.message.content) {',
        '        const toolResults = msg.message.content.filter(b => b.type === "tool_result");',
        '        output.toolResult = toolResults;',
        '      }',
        '',
        '      if (msg.type === "result") {',
        '        output.result = msg;',
        '      }',
        '',
        '      console.log("__MSG__" + JSON.stringify(output));',
        '    }',
        '    console.log("__DONE__");',
        '  } catch (error) {',
        '    console.log("__ERR__" + (error.message || String(error)));',
        '  }',
        '}',
        '',
        'run();',
      ].join('\n');

      // Write agent script to sandbox (deps already installed in snapshot!)
      await sandbox.writeFiles([
        { path: '/vercel/sandbox/agent/run.mjs', content: Buffer.from(agentScript) },
      ]);

      // Get API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }

      // Run the agent - this is fast now!
      console.log('Running agent script...');
      const run = await sandbox.runCommand({
        cmd: 'node',
        args: ['run.mjs'],
        cwd: '/vercel/sandbox/agent',
        env: {
          ANTHROPIC_API_KEY: apiKey,
        },
      });

      // Get output
      const stdout = await run.stdout();
      const stderr = await run.stderr();

      // Process output
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
              const assistantMsg = await agentStore.addMessage(sessionId, {
                type: 'assistant',
                content: msg.text,
              });
              onMessage?.(assistantMsg);
            }

            // Process tool use
            if (msg.toolUse && Array.isArray(msg.toolUse)) {
              for (const tool of msg.toolUse) {
                const toolMsg = await agentStore.addMessage(sessionId, {
                  type: 'tool_use',
                  content: 'Using tool: ' + tool.name,
                  toolName: tool.name,
                  toolInput: tool.input,
                });
                onMessage?.(toolMsg);
              }
            }

            // Process tool results
            if (msg.toolResult && Array.isArray(msg.toolResult)) {
              for (const result of msg.toolResult) {
                const content = typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content);
                const toolResultMsg = await agentStore.addMessage(sessionId, {
                  type: 'tool_result',
                  content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
                  toolResult: result.content,
                  parentToolUseId: result.tool_use_id,
                });
                onMessage?.(toolResultMsg);
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
              const systemMsg = await agentStore.addMessage(sessionId, {
                type: 'system',
                content: 'System: ' + (msg.subtype || 'message'),
              });
              onMessage?.(systemMsg);
            }
          } catch (e) {
            console.error('Failed to parse message:', line, e);
          }
        } else if (line.startsWith('__ERR__')) {
          throw new Error(line.slice(7));
        }
      }

      // Handle stderr
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
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      };

      await agentStore.setSessionResult(sessionId, result);
      await agentStore.updateSessionStatus(sessionId, result.success ? 'completed' : 'error');
      return result;

    } finally {
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
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
