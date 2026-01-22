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

const API_BASE_URL = process.env.DESIGN_MCP_URL || 'http://localhost:3000';

// Tool definitions
const TOOLS = [
  {
    name: 'canvas_create',
    description: 'Create a new design canvas for mindmaps, workflows, or freeform design',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { 
          type: 'string', 
          enum: ['mindmap', 'workflow', 'freeform'],
          description: 'Type of canvas'
        },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'canvas_add_node',
    description: 'Add a node to an existing canvas',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { 
          type: 'string', 
          enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output'],
          description: 'Type of node'
        },
        label: { type: 'string', description: 'Label for the node' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
      },
      required: ['canvasId', 'nodeType', 'label'],
    },
  },
  {
    name: 'canvas_add_connection',
    description: 'Add a connection between two nodes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        fromNodeId: { type: 'string', description: 'Source node ID' },
        toNodeId: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Connection label (optional)' },
        style: { type: 'string', enum: ['solid', 'dashed', 'arrow'], description: 'Connection style' },
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId'],
    },
  },
  {
    name: 'mindmap_create',
    description: 'Create a mindmap from a central topic and branches',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the mindmap' },
        centralTopic: { type: 'string', description: 'Central topic' },
        branches: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Branch topics'
        },
      },
      required: ['name', 'centralTopic', 'branches'],
    },
  },
  {
    name: 'workflow_create',
    description: 'Create a workflow from a template',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the workflow' },
        template: { 
          type: 'string', 
          enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis', 'custom'],
          description: 'Workflow template'
        },
        customSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Custom steps (if template is "custom")'
        },
      },
      required: ['name', 'template'],
    },
  },
  {
    name: 'canvas_export_svg',
    description: 'Export canvas as SVG vector graphic',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_list',
    description: 'List all canvases',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'canvas_get',
    description: 'Get details of a specific canvas',
    inputSchema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
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
