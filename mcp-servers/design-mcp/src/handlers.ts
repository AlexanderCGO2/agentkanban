import type { CanvasData, CanvasNode, CanvasConnection, McpToolCallResponse, Env, NodeType, ConnectionStyle, CanvasType } from './types';
import { WORKFLOW_TEMPLATES } from './templates';

// Node color schemes
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

// Helper to generate UUIDs
function uuid(): string {
  return crypto.randomUUID();
}

// Helper to get canvas from KV
async function getCanvas(env: Env, canvasId: string): Promise<CanvasData | null> {
  const data = await env.CANVAS_KV.get(`canvas:${canvasId}`);
  return data ? JSON.parse(data) : null;
}

// Helper to save canvas to KV
async function saveCanvas(env: Env, canvas: CanvasData): Promise<void> {
  await env.CANVAS_KV.put(`canvas:${canvas.id}`, JSON.stringify(canvas));
}

// Helper to delete canvas from KV
async function deleteCanvas(env: Env, canvasId: string): Promise<void> {
  await env.CANVAS_KV.delete(`canvas:${canvasId}`);
}

// Helper to list all canvas IDs
async function listCanvasIds(env: Env): Promise<string[]> {
  const list = await env.CANVAS_KV.list({ prefix: 'canvas:' });
  return list.keys.map((key: { name: string }) => key.name.replace('canvas:', ''));
}

// Tool Handlers

export async function handleCanvasCreate(
  args: { name: string; type: CanvasType },
  env: Env
): Promise<McpToolCallResponse> {
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

  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Created ${args.type} canvas "${args.name}"\n\nCanvas ID: ${id}\n\nYou can now add nodes using canvas_add_node or create a complete structure using mindmap_create/workflow_create.`,
    }],
  };
}

export async function handleCanvasDelete(
  args: { canvasId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  await deleteCanvas(env, args.canvasId);

  return {
    content: [{
      type: 'text',
      text: `✅ Deleted canvas "${canvas.name}" (${args.canvasId})`,
    }],
  };
}

export async function handleCanvasAddNode(
  args: { canvasId: string; nodeType: NodeType; label: string; x?: number; y?: number },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
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
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Added ${args.nodeType} node "${args.label}"\n\nNode ID: ${nodeId}\nPosition: (${node.x}, ${node.y})`,
    }],
  };
}

export async function handleCanvasUpdateNode(
  args: { canvasId: string; nodeId: string; label?: string; x?: number; y?: number },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const nodeIndex = canvas.nodes.findIndex(n => n.id === args.nodeId);
  if (nodeIndex === -1) {
    return {
      content: [{ type: 'text', text: `❌ Node not found: ${args.nodeId}` }],
      isError: true,
    };
  }

  if (args.label !== undefined) canvas.nodes[nodeIndex].label = args.label;
  if (args.x !== undefined) canvas.nodes[nodeIndex].x = args.x;
  if (args.y !== undefined) canvas.nodes[nodeIndex].y = args.y;

  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Updated node "${canvas.nodes[nodeIndex].label}"`,
    }],
  };
}

export async function handleCanvasDeleteNode(
  args: { canvasId: string; nodeId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const nodeIndex = canvas.nodes.findIndex(n => n.id === args.nodeId);
  if (nodeIndex === -1) {
    return {
      content: [{ type: 'text', text: `❌ Node not found: ${args.nodeId}` }],
      isError: true,
    };
  }

  const deletedNode = canvas.nodes[nodeIndex];
  canvas.nodes.splice(nodeIndex, 1);
  canvas.connections = canvas.connections.filter(
    c => c.fromNodeId !== args.nodeId && c.toNodeId !== args.nodeId
  );
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Deleted node "${deletedNode.label}" and its connections`,
    }],
  };
}

