/**
 * Agent Runner - Uses Cloudflare Sandbox for fast, reliable execution
 * 
 * The Cloudflare Worker handles sandbox creation and Claude Agent SDK execution.
 * This eliminates cold-start and timeout issues we had with Vercel Sandbox.
 */

import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

// Cloudflare Worker URL - set via environment variable
const CLOUDFLARE_AGENT_URL = process.env.CLOUDFLARE_AGENT_URL || 'https://agentkanban-worker.your-subdomain.workers.dev';

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
 * Run agent using Cloudflare Sandbox (streaming)
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
    // Check if we should use Cloudflare or fallback
    const useCloudflare = process.env.CLOUDFLARE_AGENT_URL && process.env.CLOUDFLARE_AGENT_URL.length > 0;

    if (useCloudflare) {
      return await runAgentCloudflare(config, sessionId, fullPrompt, startTime, onMessage);
    } else {
      // Fallback to direct Anthropic API (simpler, works everywhere)
      return await runAgentDirect(config, sessionId, fullPrompt, startTime, onMessage);
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
 * Run agent via Cloudflare Worker (streaming)
 */
async function runAgentCloudflare(
  config: AgentConfig,
  sessionId: string,
  fullPrompt: string,
  startTime: number,
  onMessage?: MessageCallback
): Promise<AgentResult> {
  console.log('Running agent via Cloudflare Worker...');

  const response = await fetch(`${CLOUDFLARE_AGENT_URL}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
      allowedTools: config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep'],
      permissionMode: config.permissionMode || 'acceptEdits',
      maxTurns: config.maxTurns || 20,
      sessionId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Worker error: ${response.status} - ${errorText}`);
  }

  // Read SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let numTurns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalResult = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'assistant' && data.content) {
              numTurns++;
              finalResult = data.content;
              const assistantMsg = await agentStore.addMessage(sessionId, {
                type: 'assistant',
                content: data.content,
              });
              onMessage?.(assistantMsg);
            }

            if (data.type === 'tool_use') {
              const toolMsg = await agentStore.addMessage(sessionId, {
                type: 'tool_use',
                content: data.content || `Using tool: ${data.toolName}`,
                toolName: data.toolName,
                toolInput: data.toolInput,
              });
              onMessage?.(toolMsg);
            }

            if (data.type === 'tool_result') {
              const toolResultMsg = await agentStore.addMessage(sessionId, {
                type: 'tool_result',
                content: data.content,
                toolResult: data.toolResult,
              });
              onMessage?.(toolResultMsg);
            }

            if (data.type === 'system') {
              const systemMsg = await agentStore.addMessage(sessionId, {
                type: 'system',
                content: data.content,
              });
              onMessage?.(systemMsg);
            }

            if (data.type === 'error') {
              throw new Error(data.content);
            }

            if (data.type === 'done') {
              if (data.content) finalResult = data.content;
              if (data.usage) {
                totalInputTokens = data.usage.inputTokens || 0;
                totalOutputTokens = data.usage.outputTokens || 0;
              }
            }

          } catch (parseError) {
            console.error('Failed to parse SSE message:', line, parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const result: AgentResult = {
    success: true,
    result: finalResult,
    durationMs: Date.now() - startTime,
    totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
    numTurns,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };

  await agentStore.setSessionResult(sessionId, result);
  await agentStore.updateSessionStatus(sessionId, 'completed');
  return result;
}

/**
 * Run agent using direct Anthropic API (fallback, simpler)
 */
async function runAgentDirect(
  config: AgentConfig,
  sessionId: string,
  fullPrompt: string,
  startTime: number,
  onMessage?: MessageCallback
): Promise<AgentResult> {
  console.log('Running agent via direct Anthropic API...');

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic();

  // Check if this agent has MCP tools enabled
  const hasMcpTools = config.allowedTools?.includes('MCP') || 
                      config.allowedTools?.some(t => t.startsWith('canvas_') || t.startsWith('mindmap_'));

  // Define MCP tools if enabled
  const mcpTools = hasMcpTools ? [
    {
      name: 'mindmap_create',
      description: 'Create a mind map from a list of topics. Returns a canvas ID.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Name for the mind map' },
          centralTopic: { type: 'string', description: 'The central topic of the mind map' },
          branches: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of branches from the central topic',
          },
        },
        required: ['name', 'centralTopic', 'branches'],
      },
    },
    {
      name: 'canvas_add_node',
      description: 'Add a node to an existing canvas',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
          text: { type: 'string', description: 'Text content for the node' },
          x: { type: 'number', description: 'X position' },
          y: { type: 'number', description: 'Y position' },
          parentId: { type: 'string', description: 'Optional parent node ID for connections' },
        },
        required: ['canvasId', 'text'],
      },
    },
    {
      name: 'canvas_get',
      description: 'Get details of a canvas including all nodes',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
        },
        required: ['canvasId'],
      },
    },
  ] : [];

  let numTurns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalResult = '';
  // Use 'any' to avoid complex Anthropic SDK type issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'user', content: fullPrompt }
  ];

  // Tool loop
  const maxIterations = config.maxTurns || 10;
  
  for (let i = 0; i < maxIterations; i++) {
    numTurns++;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await anthropic.messages.create({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: config.systemPrompt || 'You are a helpful AI assistant.',
      messages,
      ...(mcpTools.length > 0 ? { tools: mcpTools } : {}),
    });

    totalInputTokens += response.usage?.input_tokens || 0;
    totalOutputTokens += response.usage?.output_tokens || 0;

    // Process response content
    let hasToolUse = false;
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const block of response.content || []) {
      if (block.type === 'text') {
        finalResult = block.text;
        const assistantMsg = await agentStore.addMessage(sessionId, {
          type: 'assistant',
          content: block.text,
        });
        onMessage?.(assistantMsg);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        
        const toolMsg = await agentStore.addMessage(sessionId, {
          type: 'tool_use',
          content: `Using tool: ${block.name}`,
          toolName: block.name,
          toolInput: block.input,
        });
        onMessage?.(toolMsg);

        // Execute MCP tool
        const toolResult = await callMcpTool(block.name, block.input as Record<string, unknown>);
        
        const toolResultMsg = await agentStore.addMessage(sessionId, {
          type: 'tool_result',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          toolResult,
          parentToolUseId: block.id,
        });
        onMessage?.(toolResultMsg);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
        });
      }
    }

    // Add assistant message to history
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // If we have tool results, add them and continue
    if (hasToolUse && toolResults.length > 0) {
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Stop if no more tool use or end_turn
    if (!hasToolUse || response.stop_reason === 'end_turn') {
      break;
    }
  }

  const result: AgentResult = {
    success: true,
    result: finalResult,
    durationMs: Date.now() - startTime,
    totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
    numTurns,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };

  await agentStore.setSessionResult(sessionId, result);
  await agentStore.updateSessionStatus(sessionId, 'completed');
  return result;
}

/**
 * Call MCP tool via API
 */
async function callMcpTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
  try {
    // Determine base URL - use internal URL for server-side calls
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/design-mcp/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: toolName,
        arguments: input,
      }),
    });

    const result = await response.json();
    
    if (result.isError) {
      console.error(`Error calling ${toolName}:`, result);
      return `Error: ${JSON.stringify(result)}`;
    }

    // Extract text content from MCP response
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text');
      if (textContent) return textContent.text;
    }

    return result;
  } catch (error) {
    console.error(`Failed to call MCP tool ${toolName}:`, error);
    return `Error calling tool: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
