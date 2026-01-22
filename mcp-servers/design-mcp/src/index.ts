/**
 * Design MCP Server for Cloudflare Workers
 * 
 * Provides visual design tools (mindmaps, workflows, freeform canvases)
 * accessible via the Model Context Protocol (MCP).
 * 
 * Endpoints:
 * - GET  /                    - Server info
 * - GET  /health              - Health check
 * - GET  /mcp/tools           - List available MCP tools
 * - POST /mcp/tools/call      - Call an MCP tool
 * - GET  /mcp/resources       - List available resources
 * - GET  /mcp/resources/read  - Read a resource
 * - GET  /api/canvases        - REST: List all canvases
 * - GET  /api/canvases/:id    - REST: Get canvas by ID
 * - POST /api/canvases        - REST: Create canvas
 * - DELETE /api/canvases/:id  - REST: Delete canvas
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, McpToolCallRequest, CanvasType } from './types';
import { MCP_TOOLS } from './tools';
import {
  handleCanvasCreate,
  handleCanvasDelete,
  handleCanvasAddNode,
  handleCanvasUpdateNode,
  handleCanvasDeleteNode,
  handleCanvasAddConnection,
  handleCanvasDeleteConnection,
  handleCanvasExportSvg,
  handleCanvasExportJson,
  handleCanvasImportJson,
  handleCanvasLayoutAuto,
  handleMindmapCreate,
  handleMindmapAddBranch,
  handleWorkflowCreate,
  handleCanvasList,
  handleCanvasGet,
} from './handlers';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// Server Info
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'design-mcp',
    version: '1.0.0',
    description: 'MCP Server for Design Canvas - Mindmaps, Workflows, and Visual Tools',
    protocol: 'mcp',
    endpoints: {
      mcp: {
        tools: '/mcp/tools',
        toolsCall: '/mcp/tools/call',
        resources: '/mcp/resources',
        resourcesRead: '/mcp/resources/read',
      },
      rest: {
        canvases: '/api/canvases',
        canvas: '/api/canvases/:id',
      },
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// MCP Protocol Endpoints
// ============================================================================

// List available tools
app.get('/mcp/tools', (c) => {
  return c.json({ tools: MCP_TOOLS });
});

// Call a tool
app.post('/mcp/tools/call', async (c) => {
  const body = await c.req.json<McpToolCallRequest>();
  const { name, arguments: args } = body;

  try {
    switch (name) {
      case 'canvas_create':
        return c.json(await handleCanvasCreate(args as { name: string; type: CanvasType }, c.env));
      
      case 'canvas_delete':
        return c.json(await handleCanvasDelete(args as { canvasId: string }, c.env));
      
      case 'canvas_add_node':
        return c.json(await handleCanvasAddNode(args as Parameters<typeof handleCanvasAddNode>[0], c.env));
      
      case 'canvas_update_node':
        return c.json(await handleCanvasUpdateNode(args as Parameters<typeof handleCanvasUpdateNode>[0], c.env));
      
      case 'canvas_delete_node':
        return c.json(await handleCanvasDeleteNode(args as Parameters<typeof handleCanvasDeleteNode>[0], c.env));
      
      case 'canvas_add_connection':
        return c.json(await handleCanvasAddConnection(args as Parameters<typeof handleCanvasAddConnection>[0], c.env));
      
      case 'canvas_delete_connection':
        return c.json(await handleCanvasDeleteConnection(args as Parameters<typeof handleCanvasDeleteConnection>[0], c.env));
      
      case 'canvas_export_svg':
        return c.json(await handleCanvasExportSvg(args as { canvasId: string }, c.env));
      
      case 'canvas_export_json':
        return c.json(await handleCanvasExportJson(args as { canvasId: string }, c.env));
      
      case 'canvas_import_json':
        return c.json(await handleCanvasImportJson(args as { json: string }, c.env));
      
      case 'canvas_layout_auto':
        return c.json(await handleCanvasLayoutAuto(args as Parameters<typeof handleCanvasLayoutAuto>[0], c.env));
      
      case 'mindmap_create':
        return c.json(await handleMindmapCreate(args as Parameters<typeof handleMindmapCreate>[0], c.env));
      
      case 'mindmap_add_branch':
        return c.json(await handleMindmapAddBranch(args as Parameters<typeof handleMindmapAddBranch>[0], c.env));
      
      case 'workflow_create':
        return c.json(await handleWorkflowCreate(args as Parameters<typeof handleWorkflowCreate>[0], c.env));
      
      case 'canvas_list':
        return c.json(await handleCanvasList(c.env));
      
      case 'canvas_get':
        return c.json(await handleCanvasGet(args as { canvasId: string }, c.env));
      
      default:
        return c.json({
          content: [{ type: 'text', text: `❌ Unknown tool: ${name}` }],
          isError: true,
        }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      content: [{ type: 'text', text: `❌ Error: ${message}` }],
      isError: true,
    }, 500);
  }
});

// List available resources
app.get('/mcp/resources', async (c) => {
  const resources = [
    {
      uri: 'canvas://list',
      name: 'Canvas List',
      description: 'List of all canvases',
      mimeType: 'application/json',
    },
    {
      uri: 'templates://mindmap',
      name: 'Mindmap Templates',
      description: 'Available mindmap templates',
      mimeType: 'application/json',
    },
    {
      uri: 'templates://workflow',
      name: 'Workflow Templates',
      description: 'Available workflow templates',
      mimeType: 'application/json',
    },
  ];

  // Add individual canvas resources
  const listResult = await handleCanvasList(c.env);
  const text = listResult.content[0]?.text || '';
  const idMatches = text.matchAll(/ID: ([a-f0-9-]+)/g);
  for (const match of idMatches) {
    resources.push({
      uri: `canvas://${match[1]}`,
      name: `Canvas ${match[1].slice(0, 8)}...`,
      description: 'Individual canvas data',
      mimeType: 'application/json',
    });
  }

  return c.json({ resources });
});

// Read a resource
app.get('/mcp/resources/read', async (c) => {
  const uri = c.req.query('uri');
  
  if (!uri) {
    return c.json({ error: 'Missing uri parameter' }, 400);
  }

  try {
    // Parse URI
    if (uri === 'canvas://list') {
      const result = await handleCanvasList(c.env);
      return c.json({
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: result.content[0]?.text,
        }],
      });
    }

    if (uri.startsWith('canvas://')) {
      const canvasId = uri.replace('canvas://', '');
      const result = await handleCanvasGet({ canvasId }, c.env);
      return c.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: result.content[0]?.text,
        }],
      });
    }

    if (uri === 'templates://mindmap') {
      return c.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            brainstorm: { name: 'Brainstorming Session', branches: ['What', 'Why', 'How', 'Who', 'When'] },
            'project-plan': { name: 'Project Planning', branches: ['Phase 1', 'Phase 2', 'Phase 3', 'Resources', 'Risks'] },
            'decision-tree': { name: 'Decision Tree', branches: ['Option A', 'Option B', 'Option C', 'Criteria'] },
            swot: { name: 'SWOT Analysis', branches: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'] },
          }, null, 2),
        }],
      });
    }

    if (uri === 'templates://workflow') {
      return c.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            'literature-review': { name: 'Literature Review', steps: 5 },
            'competitive-analysis': { name: 'Competitive Analysis', steps: 5 },
            'user-research': { name: 'User Research', steps: 5 },
            'data-analysis': { name: 'Data Analysis', steps: 5 },
          }, null, 2),
        }],
      });
    }

    return c.json({ error: `Unknown resource: ${uri}` }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// ============================================================================
// REST API Endpoints (for direct frontend access)
// ============================================================================

// List all canvases
app.get('/api/canvases', async (c) => {
  const result = await handleCanvasList(c.env);
  return c.json(result);
});

// Get canvas by ID
app.get('/api/canvases/:id', async (c) => {
  const id = c.req.param('id');
  const result = await handleCanvasGet({ canvasId: id }, c.env);
  if (result.isError) {
    return c.json(result, 404);
  }
  return c.json(result);
});

// Create canvas
app.post('/api/canvases', async (c) => {
  const body = await c.req.json<{ name: string; type: CanvasType }>();
  const result = await handleCanvasCreate(body, c.env);
  return c.json(result, 201);
});

// Delete canvas
app.delete('/api/canvases/:id', async (c) => {
  const id = c.req.param('id');
  const result = await handleCanvasDelete({ canvasId: id }, c.env);
  if (result.isError) {
    return c.json(result, 404);
  }
  return c.json(result);
});

// ============================================================================
// Export
// ============================================================================

export default app;