export async function handleCanvasAddConnection(
  args: { canvasId: string; fromNodeId: string; toNodeId: string; label?: string; style?: ConnectionStyle },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const fromNode = canvas.nodes.find(n => n.id === args.fromNodeId);
  const toNode = canvas.nodes.find(n => n.id === args.toNodeId);

  if (!fromNode || !toNode) {
    return {
      content: [{ type: 'text', text: `❌ One or both nodes not found` }],
      isError: true,
    };
  }

  const connectionId = uuid();
  const connection: CanvasConnection = {
    id: connectionId,
    fromNodeId: args.fromNodeId,
    toNodeId: args.toNodeId,
    label: args.label,
    style: args.style ?? 'arrow',
  };

  canvas.connections.push(connection);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Connected "${fromNode.label}" → "${toNode.label}"${args.label ? ` (${args.label})` : ''}`,
    }],
  };
}

export async function handleCanvasDeleteConnection(
  args: { canvasId: string; connectionId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const connIndex = canvas.connections.findIndex(c => c.id === args.connectionId);
  if (connIndex === -1) {
    return {
      content: [{ type: 'text', text: `❌ Connection not found: ${args.connectionId}` }],
      isError: true,
    };
  }

  canvas.connections.splice(connIndex, 1);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(env, canvas);

  return {
    content: [{ type: 'text', text: `✅ Connection deleted` }],
  };
}

export async function handleCanvasExportSvg(
  args: { canvasId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const svg = generateSVG(canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ SVG exported for "${canvas.name}"\n\n\`\`\`svg\n${svg}\n\`\`\``,
    }],
  };
}

export async function handleCanvasExportJson(
  args: { canvasId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  return {
    content: [{
      type: 'text',
      text: `✅ JSON export for "${canvas.name}"\n\n\`\`\`json\n${JSON.stringify(canvas, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleCanvasImportJson(
  args: { json: string },
  env: Env
): Promise<McpToolCallResponse> {
  try {
    const imported = JSON.parse(args.json) as CanvasData;
    
    // Generate new ID to avoid conflicts
    const newId = uuid();
    const canvas: CanvasData = {
      ...imported,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveCanvas(env, canvas);

    return {
      content: [{
        type: 'text',
        text: `✅ Imported canvas "${canvas.name}"\n\nNew Canvas ID: ${newId}\nNodes: ${canvas.nodes.length}\nConnections: ${canvas.connections.length}`,
      }],
    };
  } catch {
    return {
      content: [{ type: 'text', text: `❌ Invalid JSON format` }],
      isError: true,
    };
  }
}

export async function handleCanvasLayoutAuto(
  args: { canvasId: string; algorithm: 'horizontal' | 'vertical' | 'radial' | 'tree' | 'grid' },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  applyLayout(canvas, args.algorithm);
  canvas.updatedAt = new Date().toISOString();
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Applied ${args.algorithm} layout to "${canvas.name}"`,
    }],
  };
}

export async function handleMindmapCreate(
  args: { name: string; centralTopic: string; branches: string[] },
  env: Env
): Promise<McpToolCallResponse> {
  const id = uuid();
  const centerX = 400;
  const centerY = 300;
  const radius = 250;

  // Create central node
  const centralNode: CanvasNode = {
    id: uuid(),
    type: 'idea',
    label: args.centralTopic,
    x: centerX - 100,
    y: centerY - 50,
    width: 200,
    height: 100,
  };

  // Create branch nodes in a radial layout
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

  // Create connections from center to branches
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

  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Created mindmap "${args.name}"\n\nCanvas ID: ${id}\nCentral Topic: "${args.centralTopic}"\nBranches: ${args.branches.length}\n\nBranch topics:\n${args.branches.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}`,
    }],
  };
}

export async function handleMindmapAddBranch(
  args: { canvasId: string; parentNodeId: string; branchTopics: string[] },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const parentNode = canvas.nodes.find(n => n.id === args.parentNodeId);
  if (!parentNode) {
    return {
      content: [{ type: 'text', text: `❌ Parent node not found: ${args.parentNodeId}` }],
      isError: true,
    };
  }

  // Calculate positions for new branches
  const existingChildCount = canvas.connections.filter(c => c.fromNodeId === args.parentNodeId).length;
  const baseAngle = Math.PI / 4; // Start angle offset
  const angleStep = Math.PI / 6; // Angle between branches
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
  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Added ${args.branchTopics.length} branches to "${parentNode.label}"\n\nNew branches:\n${args.branchTopics.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`,
    }],
  };
}

