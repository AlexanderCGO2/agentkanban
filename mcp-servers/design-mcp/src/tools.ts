import type { McpTool } from './types';

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'canvas_create',
    description: 'Create a new design canvas for mindmaps, workflows, or freeform design',
    inputSchema: {
      type: 'object',
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
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to delete' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_add_node',
    description: 'Add a node to an existing canvas. Nodes can represent ideas, tasks, research items, notes, or decisions.',
    inputSchema: {
      type: 'object',
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
      type: 'object',
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
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeId: { type: 'string', description: 'ID of the node to delete' },
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
        canvasId: { type: 'string', description: 'ID of the canvas' },
        fromNodeId: { type: 'string', description: 'Source node ID' },
        toNodeId: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Optional label for the connection' },
        style: { 
          type: 'string', 
          enum: ['solid', 'dashed', 'arrow'],
          description: 'Connection style (default: arrow)'
        },
      },
      required: ['canvasId', 'fromNodeId', 'toNodeId'],
    },
  },
  {
    name: 'canvas_delete_connection',
    description: 'Delete a connection from a canvas',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        connectionId: { type: 'string', description: 'ID of the connection to delete' },
      },
      required: ['canvasId', 'connectionId'],
    },
  },
  {
    name: 'canvas_export_svg',
    description: 'Export canvas as SVG vector graphic',
    inputSchema: {
      type: 'object',
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
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to export' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'canvas_import_json',
    description: 'Import canvas from JSON data',
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'JSON string containing canvas data' },
      },
      required: ['json'],
    },
  },
  {
    name: 'canvas_layout_auto',
    description: 'Automatically arrange nodes using a layout algorithm',
    inputSchema: {
      type: 'object',
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
    name: 'mindmap_create',
    description: 'Create a mindmap from a central topic and branches - quick way to generate a complete mindmap',
    inputSchema: {
      type: 'object',
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
    description: 'Add a new branch to an existing mindmap',
    inputSchema: {
      type: 'object',
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
    description: 'Create a research workflow from a template',
    inputSchema: {
      type: 'object',
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
    name: 'canvas_list',
    description: 'List all canvases with their basic info',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'canvas_get',
    description: 'Get full details of a specific canvas',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'ID of the canvas to retrieve' },
      },
      required: ['canvasId'],
    },
  },
];
