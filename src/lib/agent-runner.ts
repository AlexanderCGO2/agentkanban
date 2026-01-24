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
const CLOUDFLARE_AGENT_URL = process.env.CLOUDFLARE_AGENT_URL || 'https://agentkanban-worker.alexander-53b.workers.dev';

// Map frontend tool names to Cloudflare worker tool names
const TOOL_NAME_MAP: Record<string, string> = {
  'Read': 'read_file',
  'Write': 'write_file',
  'Edit': 'write_file',
  'Bash': 'bash',
  'Glob': 'list_files',
  'Grep': 'list_files',
  'WebSearch': 'web_search',
  'WebFetch': 'web_search',
  'Task': 'bash',
  'NotebookEdit': 'write_file',
  'MCP': 'canvas_list',
  // Canvas tools pass through as-is
  'canvas_create': 'canvas_create',
  'canvas_list': 'canvas_list',
  'canvas_get': 'canvas_get',
  'canvas_add_node': 'canvas_add_node',
  'canvas_add_image': 'canvas_add_image',
  'canvas_add_connection': 'canvas_add_connection',
  'canvas_export_svg': 'canvas_export_svg',
  'canvas_export_json': 'canvas_export_json',
  'canvas_layout_auto': 'canvas_layout_auto',
  'mindmap_create': 'mindmap_create',
  'mindmap_add_branch': 'mindmap_add_branch',
  'workflow_create': 'workflow_create',
  // Replicate tools
  'replicate_run': 'replicate_run',
  'replicate_search': 'replicate_search',
  'replicate_search_models': 'replicate_search_models',
  'replicate_get_model': 'replicate_get_model',
};