export async function handleWorkflowCreate(
  args: { name: string; template: string; customSteps?: string[] },
  env: Env
): Promise<McpToolCallResponse> {
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
      return {
        content: [{ type: 'text', text: `❌ Unknown template: ${args.template}` }],
        isError: true,
      };
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

  await saveCanvas(env, canvas);

  return {
    content: [{
      type: 'text',
      text: `✅ Created workflow "${args.name}" from ${args.template} template\n\nCanvas ID: ${id}\nSteps: ${steps.length}\n\nWorkflow steps:\n${steps.map((s, i) => `  ${i + 1}. ${s.title}`).join('\n')}`,
    }],
  };
}

export async function handleCanvasList(env: Env): Promise<McpToolCallResponse> {
  const canvasIds = await listCanvasIds(env);
  
  if (canvasIds.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `📋 No canvases found.\n\nCreate one using:\n- canvas_create: Empty canvas\n- mindmap_create: Quick mindmap from topics\n- workflow_create: Research workflow from template`,
      }],
    };
  }

  const canvases: CanvasData[] = [];
  for (const id of canvasIds) {
    const canvas = await getCanvas(env, id);
    if (canvas) canvases.push(canvas);
  }

  const list = canvases.map(c => 
    `• **${c.name}** (${c.type})\n  ID: ${c.id}\n  Nodes: ${c.nodes.length} | Connections: ${c.connections.length}\n  Updated: ${c.updatedAt}`
  ).join('\n\n');

  return {
    content: [{
      type: 'text',
      text: `📋 **${canvases.length} Canvas${canvases.length !== 1 ? 'es' : ''}**\n\n${list}`,
    }],
  };
}

export async function handleCanvasGet(
  args: { canvasId: string },
  env: Env
): Promise<McpToolCallResponse> {
  const canvas = await getCanvas(env, args.canvasId);
  if (!canvas) {
    return {
      content: [{ type: 'text', text: `❌ Canvas not found: ${args.canvasId}` }],
      isError: true,
    };
  }

  const nodeList = canvas.nodes.map(n => `  • [${n.type}] "${n.label}" (${n.id.slice(0, 8)}...)`).join('\n');
  const connList = canvas.connections.map(c => {
    const from = canvas.nodes.find(n => n.id === c.fromNodeId)?.label || '?';
    const to = canvas.nodes.find(n => n.id === c.toNodeId)?.label || '?';
    return `  • "${from}" → "${to}"${c.label ? ` (${c.label})` : ''}`;
  }).join('\n');

  return {
    content: [{
      type: 'text',
      text: `📊 **${canvas.name}** (${canvas.type})\n\nID: ${canvas.id}\nCreated: ${canvas.createdAt}\nUpdated: ${canvas.updatedAt}\n\n**Nodes (${canvas.nodes.length}):**\n${nodeList || '  (none)'}\n\n**Connections (${canvas.connections.length}):**\n${connList || '  (none)'}`,
    }],
  };
}

