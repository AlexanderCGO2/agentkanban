/**
 * Tool definitions and execution handlers
 * Includes: Core tools, Canvas MCP, Replicate AI
 */

import type {
  ToolName,
  ToolDefinition,
  ToolHandler,
  ToolExecutionContext,
} from './types';

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  // --- Core Tools ---
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information. Returns relevant search results.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        max_results: { type: 'number', description: 'Maximum number of results (default: 5)' },
      },
      required: ['query'],
    },
  },

  read_file: {
    name: 'read_file',
    description: 'Read the contents of a file from the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file within the session workspace' },
      },
      required: ['path'],
    },
  },

  write_file: {
    name: 'write_file',
    description: 'Write content to a file in the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },

  list_files: {
    name: 'list_files',
    description: 'List all files in the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'Optional prefix to filter files' },
      },
      required: [],
    },
  },

  bash: {
    name: 'bash',
    description: 'Execute safe bash commands (echo, ls, pwd, date, cat, grep, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
      },
      required: ['command'],
    },
  },

  // --- Canvas MCP Tools ---
  canvas_create: {
    name: 'canvas_create',
    description: 'Create a new design canvas for mindmaps, workflows, or freeform design',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { type: 'string', enum: ['mindmap', 'workflow', 'freeform'], description: 'Type of canvas' },
      },
      required: ['name', 'type'],
    },
  },

  canvas_delete: {
    name: 'canvas_delete',
    description: 'Delete an existing canvas',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to delete' },
      },
      required: ['canvasId'],
    },
  },

  canvas_list: {
    name: 'canvas_list',
    description: 'List all canvases',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  canvas_get: {
    name: 'canvas_get',
    description: 'Get full details of a canvas including all nodes and connections',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
      },
      required: ['canvasId'],
    },
  },

  canvas_add_node: {
    name: 'canvas_add_node',
    description: 'Add a node to an existing canvas',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { type: 'string', enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output', 'image'], description: 'Type of node' },
        label: { type: 'string', description: 'Label/text for the node' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        width: { type: 'number', description: 'Width of node (optional)' },
        height: { type: 'number', description: 'Height of node (optional)' },
        imageUrl: { type: 'string', description: 'URL of image for image nodes (optional)' },
      },
      required: ['canvasId', 'nodeType', 'label'],
    },
  },

  canvas_add_image: {
    name: 'canvas_add_image',
    description: 'Add an image to a canvas. Use this to add AI-generated images from Replicate to your design canvas.',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        imageUrl: { type: 'string', description: 'URL of the image (e.g., from Replicate)' },
        label: { type: 'string', description: 'Caption/label for the image (optional)' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        width: { type: 'number', description: 'Width of the image node (default: 200)' },
        height: { type: 'number', description: 'Height of the image node (default: 200)' },
      },
      required: ['canvasId', 'imageUrl'],
    },
  },

  canvas_update_node: {
    name: 'canvas_update_node',
    description: 'Update properties of an existing node',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        nodeId: { type: 'string' },
        label: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['canvasId', 'nodeId'],
    },
  },

  canvas_delete_node: {
    name: 'canvas_delete_node',
    description: 'Delete a node and its connections',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        nodeId: { type: 'string' },
      },
      required: ['canvasId', 'nodeId'],
    },
  },

  canvas_add_connection: {
    name: 'canvas_add_connection',
    description: 'Add a connection between two nodes',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        fromNodeId: { type: 'string' },
        toNodeId: { type: 'string' },
        label: { type: 'string', description: 'Optional label for the connection' },
        style: { type: 'string', enum: ['solid', 'dashed', 'arrow'], description: 'Connection style' },
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId'],
    },
  },

  canvas_delete_connection: {
    name: 'canvas_delete_connection',
    description: 'Delete a connection between nodes',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        connectionId: { type: 'string' },
      },
      required: ['canvasId', 'connectionId'],
    },
  },

  canvas_export_svg: {
    name: 'canvas_export_svg',
    description: 'Export canvas as SVG image',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
      },
      required: ['canvasId'],
    },
  },

  canvas_export_json: {
    name: 'canvas_export_json',
    description: 'Export canvas as JSON data',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
      },
      required: ['canvasId'],
    },
  },

  canvas_layout_auto: {
    name: 'canvas_layout_auto',
    description: 'Auto-arrange nodes using a layout algorithm',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        algorithm: { type: 'string', enum: ['horizontal', 'vertical', 'radial', 'tree', 'grid'], description: 'Layout algorithm' },
      },
      required: ['canvasId', 'algorithm'],
    },
  },

  mindmap_create: {
    name: 'mindmap_create',
    description: 'Create a mindmap from a central topic and branches',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the mindmap' },
        centralTopic: { type: 'string', description: 'Central topic of the mindmap' },
        branches: { type: 'array', items: { type: 'string' }, description: 'Initial branch topics' },
      },
      required: ['name', 'centralTopic', 'branches'],
    },
  },

  mindmap_add_branch: {
    name: 'mindmap_add_branch',
    description: 'Add branches to an existing mindmap node',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        parentNodeId: { type: 'string', description: 'ID of the parent node' },
        branchTopics: { type: 'array', items: { type: 'string' }, description: 'Topics for new branches' },
      },
      required: ['canvasId', 'parentNodeId', 'branchTopics'],
    },
  },

  workflow_create: {
    name: 'workflow_create',
    description: 'Create a research workflow from a template',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        template: { type: 'string', enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis', 'custom'], description: 'Workflow template' },
        customSteps: { type: 'array', items: { type: 'string' }, description: 'Custom steps (for custom template)' },
      },
      required: ['name', 'template'],
    },
  },

  // --- Replicate AI Tools ---
  replicate_run: {
    name: 'replicate_run',
    description: 'Run an AI model on Replicate. Supports image generation (FLUX, Stable Diffusion), text-to-speech, image editing, and more.',
    input_schema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model identifier (e.g., "black-forest-labs/flux-schnell", "stability-ai/sdxl")' },
        input: { type: 'object', description: 'Model-specific input parameters (e.g., {prompt: "a cat"})' },
        wait: { type: 'boolean', description: 'Wait for completion (default: true)' },
      },
      required: ['model', 'input'],
    },
  },

  replicate_search_models: {
    name: 'replicate_search_models',
    description: 'Search for AI models on Replicate by query',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g., "image generation", "text to speech")' },
      },
      required: ['query'],
    },
  },

  replicate_get_model: {
    name: 'replicate_get_model',
    description: 'Get details about a specific Replicate model including its inputs and outputs',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Model owner (e.g., "black-forest-labs")' },
        name: { type: 'string', description: 'Model name (e.g., "flux-schnell")' },
      },
      required: ['owner', 'name'],
    },
  },
};

