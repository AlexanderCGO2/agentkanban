/**
 * MCP Tools Call Endpoint - Executes MCP tool requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import {
  getCanvas,
  saveCanvas,
  deleteCanvas,
  listCanvases,
  WORKFLOW_TEMPLATES,
  type CanvasData,
  type CanvasNode,
  type CanvasConnection,
  type NodeType,
  type CanvasType,
  type ConnectionStyle,
} from '@/lib/canvas-store';

// Node color schemes for SVG export
const NODE_COLORS: Record<NodeType, { bg: string; border: string }> = {
  idea: { bg: '#fef3c7', border: '#f59e0b' },
  task: { bg: '#dbeafe', border: '#3b82f6' },
  research: { bg: '#ede9fe', border: '#8b5cf6' },
  note: { bg: '#dcfce7', border: '#22c55e' },
  decision: { bg: '#fce7f3', border: '#ec4899' },
  source: { bg: '#e0f2fe', border: '#0ea5e9' },
  process: { bg: '#f3e8ff', border: '#a855f7' },
  analyze: { bg: '#fef9c3', border: '#eab308' },
  output: { bg: '#d1fae5', border: '#10b981' },
};

interface McpToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

interface McpToolCallResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as McpToolCallRequest;
  const { name, arguments: args } = body;

  try {
    let response: McpToolCallResponse;

    switch (name) {
      case 'canvas_create':
        response = await handleCanvasCreate(args as { name: string; type: CanvasType });
        break;
      case 'canvas_delete':
        response = await handleCanvasDelete(args as { canvasId: string });
        break;
      case 'canvas_add_node':
        response = await handleCanvasAddNode(args as { canvasId: string; nodeType: NodeType; label: string; x?: number; y?: number });
        break;
      case 'canvas_update_node':
        response = await handleCanvasUpdateNode(args as { canvasId: string; nodeId: string; label?: string; x?: number; y?: number });
        break;
      case 'canvas_delete_node':
        response = await handleCanvasDeleteNode(args as { canvasId: string; nodeId: string });
        break;
      case 'canvas_add_connection':
        response = await handleCanvasAddConnection(args as { canvasId: string; fromNodeId: string; toNodeId: string; label?: string; style?: ConnectionStyle });
        break;
      case 'canvas_export_svg':
        response = await handleCanvasExportSvg(args as { canvasId: string });
        break;
      case 'canvas_export_json':
        response = await handleCanvasExportJson(args as { canvasId: string });
        break;
      case 'canvas_layout_auto':
        response = await handleCanvasLayoutAuto(args as { canvasId: string; algorithm: string });
        break;
      case 'mindmap_create':
        response = await handleMindmapCreate(args as { name: string; centralTopic: string; branches: string[] });
        break;
      case 'mindmap_add_branch':
        response = await handleMindmapAddBranch(args as { canvasId: string; parentNodeId: string; branchTopics: string[] });
        break;
      case 'workflow_create':
        response = await handleWorkflowCreate(args as { name: string; template: string; customSteps?: string[] });
        break;
      case 'canvas_list':
        response = await handleCanvasList();
        break;
      case 'canvas_get':
        response = await handleCanvasGet(args as { canvasId: string });
        break;
      default:
        response = { content: [{ type: 'text', text: `❌ Unknown tool: ${name}` }], isError: true };
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      content: [{ type: 'text', text: `❌ Error: ${message}` }],
      isError: true,
    }, { status: 500 });
  }
}

// Handler implementations

async function handleCanvasCreate(args: { name: string; type: CanvasType }): Promise<McpToolCallResponse> {
  const id = uuid();
  const canvas: CanvasData = {
    id,
    name: args.name,
    type: args.type,
    nodes: [],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveCanvas(canvas);
  return {
    content: [{ type: 'text', text: `✅ Created ${args.type} canvas "${args.name}"\n\nCanvas ID: ${id}` }],
  };
}

async function handleCanvasDelete(args: { canvasId: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  await deleteCanvas(args.canvasId);
  return { content: [{ type: 'text', text: `✅ Deleted canvas "${canvas.name}"` }] };
}

async function handleCanvasAddNode(args: { canvasId: string; nodeType: NodeType; label: string; x?: number; y?: number }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const nodeId = uuid();
  const node: CanvasNode = {
    id: nodeId,
    type: args.nodeType,
    label: args.label,
    x: args.x ?? (canvas.nodes.length % 4) * 200 + 100,
    y: args.y ?? Math.floor(canvas.nodes.length / 4) * 120 + 100,
    width: 160,
    height: 80,
  };
  canvas.nodes.push(node);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);
  return { content: [{ type: 'text', text: `✅ Added ${args.nodeType} node "${args.label}"\n\nNode ID: ${nodeId}` }] };
}

async function handleCanvasUpdateNode(args: { canvasId: string; nodeId: string; label?: string; x?: number; y?: number }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const node = canvas.nodes.find(n => n.id === args.nodeId);
  if (!node) {
    return { content: [{ type: 'text', text: `❌ Node not found: ${args.nodeId}` }], isError: true };
  }
  if (args.label !== undefined) node.label = args.label;
  if (args.x !== undefined) node.x = args.x;
  if (args.y !== undefined) node.y = args.y;
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);
  return { content: [{ type: 'text', text: `✅ Updated node "${node.label}"` }] };
}

async function handleCanvasDeleteNode(args: { canvasId: string; nodeId: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const nodeIndex = canvas.nodes.findIndex(n => n.id === args.nodeId);
  if (nodeIndex === -1) {
    return { content: [{ type: 'text', text: `❌ Node not found: ${args.nodeId}` }], isError: true };
  }
  const deletedNode = canvas.nodes[nodeIndex];
  canvas.nodes.splice(nodeIndex, 1);
  canvas.connections = canvas.connections.filter(c => c.fromNodeId !== args.nodeId && c.toNodeId !== args.nodeId);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);
  return { content: [{ type: 'text', text: `✅ Deleted node "${deletedNode.label}"` }] };
}

async function handleCanvasAddConnection(args: { canvasId: string; fromNodeId: string; toNodeId: string; label?: string; style?: ConnectionStyle }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const fromNode = canvas.nodes.find(n => n.id === args.fromNodeId);
  const toNode = canvas.nodes.find(n => n.id === args.toNodeId);
  if (!fromNode || !toNode) {
    return { content: [{ type: 'text', text: `❌ One or both nodes not found` }], isError: true };
  }
  const connection: CanvasConnection = {
    id: uuid(),
    fromNodeId: args.fromNodeId,
    toNodeId: args.toNodeId,
    label: args.label,
    style: args.style ?? 'arrow',
  };
  canvas.connections.push(connection);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);
  return { content: [{ type: 'text', text: `✅ Connected "${fromNode.label}" → "${toNode.label}"` }] };
}

async function handleCanvasExportSvg(args: { canvasId: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const svg = generateSVG(canvas);
  return { content: [{ type: 'text', text: `✅ SVG exported for "${canvas.name}"\n\n\`\`\`svg\n${svg}\n\`\`\`` }] };
}

async function handleCanvasExportJson(args: { canvasId: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  return { content: [{ type: 'text', text: `✅ JSON export for "${canvas.name}"\n\n\`\`\`json\n${JSON.stringify(canvas, null, 2)}\n\`\`\`` }] };
}

async function handleCanvasLayoutAuto(args: { canvasId: string; algorithm: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  applyLayout(canvas, args.algorithm);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);
  return { content: [{ type: 'text', text: `✅ Applied ${args.algorithm} layout to "${canvas.name}"` }] };
}

async function handleMindmapCreate(args: { name: string; centralTopic: string; branches: string[] }): Promise<McpToolCallResponse> {
  const id = uuid();
  const centerX = 400;
  const centerY = 300;
  const radius = 250;

  const centralNode: CanvasNode = {
    id: uuid(),
    type: 'idea',
    label: args.centralTopic,
    x: centerX - 100,
    y: centerY - 50,
    width: 200,
    height: 100,
  };

  const branchNodes: CanvasNode[] = args.branches.map((branch, idx) => {
    const angle = (2 * Math.PI * idx) / args.branches.length - Math.PI / 2;
    return {
      id: uuid(),
      type: 'idea' as NodeType,
      label: branch,
      x: centerX + radius * Math.cos(angle) - 75,
      y: centerY + radius * Math.sin(angle) - 35,
      width: 150,
      height: 70,
    };
  });

  const connections: CanvasConnection[] = branchNodes.map(node => ({
    id: uuid(),
    fromNodeId: centralNode.id,
    toNodeId: node.id,
    style: 'solid' as ConnectionStyle,
  }));

  const canvas: CanvasData = {
    id,
    name: args.name,
    type: 'mindmap',
    nodes: [centralNode, ...branchNodes],
    connections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveCanvas(canvas);
  return {
    content: [{
      type: 'text',
      text: `✅ Created mindmap "${args.name}"\n\nCanvas ID: ${id}\nCentral Topic: "${args.centralTopic}"\nBranches: ${args.branches.length}\n\n${args.branches.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}`,
    }],
  };
}

async function handleMindmapAddBranch(args: { canvasId: string; parentNodeId: string; branchTopics: string[] }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const parentNode = canvas.nodes.find(n => n.id === args.parentNodeId);
  if (!parentNode) {
    return { content: [{ type: 'text', text: `❌ Parent node not found: ${args.parentNodeId}` }], isError: true };
  }

  const existingChildCount = canvas.connections.filter(c => c.fromNodeId === args.parentNodeId).length;
  const baseAngle = Math.PI / 4;
  const angleStep = Math.PI / 6;
  const branchRadius = 180;

  const newNodes: CanvasNode[] = args.branchTopics.map((topic, idx) => {
    const angle = baseAngle + (existingChildCount + idx) * angleStep;
    return {
      id: uuid(),
      type: 'idea' as NodeType,
      label: topic,
      x: parentNode.x + parentNode.width / 2 + branchRadius * Math.cos(angle) - 60,
      y: parentNode.y + parentNode.height / 2 + branchRadius * Math.sin(angle) - 30,
      width: 120,
      height: 60,
    };
  });

  const newConnections: CanvasConnection[] = newNodes.map(node => ({
    id: uuid(),
    fromNodeId: args.parentNodeId,
    toNodeId: node.id,
    style: 'solid' as ConnectionStyle,
  }));

  canvas.nodes.push(...newNodes);
  canvas.connections.push(...newConnections);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Added ${args.branchTopics.length} branches to "${parentNode.label}"\n\n${args.branchTopics.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`,
    }],
  };
}

async function handleWorkflowCreate(args: { name: string; template: string; customSteps?: string[] }): Promise<McpToolCallResponse> {
  const id = uuid();
  let steps: { type: NodeType; title: string; description: string }[];

  if (args.template === 'custom' && args.customSteps) {
    steps = args.customSteps.map((title, idx) => ({
      type: (idx === 0 ? 'source' : idx === args.customSteps!.length - 1 ? 'output' : 'process') as NodeType,
      title,
      description: '',
    }));
  } else {
    const template = WORKFLOW_TEMPLATES[args.template];
    if (!template) {
      return { content: [{ type: 'text', text: `❌ Unknown template: ${args.template}` }], isError: true };
    }
    steps = template.steps;
  }

  const startX = 100;
  const startY = 150;
  const stepWidth = 180;
  const stepGap = 60;

  const nodes: CanvasNode[] = steps.map((step, idx) => ({
    id: uuid(),
    type: step.type,
    label: `${step.title}\n${step.description}`,
    x: startX + idx * (stepWidth + stepGap),
    y: startY,
    width: stepWidth,
    height: 100,
  }));

  const connections: CanvasConnection[] = nodes.slice(1).map((node, idx) => ({
    id: uuid(),
    fromNodeId: nodes[idx].id,
    toNodeId: node.id,
    style: 'arrow' as ConnectionStyle,
  }));

  const canvas: CanvasData = {
    id,
    name: args.name,
    type: 'workflow',
    nodes,
    connections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveCanvas(canvas);
  return {
    content: [{
      type: 'text',
      text: `✅ Created workflow "${args.name}" from ${args.template} template\n\nCanvas ID: ${id}\nSteps: ${steps.length}\n\n${steps.map((s, i) => `  ${i + 1}. ${s.title}`).join('\n')}`,
    }],
  };
}

async function handleCanvasList(): Promise<McpToolCallResponse> {
  const canvases = await listCanvases();
  if (canvases.length === 0) {
    return { content: [{ type: 'text', text: `📋 No canvases found.\n\nCreate one using mindmap_create or workflow_create.` }] };
  }
  const list = canvases.map(c =>
    `• **${c.name}** (${c.type})\n  ID: ${c.id}\n  Nodes: ${c.nodes.length} | Connections: ${c.connections.length}`
  ).join('\n\n');
  return { content: [{ type: 'text', text: `📋 **${canvases.length} Canvas${canvases.length !== 1 ? 'es' : ''}**\n\n${list}` }] };
}

async function handleCanvasGet(args: { canvasId: string }): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(args.canvasId);
  if (!canvas) {
    return { content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }], isError: true };
  }
  const nodeList = canvas.nodes.map(n => `  • [${n.type}] "${n.label}"`).join('\n');
  const connList = canvas.connections.map(c => {
    const from = canvas.nodes.find(n => n.id === c.fromNodeId)?.label || '?';
    const to = canvas.nodes.find(n => n.id === c.toNodeId)?.label || '?';
    return `  • "${from}" → "${to}"`;
  }).join('\n');
  return {
    content: [{
      type: 'text',
      text: `📊 **${canvas.name}** (${canvas.type})\n\nID: ${canvas.id}\n\n**Nodes (${canvas.nodes.length}):**\n${nodeList || '  (none)'}\n\n**Connections (${canvas.connections.length}):**\n${connList || '  (none)'}`,
    }],
  };
}

// Helper: Generate SVG
function generateSVG(canvas: CanvasData): string {
  if (canvas.nodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><text x="400" y="300" text-anchor="middle" fill="#666">Empty Canvas</text></svg>';
  }
  const padding = 50;
  const minX = Math.min(...canvas.nodes.map(n => n.x)) - padding;
  const minY = Math.min(...canvas.nodes.map(n => n.y)) - padding;
  const maxX = Math.max(...canvas.nodes.map(n => n.x + n.width)) + padding;
  const maxY = Math.max(...canvas.nodes.map(n => n.y + n.height)) + padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">`;
  svg += `<style>.node-rect{rx:8;ry:8}.node-text{font-family:Inter,system-ui,sans-serif;font-size:12px}.conn-line{fill:none;stroke:#6366f1;stroke-width:2}</style>`;

  for (const conn of canvas.connections) {
    const from = canvas.nodes.find(n => n.id === conn.fromNodeId);
    const to = canvas.nodes.find(n => n.id === conn.toNodeId);
    if (from && to) {
      svg += `<line class="conn-line" x1="${from.x + from.width / 2}" y1="${from.y + from.height / 2}" x2="${to.x + to.width / 2}" y2="${to.y + to.height / 2}"${conn.style === 'dashed' ? ' stroke-dasharray="5,5"' : ''}/>`;
    }
  }

  for (const node of canvas.nodes) {
    const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;
    svg += `<rect class="node-rect" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>`;
    const lines = node.label.split('\n');
    const lineHeight = 16;
    const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => {
      svg += `<text class="node-text" x="${node.x + node.width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle" fill="#1f2937">${escapeXml(line)}</text>`;
    });
  }

  svg += '</svg>';
  return svg;
}

// Helper: Apply layout
function applyLayout(canvas: CanvasData, algorithm: string): void {
  const startX = 100, startY = 100, gapX = 220, gapY = 120;
  switch (algorithm) {
    case 'horizontal':
      canvas.nodes.forEach((node, idx) => { node.x = startX + idx * gapX; node.y = startY; });
      break;
    case 'vertical':
      canvas.nodes.forEach((node, idx) => { node.x = startX; node.y = startY + idx * gapY; });
      break;
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(canvas.nodes.length));
      canvas.nodes.forEach((node, idx) => { node.x = startX + (idx % cols) * gapX; node.y = startY + Math.floor(idx / cols) * gapY; });
      break;
    }
    case 'radial': {
      if (canvas.nodes.length === 0) break;
      const centerX = 400, centerY = 300, radius = 200;
      canvas.nodes[0].x = centerX - canvas.nodes[0].width / 2;
      canvas.nodes[0].y = centerY - canvas.nodes[0].height / 2;
      canvas.nodes.slice(1).forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / (canvas.nodes.length - 1) - Math.PI / 2;
        node.x = centerX + radius * Math.cos(angle) - node.width / 2;
        node.y = centerY + radius * Math.sin(angle) - node.height / 2;
      });
      break;
    }
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
