import { Sandbox } from '@vercel/sandbox';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

// Get MCP server URL for canvas tools
const MCP_SERVER_URL = process.env.DESIGN_MCP_URL || 'https://agentkanban.vercel.app';

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
 * This creates an isolated VM that can run the full agent loop
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
    // Create Vercel Sandbox
    const sandbox = await Sandbox.create({
      timeoutMs: 300000, // 5 minutes max
    });

    try {
      // Install dependencies in sandbox
      await sandbox.commands.run('npm init -y && npm install @anthropic-ai/claude-agent-sdk', {
        timeoutMs: 120000,
      });

      // Create the agent script
      const agentScript = `
const { query } = require('@anthropic-ai/claude-agent-sdk');

async function runAgent() {
  const prompt = ${JSON.stringify(fullPrompt)};
  const systemPrompt = ${JSON.stringify(config.systemPrompt || 'You are a helpful AI assistant.')};
  const allowedTools = ${JSON.stringify(config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch'])};
  const permissionMode = ${JSON.stringify(config.permissionMode || 'acceptEdits')};
  const maxTurns = ${config.maxTurns || 20};

  const messages = [];
  let result = null;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt,
        allowedTools,
        permissionMode,
        maxTurns,
      },
    })) {
      messages.push({ type: message.type, data: message });
      
      // Output each message as JSON line for streaming
      console.log('__MSG__' + JSON.stringify(message));

      if (message.type === 'result') {
        result = message;
      }
    }
  } catch (error) {
    console.log('__ERR__' + JSON.stringify({ error: error.message || String(error) }));
  }

  console.log('__DONE__' + JSON.stringify({ result, messageCount: messages.length }));
}

runAgent().catch(err => {
  console.log('__ERR__' + JSON.stringify({ error: err.message || String(err) }));
});
`;

      // Write and run the agent script
      await sandbox.files.write('agent.js', agentScript);
      
      // Set API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }

      // Run the agent script and collect output
      const execution = await sandbox.commands.run(`ANTHROPIC_API_KEY="${apiKey}" node agent.js`, {
        timeoutMs: 240000, // 4 minutes for execution
      });

      // Process the output
      const lines = execution.stdout.split('\n');
      let agentResult: AgentResult | null = null;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let numTurns = 0;

      for (const line of lines) {
        if (line.startsWith('__MSG__')) {
          try {
            const message = JSON.parse(line.slice(7));
            const agentMessage = await processSDKMessage(message, sessionId, onMessage);
            
            // Track turns
            if (message.type === 'assistant') {
              numTurns++;
            }
            
            // Track usage from result
            if (message.type === 'result') {
              totalInputTokens = message.usage?.input_tokens || 0;
              totalOutputTokens = message.usage?.output_tokens || 0;
            }
          } catch (e) {
            console.error('Failed to parse message:', line);
          }
        } else if (line.startsWith('__ERR__')) {
          const error = JSON.parse(line.slice(7));
          throw new Error(error.error);
        } else if (line.startsWith('__DONE__')) {
          const done = JSON.parse(line.slice(8));
          if (done.result) {
            agentResult = {
              success: true,
              result: done.result.result || '',
              durationMs: Date.now() - startTime,
              totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
              numTurns,
              usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
              },
            };
          }
        }
      }

      // Handle stderr errors
      if (execution.stderr && !agentResult) {
        throw new Error(execution.stderr);
      }

      if (!agentResult) {
        agentResult = {
          success: false,
          error: 'Agent completed without result',
          durationMs: Date.now() - startTime,
          totalCostUsd: 0,
          numTurns: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }

      await agentStore.setSessionResult(sessionId, agentResult);
      await agentStore.updateSessionStatus(sessionId, agentResult.success ? 'completed' : 'error');
      return agentResult;

    } finally {
      // Always destroy the sandbox
      await sandbox.destroy();
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

/**
 * Process SDK message and convert to AgentMessage
 */
async function processSDKMessage(
  message: Record<string, unknown>,
  sessionId: string,
  onMessage?: MessageCallback
): Promise<AgentMessage | null> {
  const type = message.type as string;

  switch (type) {
    case 'assistant': {
      const content = (message.message as Record<string, unknown>)?.content as Array<{ type: string; text?: string; name?: string; input?: unknown }>;
      let textContent = '';

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            textContent += block.text || '';
          } else if (block.type === 'tool_use') {
            // Add tool use message
            const toolMessage = await agentStore.addMessage(sessionId, {
              type: 'tool_use',
              content: `Using tool: ${block.name}`,
              toolName: block.name,
              toolInput: block.input as Record<string, unknown>,
            });
            onMessage?.(toolMessage);
          }
        }
      }

      if (textContent) {
        const assistantMessage = await agentStore.addMessage(sessionId, {
          type: 'assistant',
          content: textContent,
        });
        onMessage?.(assistantMessage);
        return assistantMessage;
      }
      break;
    }

    case 'user': {
      // Tool results come as user messages
      const content = (message.message as Record<string, unknown>)?.content;
      if (Array.isArray(content)) {
        for (const block of content as Array<{ type: string; content?: unknown; tool_use_id?: string }>) {
          if (block.type === 'tool_result') {
            const toolResultContent = typeof block.content === 'string' 
              ? block.content 
              : JSON.stringify(block.content);

            const toolResultMessage = await agentStore.addMessage(sessionId, {
              type: 'tool_result',
              content: toolResultContent.substring(0, 500) + (toolResultContent.length > 500 ? '...' : ''),
              toolResult: block.content as string,
              parentToolUseId: block.tool_use_id,
            });
            onMessage?.(toolResultMessage);
            return toolResultMessage;
          }
        }
      }
      break;
    }

    case 'system': {
      const systemMessage = await agentStore.addMessage(sessionId, {
        type: 'system',
        content: `System: ${(message as Record<string, unknown>).subtype || 'message'}`,
      });
      onMessage?.(systemMessage);
      return systemMessage;
    }
  }

  return null;
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet pricing (approximate)
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
