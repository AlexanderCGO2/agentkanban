import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

const anthropic = new Anthropic();

// MCP Tool definitions for the Design Agent
const MCP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'mindmap_create',
    description: 'Create a new mindmap with a central topic and initial branches. Returns canvas ID and node IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name/title for the mindmap canvas' },
        centralTopic: { type: 'string', description: 'The central topic/title of the mindmap' },
        branches: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of branch labels to connect to the central topic'
        }
      },
      required: ['name', 'centralTopic', 'branches']
    }
  },
  {
    name: 'mindmap_add_branch',
    description: 'Add new branches to an existing mindmap',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'The canvas ID to add branches to' },
        parentNodeId: { type: 'string', description: 'The parent node ID to attach branches to' },
        branchTopics: { type: 'array', items: { type: 'string' }, description: 'Array of branch topic labels' }
      },
      required: ['canvasId', 'parentNodeId', 'branchTopics']
    }
  },
  {
    name: 'workflow_create',
    description: 'Create a workflow diagram from a template',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the workflow canvas' },
        template: {
          type: 'string',
          enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis', 'custom'],
          description: 'Workflow template type'
        },
        customSteps: { type: 'array', items: { type: 'string' }, description: 'Custom step titles (only for custom template)' }
      },
      required: ['name', 'template']
    }
  },
  {
    name: 'canvas_create',
    description: 'Create a new empty canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { type: 'string', enum: ['mindmap', 'workflow', 'freeform'], description: 'Type of canvas' }
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'canvas_add_node',
    description: 'Add a node to a canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID' },
        nodeType: {
          type: 'string',
          enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output'],
          description: 'Node type'
        },
        label: { type: 'string', description: 'Node label/title' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' }
      },
      required: ['canvasId', 'nodeType', 'label']
    }
  },
  {
    name: 'canvas_add_connection',
    description: 'Connect two nodes on a canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID' },
        fromNodeId: { type: 'string', description: 'Source node ID' },
        toNodeId: { type: 'string', description: 'Target node ID' },
        style: { type: 'string', enum: ['solid', 'dashed', 'arrow'], description: 'Connection style' },
        label: { type: 'string', description: 'Optional connection label' }
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId']
    }
  },
  {
    name: 'canvas_export_svg',
    description: 'Export a canvas as SVG',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID to export' }
      },
      required: ['canvasId']
    }
  },
  {
    name: 'canvas_export_json',
    description: 'Export canvas data as JSON',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID to export' }
      },
      required: ['canvasId']
    }
  },
  {
    name: 'canvas_layout_auto',
    description: 'Auto-arrange nodes on a canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID' },
        algorithm: {
          type: 'string',
          enum: ['horizontal', 'vertical', 'radial', 'tree', 'grid'],
          description: 'Layout algorithm'
        }
      },
      required: ['canvasId', 'algorithm']
    }
  },
  {
    name: 'canvas_list',
    description: 'List all available canvases',
    input_schema: {
      type: 'object' as const,
      properties: {}
    }
  },
  {
    name: 'canvas_get',
    description: 'Get details of a specific canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID' }
      },
      required: ['canvasId']
    }
  },
  {
    name: 'canvas_delete',
    description: 'Delete a canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID to delete' }
      },
      required: ['canvasId']
    }
  }
];

// Get MCP server URL
const MCP_SERVER_URL = process.env.DESIGN_MCP_URL || 'https://agentkanban.vercel.app';

/**
 * Call an MCP tool via HTTP
 */
async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/api/design-mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: toolName, arguments: args }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `Error calling ${toolName}: ${error}`;
    }

    const result = await response.json();
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return `Error calling ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

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
Complete the user request following your agent task guidelines. Use the canvas tools when appropriate to create visual artifacts.`;
  }
  
  return userPrompt;
}

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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let numTurns = 0;

  try {
    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: fullPrompt }
    ];

    // Determine if this agent has MCP tools enabled
    const hasMcpTools = config.mcpServers && Object.keys(config.mcpServers).length > 0;
    const tools = hasMcpTools ? MCP_TOOLS : undefined;

    // Agent loop - keep going while there are tool calls
    let continueLoop = true;
    let finalContent = '';

    while (continueLoop && numTurns < (config.maxTurns || 10)) {
      numTurns++;

      // Make API call
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: config.systemPrompt || 'You are a helpful AI assistant.',
        messages,
        tools,
      });

      // Track usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Process response blocks
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let textContent = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
          assistantContent.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          assistantContent.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });

          // Add tool use message
          const toolUseMessage = await agentStore.addMessage(sessionId, {
            type: 'tool_use',
            content: `Using tool: ${block.name}`,
            toolName: block.name,
            toolInput: block.input as Record<string, unknown>,
          });
          onMessage?.(toolUseMessage);

          // Execute the tool
          const result = await callMcpTool(block.name, block.input as Record<string, unknown>);

          // Add tool result message
          const toolResultMessage = await agentStore.addMessage(sessionId, {
            type: 'tool_result',
            content: result,
            toolName: block.name,
            toolResult: result,
            parentToolUseId: block.id,
          });
          onMessage?.(toolResultMessage);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add text content as message if present
      if (textContent) {
        const assistantMessage = await agentStore.addMessage(sessionId, {
          type: 'assistant',
          content: textContent,
        });
        onMessage?.(assistantMessage);
        finalContent = textContent;
      }

      // Add assistant turn to messages
      messages.push({ role: 'assistant', content: assistantContent });

      // If there were tool calls, add results and continue
      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      } else {
        // No tool calls, we're done
        continueLoop = false;
      }

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        continueLoop = false;
      }
    }

    // Create result
    const result: AgentResult = {
      success: true,
      result: finalContent,
      durationMs: Date.now() - startTime,
      totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
      numTurns,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };

    await agentStore.setSessionResult(sessionId, result);
    await agentStore.updateSessionStatus(sessionId, 'completed');
    return result;

  } catch (error) {
    const errorResult: AgentResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      totalCostUsd: 0,
      numTurns,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
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