// Helper: Generate SVG from canvas
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
  
  // Styles
  svg += `<style>
    .node-rect { rx: 8; ry: 8; }
    .node-text { font-family: Inter, system-ui, sans-serif; font-size: 12px; }
    .conn-line { fill: none; stroke: #6366f1; stroke-width: 2; }
    .conn-arrow { fill: #6366f1; }
  </style>`;

  // Draw connections
  for (const conn of canvas.connections) {
    const from = canvas.nodes.find(n => n.id === conn.fromNodeId);
    const to = canvas.nodes.find(n => n.id === conn.toNodeId);
    if (from && to) {
      const fromX = from.x + from.width / 2;
      const fromY = from.y + from.height / 2;
      const toX = to.x + to.width / 2;
      const toY = to.y + to.height / 2;
      
      svg += `<line class="conn-line" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}"`;
      if (conn.style === 'dashed') svg += ` stroke-dasharray="5,5"`;
      svg += ` />`;

      // Arrow head
      if (conn.style === 'arrow') {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowLen = 10;
        const arrowAngle = Math.PI / 6;
        svg += `<polygon class="conn-arrow" points="${toX},${toY} ${toX - arrowLen * Math.cos(angle - arrowAngle)},${toY - arrowLen * Math.sin(angle - arrowAngle)} ${toX - arrowLen * Math.cos(angle + arrowAngle)},${toY - arrowLen * Math.sin(angle + arrowAngle)}" />`;
      }
    }
  }

  // Draw nodes
  for (const node of canvas.nodes) {
    const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;
    svg += `<rect class="node-rect" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2" />`;
    
    // Multi-line text support
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

// Helper: Apply layout algorithm
function applyLayout(canvas: CanvasData, algorithm: string): void {
  const startX = 100;
  const startY = 100;
  const gapX = 220;
  const gapY = 120;

  switch (algorithm) {
    case 'horizontal':
      canvas.nodes.forEach((node, idx) => {
        node.x = startX + idx * gapX;
        node.y = startY;
      });
      break;

    case 'vertical':
      canvas.nodes.forEach((node, idx) => {
        node.x = startX;
        node.y = startY + idx * gapY;
      });
      break;

    case 'grid': {
      const cols = Math.ceil(Math.sqrt(canvas.nodes.length));
      canvas.nodes.forEach((node, idx) => {
        node.x = startX + (idx % cols) * gapX;
        node.y = startY + Math.floor(idx / cols) * gapY;
      });
      break;
    }

    case 'radial': {
      const centerX = 400;
      const centerY = 300;
      if (canvas.nodes.length === 0) break;
      
      canvas.nodes[0].x = centerX - canvas.nodes[0].width / 2;
      canvas.nodes[0].y = centerY - canvas.nodes[0].height / 2;
      
      const radius = 200;
      canvas.nodes.slice(1).forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / (canvas.nodes.length - 1) - Math.PI / 2;
        node.x = centerX + radius * Math.cos(angle) - node.width / 2;
        node.y = centerY + radius * Math.sin(angle) - node.height / 2;
      });
      break;
    }

    case 'tree': {
      // Simple tree layout (BFS from first node or nodes without incoming connections)
      const roots = canvas.nodes.filter(n => 
        !canvas.connections.some(c => c.toNodeId === n.id)
      );
      
      if (roots.length === 0 && canvas.nodes.length > 0) {
        roots.push(canvas.nodes[0]);
      }

      let currentY = startY;
      const visited = new Set<string>();
      const queue: { node: CanvasNode; depth: number }[] = roots.map(n => ({ node: n, depth: 0 }));

      const nodesByDepth: Map<number, CanvasNode[]> = new Map();

      while (queue.length > 0) {
        const { node, depth } = queue.shift()!;
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        if (!nodesByDepth.has(depth)) nodesByDepth.set(depth, []);
        nodesByDepth.get(depth)!.push(node);

        // Add children
        const children = canvas.connections
          .filter(c => c.fromNodeId === node.id)
          .map(c => canvas.nodes.find(n => n.id === c.toNodeId))
          .filter((n): n is CanvasNode => n !== undefined && !visited.has(n.id));

        for (const child of children) {
          queue.push({ node: child, depth: depth + 1 });
        }
      }

      // Position nodes by depth
      for (const [depth, nodes] of nodesByDepth) {
        nodes.forEach((node, idx) => {
          node.x = startX + depth * gapX;
          node.y = startY + idx * gapY;
        });
      }
      break;
    }
  }
}

// Helper: Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
