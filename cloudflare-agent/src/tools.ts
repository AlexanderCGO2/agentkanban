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
    description: 'Add a node to an existing canvas. Supports text nodes, images, videos, and audio.',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { type: 'string', enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output', 'image', 'video', 'audio'], description: 'Type of node' },
        label: { type: 'string', description: 'Label/text for the node' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        width: { type: 'number', description: 'Width of node (optional)' },
        height: { type: 'number', description: 'Height of node (optional)' },
        imageUrl: { type: 'string', description: 'URL of image for image nodes (optional)' },
        videoUrl: { type: 'string', description: 'URL of video for video nodes (optional)' },
        audioUrl: { type: 'string', description: 'URL of audio for audio nodes (optional)' },
      },
      required: ['canvasId', 'nodeType', 'label'],
    },
  },

  canvas_add_video: {
    name: 'canvas_add_video',
    description: 'Add a video node to a canvas.',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        videoUrl: { type: 'string', description: 'URL of the video' },
        label: { type: 'string', description: 'Caption/label for the video (optional)' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        width: { type: 'number', description: 'Width of the video node (default: 320)' },
        height: { type: 'number', description: 'Height of the video node (default: 180)' },
      },
      required: ['canvasId', 'videoUrl'],
    },
  },

  canvas_add_audio: {
    name: 'canvas_add_audio',
    description: 'Add an audio node to a canvas.',
    input_schema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        audioUrl: { type: 'string', description: 'URL of the audio file' },
        label: { type: 'string', description: 'Caption/label for the audio (optional)' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        width: { type: 'number', description: 'Width of the audio node (default: 300)' },
        height: { type: 'number', description: 'Height of the audio node (default: 80)' },
      },
      required: ['canvasId', 'audioUrl'],
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

  // --- ElevenLabs Tools ---
  elevenlabs_text_to_dialogue: {
    name: 'elevenlabs_text_to_dialogue',
    description: 'Generate natural dialogue audio from text using ElevenLabs Text to Dialogue API. Perfect for podcasts, interviews, and multi-speaker content. Use emotion tags like [cheerfully], [sadly], [excitedly] to add expression.',
    input_schema: {
      type: 'object',
      properties: {
        inputs: {
          type: 'array',
          description: 'Array of dialogue inputs, each with text and voice assignment',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The dialogue text. Can include emotion tags like [cheerfully], [sadly], [excitedly], [stuttering]' },
              voice_id: { type: 'string', description: 'ElevenLabs voice ID (e.g., "9BWtsMINqrJLrRacOk9x" for Aria, "IKne3meq5aSn9XLyUdCD" for Sarah)' },
              speaker_name: { type: 'string', description: 'Optional speaker name for transcript' },
            },
            required: ['text', 'voice_id'],
          },
        },
        output_filename: { type: 'string', description: 'Optional filename for the output audio (default: dialogue_{timestamp}.mp3)' },
      },
      required: ['inputs'],
    },
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Download files from Replicate output and store them in R2
 * Returns array of stored file info with R2 URLs
 */
