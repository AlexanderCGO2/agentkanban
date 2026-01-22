/**
 * MCP Tools List Endpoint
 */

import { NextResponse } from 'next/server';

const MCP_TOOLS = [
  {
    name: 'canvas_create',
    description: 'Create a new design canvas for mindmaps, workflows, or freeform design',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { type: 'string', enum: ['mindmap', 'workflow', 'freeform'], description: 'Type of canvas' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'canvas_delete',
    description: 'Delete an existing canvas',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to delete' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_add_node',
    description: 'Add a node to an existing canvas',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { type: 'string', enum: ['idea', 'task', 'research', 'note', 'decision', 'source', 'process', 'analyze', 'output'] },
        label: { type: 'string', description: 'Label/text for the node' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
      },
      required: ['canvasId', 'nodeType', 'label'],
    },
  },
  {
    name: 'canvas_update_node',
    description: 'Update properties of an existing node',
    inputSchema: {
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
  {
    name: 'canvas_delete_node',
    description: 'Delete a node and its connections',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        nodeId: { type: 'string' },
      },
      required: ['canvasId', 'nodeId'],
    },
  },
  {
    name: 'canvas_add_connection',
    description: 'Add a connection between two nodes',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        fromNodeId: { type: 'string' },
        toNodeId: { type: 'string' },
        label: { type: 'string' },
        style: { type: 'string', enum: ['solid', 'dashed', 'arrow'] },
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId'],
    },
  },
  {
    name: 'canvas_export_svg',
    description: 'Export canvas as SVG',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_export_json',
    description: 'Export canvas as JSON',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_layout_auto',
    description: 'Auto-arrange nodes using a layout algorithm',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        algorithm: { type: 'string', enum: ['horizontal', 'vertical', 'radial', 'tree', 'grid'] },
      },
      required: ['canvasId', 'algorithm'],
    },
  },
  {
    name: 'mindmap_create',
    description: 'Create a mindmap from a central topic and branches',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        centralTopic: { type: 'string' },
        branches: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'centralTopic', 'branches'],
    },
  },
  {
    name: 'mindmap_add_branch',
    description: 'Add branches to an existing mindmap',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
        parentNodeId: { type: 'string' },
        branchTopics: { type: 'array', items: { type: 'string' } },
      },
      required: ['canvasId', 'parentNodeId', 'branchTopics'],
    },
  },
  {
    name: 'workflow_create',
    description: 'Create a research workflow from a template',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        template: { type: 'string', enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis', 'custom'] },
        customSteps: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'template'],
    },
  },
  {
    name: 'canvas_list',
    description: 'List all canvases',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'canvas_get',
    description: 'Get full details of a canvas',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string' },
      },
      required: ['canvasId'],
    },
  },
];

export async function GET() {
  return NextResponse.json({ tools: MCP_TOOLS });
}