// ============================================================
// TOOL HANDLERS
// ============================================================

const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  // --- Core Tool Handlers ---
  web_search: async (input) => {
    const { query } = input as { query: string };
    return JSON.stringify({
      query,
      results: [],
      note: 'Web search requires API key configuration. Set BRAVE_API_KEY or SERPER_API_KEY.',
    });
  },

  read_file: async (input, context) => {
    const { path } = input as { path: string };
    const r2Key = `sessions/${context.sessionId}/files/${path}`;
    try {
      const object = await context.fileStorage.get(r2Key);
      if (!object) return `Error: File not found: ${path}`;
      return await object.text();
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  write_file: async (input, context) => {
    const { path, content } = input as { path: string; content: string };
    const r2Key = `sessions/${context.sessionId}/files/${path}`;
    try {
      await context.fileStorage.put(r2Key, content, {
        customMetadata: { sessionId: context.sessionId, originalPath: path, createdAt: new Date().toISOString() },
      });
      return `Successfully wrote ${content.length} bytes to ${path}`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  list_files: async (input, context) => {
    const { prefix = '' } = input as { prefix?: string };
    const r2Prefix = `sessions/${context.sessionId}/files/${prefix}`;
    try {
      const listed = await context.fileStorage.list({ prefix: r2Prefix });
      const files = listed.objects.map((obj) => ({
        name: obj.key.replace(`sessions/${context.sessionId}/files/`, ''),
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }));
      return files.length === 0 ? 'No files found in workspace.' : JSON.stringify(files, null, 2);
    } catch (error) {
      return `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  bash: async (input, context) => {
    const { command } = input as { command: string };
    const ALLOWED = ['echo', 'cat', 'ls', 'pwd', 'date', 'wc', 'head', 'tail', 'grep', 'sort', 'uniq'];
    const firstWord = command.trim().split(/\s+/)[0];
    if (!ALLOWED.includes(firstWord)) {
      return `Error: Command '${firstWord}' not allowed. Allowed: ${ALLOWED.join(', ')}`;
    }
    if (firstWord === 'echo') return command.slice(5).trim().replace(/^["']|["']$/g, '');
    if (firstWord === 'date') return new Date().toISOString();
    if (firstWord === 'pwd') return `/workspace/sessions/${context.sessionId}`;
    if (firstWord === 'ls') {
      const listed = await context.fileStorage.list({ prefix: `sessions/${context.sessionId}/files/` });
      return listed.objects.map((obj) => obj.key.replace(`sessions/${context.sessionId}/files/`, '')).join('\n') || '(empty)';
    }
    return `Command '${command}' requires sandbox execution.`;
  },

  // --- Canvas MCP Handlers (proxy to Vercel API) ---
  canvas_create: createCanvasHandler('canvas_create'),
  canvas_delete: createCanvasHandler('canvas_delete'),
  canvas_list: createCanvasHandler('canvas_list'),
  canvas_get: createCanvasHandler('canvas_get'),
  canvas_add_node: createCanvasHandler('canvas_add_node'),
  canvas_add_image: createCanvasHandler('canvas_add_image'),
  canvas_update_node: createCanvasHandler('canvas_update_node'),
  canvas_delete_node: createCanvasHandler('canvas_delete_node'),
  canvas_add_connection: createCanvasHandler('canvas_add_connection'),
  canvas_delete_connection: createCanvasHandler('canvas_delete_connection'),
  canvas_export_svg: createCanvasHandler('canvas_export_svg'),
  canvas_export_json: createCanvasHandler('canvas_export_json'),
  canvas_layout_auto: createCanvasHandler('canvas_layout_auto'),
  mindmap_create: createCanvasHandler('mindmap_create'),
  mindmap_add_branch: createCanvasHandler('mindmap_add_branch'),
  workflow_create: createCanvasHandler('workflow_create'),

  // --- Replicate Handlers ---
  replicate_run: async (input, context) => {
    const { model, input: modelInput, wait = true } = input as {
      model: string;
      input: Record<string, unknown>;
      wait?: boolean;
    };

    const apiToken = context.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return 'Error: REPLICATE_API_TOKEN not configured. Set it via: npx wrangler secret put REPLICATE_API_TOKEN';
    }

    try {
      // Parse model identifier (owner/name or owner/name:version)
      const [ownerName, version] = model.split(':');
      const [owner, name] = ownerName.split('/');

      if (!owner || !name) {
        return 'Error: Invalid model format. Use "owner/name" (e.g., "black-forest-labs/flux-schnell")';
      }

      // Use the models endpoint which doesn't require version
      const apiUrl = `https://api.replicate.com/v1/models/${owner}/${name}/predictions`;

      const createRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Prefer': wait ? 'wait' : '',
        },
        body: JSON.stringify({
          input: modelInput,
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        return `Error creating prediction: ${error}`;
      }

      const prediction = await createRes.json() as {
        id: string;
        status: string;
        output?: unknown;
        error?: string;
        urls?: { get: string };
      };

      // If not waiting or already completed
      if (!wait || prediction.status === 'succeeded') {
        return JSON.stringify({
          id: prediction.id,
          status: prediction.status,
          output: prediction.output,
          model: model,
        }, null, 2);
      }

      // Poll for completion
      if (prediction.status === 'starting' || prediction.status === 'processing') {
        let result = prediction;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const pollRes = await fetch(prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` },
          });
          result = await pollRes.json() as typeof prediction;
          if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') {
            break;
          }
        }
        return JSON.stringify({
          id: result.id,
          status: result.status,
          output: result.output,
          error: result.error,
          model: model,
        }, null, 2);
      }

      return JSON.stringify(prediction, null, 2);
    } catch (error) {
      return `Error running Replicate model: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  replicate_search_models: async (input, context) => {
    const { query } = input as { query: string };
    const apiToken = context.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      return 'Error: REPLICATE_API_TOKEN not configured.';
    }

    try {
      const res = await fetch(`https://api.replicate.com/v1/models?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        return `Error searching models: ${await res.text()}`;
      }

      const data = await res.json() as { results: Array<{ owner: string; name: string; description: string; run_count: number }> };
      const models = data.results?.slice(0, 10).map((m) => ({
        id: `${m.owner}/${m.name}`,
        description: m.description?.slice(0, 100),
        runs: m.run_count,
      }));

      return JSON.stringify(models, null, 2);
    } catch (error) {
      return `Error searching models: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  replicate_get_model: async (input, context) => {
    const { owner, name } = input as { owner: string; name: string };
    const apiToken = context.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      return 'Error: REPLICATE_API_TOKEN not configured.';
    }

    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        return `Error getting model: ${await res.text()}`;
      }

      const model = await res.json() as {
        owner: string;
        name: string;
        description: string;
        latest_version?: { openapi_schema?: { components?: { schemas?: { Input?: unknown } } } };
      };

      return JSON.stringify({
        id: `${model.owner}/${model.name}`,
        description: model.description,
        inputSchema: model.latest_version?.openapi_schema?.components?.schemas?.Input,
      }, null, 2);
    } catch (error) {
      return `Error getting model: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};

/**
 * Create a handler that proxies to Canvas MCP API
 */
function createCanvasHandler(toolName: string): ToolHandler {
  return async (input, context) => {
    const baseUrl = context.env.CANVAS_MCP_URL;
    if (!baseUrl) {
      return `Error: CANVAS_MCP_URL not configured. Set it to your Vercel app URL (e.g., https://your-app.vercel.app)`;
    }

    try {
      const res = await fetch(`${baseUrl}/api/design-mcp/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: input }),
      });

      if (!res.ok) {
        const error = await res.text();
        return `Error calling Canvas MCP: ${error}`;
      }

      const result = await res.json();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error calling Canvas MCP: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };
}

// ============================================================
// EXPORTS
// ============================================================

/**
 * Get tool definitions for allowed tools
 */
export function getToolDefinitions(allowedTools: ToolName[]): ToolDefinition[] {
  return allowedTools.filter((name) => TOOL_DEFINITIONS[name]).map((name) => TOOL_DEFINITIONS[name]);
}

/**
 * Execute a tool call
 */
export async function executeToolCall(
  toolName: ToolName,
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<string> {
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(input, context);
}

/**
 * Get all available tool names
 */
export function getAllToolNames(): ToolName[] {
  return Object.keys(TOOL_DEFINITIONS) as ToolName[];
}

/**
 * Default tools for new sessions
 */
export const DEFAULT_TOOLS: ToolName[] = [
  'read_file',
  'write_file',
  'list_files',
  'canvas_list',
  'canvas_create',
  'canvas_add_node',
  'mindmap_create',
  'replicate_run',
];
