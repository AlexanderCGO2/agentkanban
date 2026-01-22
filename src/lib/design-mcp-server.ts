#!/usr/bin/env npx ts-node
/**
 * Design MCP Server - Wraps the HTTP design-mcp API for Claude Agent SDK
 * 
 * This script runs as a stdio-based MCP server that forwards tool calls
 * to the HTTP API at /api/design-mcp/tools/call
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE_URL = process.env.DESIGN_MCP_URL || 'https://agentkanban.vercel.app';

// Tool definitions - All 14 MCP tools
const TOOLS = [
  {
    name: 'mindmap_create',
    description: 'Create a mindmap from a central topic and branches - the quickest way to generate a complete visual mindmap',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the mindmap canvas' },
        centralTopic: { type: 'string', description: 'Central topic/theme of the mindmap' },
        branches: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array of branch topics to connect to the central topic'
        },
      },
      required: ['name', 'centralTopic', 'branches'],
    },
  },
  {
    name: 'mindmap_add_branch',
    description: 'Add new branches to an existing mindmap node',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the mindmap canvas' },
        parentNodeId: { type: 'string', description: 'ID of the parent node to branch from' },
        branchTopics: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array of topics for the new branches'
        },
      },
      required: ['canvasId', 'parentNodeId', 'branchTopics'],
    },
  },
  {
    name: 'workflow_create',
    description: 'Create a research workflow from a template (literature-review, competitive-analysis, user-research, data-analysis, or custom)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the workflow canvas' },
        template: { 
          type: 'string', 
          enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis', 'custom'],
          description: 'Workflow template to use'
        },
        customSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Custom step titles (required if template is "custom")'
        },
      },
      required: ['name', 'template'],
    },
  },
  {
    name: 'canvas_create',
    description: 'Create a new empty design canvas for mindmaps, workflows, or freeform design',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { 
          type: 'string', 
          enum: ['mindmap', 'workflow', 'freeform'],
          description: 'Type of canvas: mindmap for idea mapping, workflow for process flows, freeform for free design'
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'canvas_delete',
    description: 'Delete an existing canvas',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to delete' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_add_node',
    description: 'Add a node to an existing canvas. Nodes can be: idea, task, research, note, decision, source, process, analyze, output',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { 
          type: 'string', 
          enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output'],
          description: 'Type of node to add'
        },
        label: { type: 'string', description: 'Label/text for the node' },
        x: { type: 'number', description: 'X position (optional, auto-positioned if not provided)' },
        y: { type: 'number', description: 'Y position (optional, auto-positioned if not provided)' },
      },
      required: ['canvasId', 'nodeType', 'label'],
    },
  },
  {
    name: 'canvas_update_node',
    description: 'Update properties of an existing node',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeId: { type: 'string', description: 'ID of the node to update' },
        label: { type: 'string', description: 'New label for the node' },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
      },
      required: ['canvasId', 'nodeId'],
    },
  },
  {
    name: 'canvas_delete_node',
    description: 'Delete a node and all its connections from a canvas',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeId: { type: 'string', description: 'ID of the node to delete' },
      },
      required: ['canvasId', 'nodeId'],
    },
  },
  {
    name: 'canvas_add_connection',
    description: 'Add a connection/arrow between two nodes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        fromNodeId: { type: 'string', description: 'Source node ID' },
        toNodeId: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Optional label for the connection' },
        style: { type: 'string', enum: ['solid', 'dashed', 'arrow'], description: 'Connection style (default: arrow)' },
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId'],
    },
  },
  {
    name: 'canvas_delete_connection',
    description: 'Delete a connection from a canvas',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        connectionId: { type: 'string', description: 'ID of the connection to delete' },
      },
      required: ['canvasId', 'connectionId'],
    },
  },
  {
    name: 'canvas_export_svg',
    description: 'Export canvas as SVG vector graphic for presentations or documents',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to export' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_export_json',
    description: 'Export canvas as JSON data for persistence or transfer',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to export' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_layout_auto',
    description: 'Automatically arrange nodes using a layout algorithm (horizontal, vertical, radial, tree, grid)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        algorithm: { 
          type: 'string', 
          enum: ['horizontal', 'vertical', 'radial', 'tree', 'grid'],
          description: 'Layout algorithm to apply'
        },
      },
      required: ['canvasId', 'algorithm'],
    },
  },
  {
    name: 'canvas_list',
    description: 'List all canvases with their basic info',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'canvas_get',
    description: 'Get full details of a specific canvas including all nodes and connections',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to retrieve' },
      },
      required: ['canvasId'],
    },
  },
];

async function callDesignMcpApi(toolName: string, args: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}/api/design-mcp/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: toolName, arguments: args }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

async function main() {
  const server = new Server(
    { name: 'design-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await callDesignMcpApi(name, args as Record<string, unknown>);
      return {
        content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
        isError: result.isError,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