async function storeReplicateOutputToR2(
  output: unknown,
  predictionId: string,
  context: ToolExecutionContext
): Promise<Array<{ original: string; r2Url: string; path: string }>> {
  const storedFiles: Array<{ original: string; r2Url: string; path: string }> = [];

  // Extract URLs from output (can be string, array of strings, or object)
  const urls: string[] = [];
  if (typeof output === 'string' && output.startsWith('http')) {
    urls.push(output);
  } else if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'string' && item.startsWith('http')) {
        urls.push(item);
      }
    }
  }

  // Download and store each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      // Fetch the file
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status}`);
        continue;
      }

      // Determine file extension from URL or content-type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      let ext = 'bin';
      if (contentType.includes('image/png')) ext = 'png';
      else if (contentType.includes('image/jpeg')) ext = 'jpg';
      else if (contentType.includes('image/webp')) ext = 'webp';
      else if (contentType.includes('image/gif')) ext = 'gif';
      else if (contentType.includes('audio/')) ext = 'mp3';
      else if (contentType.includes('video/')) ext = 'mp4';
      else {
        // Try to get extension from URL
        const urlExt = url.split('.').pop()?.split('?')[0];
        if (urlExt && urlExt.length <= 4) ext = urlExt;
      }

      // Create unique filename
      const filename = `${predictionId}_${i}.${ext}`;
      const filePath = `images/${filename}`;
      const r2Key = `sessions/${context.sessionId}/files/${filePath}`;

      // Store in R2
      const arrayBuffer = await response.arrayBuffer();
      await context.fileStorage.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType },
        customMetadata: {
          sessionId: context.sessionId,
          predictionId,
          originalUrl: url,
          createdAt: new Date().toISOString(),
        },
      });

      // Build the R2-backed URL (served through our worker)
      // Format: /sessions/{sessionId}/files/{path}
      const r2Url = `/sessions/${context.sessionId}/files/${filePath}`;

      storedFiles.push({
        original: url,
        r2Url,
        path: filePath,
      });
    } catch (error) {
      console.error(`Error storing file from ${url}:`, error);
    }
  }

  return storedFiles;
}

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
  canvas_add_video: createCanvasHandler('canvas_add_video'),
  canvas_add_audio: createCanvasHandler('canvas_add_audio'),
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

      let prediction = await createRes.json() as {
        id: string;
        status: string;
        output?: unknown;
        error?: string;
        urls?: { get: string };
      };

      // Poll for completion if needed
      if (prediction.status === 'starting' || prediction.status === 'processing') {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const pollRes = await fetch(prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` },
          });
          prediction = await pollRes.json() as typeof prediction;
          if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
            break;
          }
        }
      }

      // Store output files to R2 if generation succeeded
      let storedFiles: Array<{ original: string; r2Url: string; path: string }> = [];
      if (prediction.status === 'succeeded' && prediction.output) {
        storedFiles = await storeReplicateOutputToR2(prediction.output, prediction.id, context);
      }

      return JSON.stringify({
        id: prediction.id,
        status: prediction.status,
        output: prediction.output,
        error: prediction.error,
        model: model,
        // Include R2 URLs for stored files
        storedFiles: storedFiles.length > 0 ? storedFiles : undefined,
        // Convenience: first stored image URL for easy access
        imageUrl: storedFiles.length > 0 ? storedFiles[0].r2Url : undefined,
      }, null, 2);
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

  // --- ElevenLabs Handlers ---
  elevenlabs_text_to_dialogue: async (input, context) => {
    const { inputs, output_filename } = input as {
      inputs: Array<{ text: string; voice_id: string; speaker_name?: string }>;
      output_filename?: string;
    };

    const apiKey = context.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return 'Error: ELEVENLABS_API_KEY not configured. Set it via: npx wrangler secret put ELEVENLABS_API_KEY';
    }

    if (!inputs || inputs.length === 0) {
      return 'Error: inputs array is required and must not be empty';
    }

    try {
      // Call ElevenLabs Text to Dialogue API
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-dialogue/convert', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: inputs.map(item => ({
            text: item.text,
            voice_id: item.voice_id,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return `Error from ElevenLabs API: ${response.status} - ${error}`;
      }

      // Get the audio data
      const audioBuffer = await response.arrayBuffer();

      // Generate filename
      const timestamp = Date.now();
      const filename = output_filename || `dialogue_${timestamp}.mp3`;
      const filePath = `audio/${filename}`;
      const r2Key = `sessions/${context.sessionId}/files/${filePath}`;

      // Store in R2
      await context.fileStorage.put(r2Key, audioBuffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
        customMetadata: {
          sessionId: context.sessionId,
          createdAt: new Date().toISOString(),
          speakers: inputs.map(i => i.speaker_name || 'Unknown').join(', '),
        },
      });

      // Build transcript
      const transcript = inputs.map((item, i) => {
        const speaker = item.speaker_name || `Speaker ${i + 1}`;
        return `${speaker}: ${item.text}`;
      }).join('\n\n');

      // Save transcript
      const transcriptPath = `audio/${filename.replace('.mp3', '_transcript.txt')}`;
      const transcriptKey = `sessions/${context.sessionId}/files/${transcriptPath}`;
      await context.fileStorage.put(transcriptKey, transcript, {
        httpMetadata: { contentType: 'text/plain' },
      });

      const r2Url = `/sessions/${context.sessionId}/files/${filePath}`;
      const transcriptUrl = `/sessions/${context.sessionId}/files/${transcriptPath}`;

      return JSON.stringify({
        success: true,
        audioUrl: r2Url,
        transcriptUrl: transcriptUrl,
        path: filePath,
        transcriptPath: transcriptPath,
        duration: 'Audio generated successfully',
        speakers: inputs.map(i => i.speaker_name || 'Unknown'),
        storedFiles: [
          { original: 'elevenlabs', r2Url, path: filePath },
          { original: 'transcript', r2Url: transcriptUrl, path: transcriptPath },
        ],
      }, null, 2);
    } catch (error) {
      return `Error generating dialogue: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