function mapToolNames(tools: string[]): string[] {
  return tools.map(t => TOOL_NAME_MAP[t] || t).filter((v, i, a) => a.indexOf(v) === i);
}

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
    // Check if we should use Cloudflare or fallback to direct API
    // Use direct API if DISABLE_CLOUDFLARE is set, otherwise use Cloudflare
    const useCloudflare = process.env.DISABLE_CLOUDFLARE !== 'true';

    if (useCloudflare) {
      try {
        return await runAgentCloudflare(config, sessionId, fullPrompt, startTime, onMessage);
      } catch (cloudflareError) {
        console.error('Cloudflare worker failed, falling back to direct API:', cloudflareError);
        // Fallback to direct Anthropic API if Cloudflare fails
        return await runAgentDirect(config, sessionId, fullPrompt, startTime, onMessage);
      }
    } else {
      // Use direct Anthropic API
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

  // Build allowed tools list
  let allowedTools = mapToolNames(config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch', 'Glob', 'Grep']);

  // Replicate tools are ALWAYS enabled by default (opt-out, not opt-in)
  // Only disable if explicitly set to false
  const enableReplicate = config.enableReplicate !== false;

  if (enableReplicate) {
    const replicateTools = ['replicate_run', 'replicate_search', 'replicate_search_models', 'replicate_get_model'];
    for (const tool of replicateTools) {
      if (!allowedTools.includes(tool)) {
        allowedTools.push(tool);
      }
    }
  }

  // Always include canvas_add_image so agents can add images to canvases
  if (!allowedTools.includes('canvas_add_image')) {
    allowedTools.push('canvas_add_image');
  }

  const response = await fetch(`${CLOUDFLARE_AGENT_URL}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
      allowedTools,
      permissionMode: config.permissionMode || 'acceptEdits',
      maxTurns: config.maxTurns || 20,
      sessionId,
      enableReplicate,
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

  // Helper to process a single SSE line
  const processSSELine = async (line: string) => {
    if (!line.startsWith('data: ')) return;

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

        // Extract and save any stored files from Replicate results
        await extractAndSaveFiles(sessionId, data.content, data.toolName);
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
        console.log('Received done event:', JSON.stringify(data));
        if (data.content) finalResult = data.content;
        if (data.usage) {
          totalInputTokens = data.usage.inputTokens || 0;
          totalOutputTokens = data.usage.outputTokens || 0;
          console.log('Extracted usage - input:', totalInputTokens, 'output:', totalOutputTokens);
        } else {
          console.log('No usage data in done event');
        }
      }
    } catch (parseError) {
      // Only log if it looks like actual JSON (not empty or whitespace)
      if (line.slice(6).trim()) {
        console.error('Failed to parse SSE message:', line, parseError);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        await processSSELine(line);
      }
    }

    // Process any remaining data in the buffer after stream ends
    if (buffer.trim()) {
      await processSSELine(buffer);
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

  // Define MCP tools if enabled - comprehensive canvas/diagram tools
  const mcpTools = hasMcpTools ? [
    // Mind Map Tools
    {
      name: 'mindmap_create',
      description: 'Create a visual mind map diagram with a central topic and branches. Perfect for brainstorming, planning, or visualizing hierarchical information. Returns a canvas ID that can be viewed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Name for the mind map (e.g., "Project Ideas", "Feature Planning")' },
          centralTopic: { type: 'string', description: 'The main/central topic of the mind map' },
          branches: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of branches/subtopics radiating from the central topic',
          },
        },
        required: ['name', 'centralTopic', 'branches'],
      },
    },
    {
      name: 'mindmap_add_branch',
      description: 'Add new sub-branches to an existing node in a mind map',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID of the mind map' },
          parentNodeId: { type: 'string', description: 'The node ID to add branches to' },
          branchTopics: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of new branch topics to add',
          },
        },
        required: ['canvasId', 'parentNodeId', 'branchTopics'],
      },
    },
    // Workflow Tools
    {
      name: 'workflow_create',
      description: 'Create a workflow diagram showing sequential steps. Use for process flows, user journeys, or development pipelines.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Name for the workflow' },
          template: { 
            type: 'string', 
            description: 'Template type: "research" (literature review workflow), "development" (code workflow), "design" (design process), or "custom" (provide your own steps)' 
          },
          customSteps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Custom step names (required if template is "custom")',
          },
        },
        required: ['name', 'template'],
      },
    },
    // Canvas CRUD Tools
    {
      name: 'canvas_create',
      description: 'Create a new empty canvas for building custom diagrams',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Name for the canvas' },
          type: { 
            type: 'string', 
            description: 'Canvas type: "mindmap", "workflow", or "freeform"' 
          },
        },
        required: ['name', 'type'],
      },
    },
    {
      name: 'canvas_add_node',
      description: 'Add a node to an existing canvas. Use for building custom diagrams step by step.',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
          nodeType: { 
            type: 'string', 
            description: 'Node type: "idea", "task", "research", "note", "decision", "source", "process", "analyze", or "output"' 
          },
          label: { type: 'string', description: 'Text label for the node' },
          x: { type: 'number', description: 'X position (optional, auto-positioned if not provided)' },
          y: { type: 'number', description: 'Y position (optional, auto-positioned if not provided)' },
        },
        required: ['canvasId', 'nodeType', 'label'],
      },
    },
    {
      name: 'canvas_add_connection',
      description: 'Connect two nodes in a canvas with a line/arrow',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
          fromNodeId: { type: 'string', description: 'Source node ID' },
          toNodeId: { type: 'string', description: 'Target node ID' },
          label: { type: 'string', description: 'Optional label for the connection' },
          style: { type: 'string', description: 'Line style: "solid", "dashed", or "arrow" (default)' },
        },
        required: ['canvasId', 'fromNodeId', 'toNodeId'],
      },
    },
    // Canvas Query Tools
    {
      name: 'canvas_list',
      description: 'List all existing canvases with their IDs and types',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'canvas_get',
      description: 'Get detailed information about a canvas including all nodes and connections',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
        },
        required: ['canvasId'],
      },
    },
    // Canvas Export Tools
    {
      name: 'canvas_export_svg',
      description: 'Export a canvas as SVG vector graphics for sharing or embedding',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
        },
        required: ['canvasId'],
      },
    },
    {
      name: 'canvas_export_json',
      description: 'Export a canvas as JSON data for backup or transfer',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
        },
        required: ['canvasId'],
      },
    },
    // Layout Tools
    {
      name: 'canvas_layout_auto',
      description: 'Automatically arrange nodes in a canvas using a layout algorithm',
      input_schema: {
        type: 'object' as const,
        properties: {
          canvasId: { type: 'string', description: 'The canvas ID' },
          algorithm: { 
            type: 'string', 
            description: 'Layout algorithm: "horizontal", "vertical", "grid", or "radial"' 
          },
        },
        required: ['canvasId', 'algorithm'],
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

/**
 * Extract stored files from tool results and save to session
 * Handles Replicate outputs that store files to R2
 */
async function extractAndSaveFiles(
  sessionId: string,
  content: string,
  toolName?: string
): Promise<void> {
  // Only process replicate_run results
  if (toolName !== 'replicate_run') return;

  try {
    const parsed = JSON.parse(content);

    // Check for storedFiles array (files stored to R2)
    if (parsed.storedFiles && Array.isArray(parsed.storedFiles)) {
      for (const file of parsed.storedFiles) {
        // Build full URL for the file
        const fileUrl = file.r2Url.startsWith('/')
          ? `${CLOUDFLARE_AGENT_URL}${file.r2Url}`
          : file.r2Url;

        // Determine file type from path/URL
        const ext = file.path?.split('.').pop()?.toLowerCase() || 'bin';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

        // Extract filename from path
        const filename = file.path?.split('/').pop() || `replicate_${parsed.id}_${Date.now()}.${ext}`;

        await agentStore.addOutputFile(sessionId, {
          filename,
          path: file.path || filename,
          type: isImage ? 'image' : 'other',
          mimeType: isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream',
          size: 0, // Size unknown at this point
          url: fileUrl,
        });
      }
    }
  } catch {
    // Not valid JSON or no stored files, ignore
  }
}
