'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Type definitions for Fabric.js (will need fabric package installed)
export interface CanvasNode {
  id: string;
  type: 'idea' | 'task' | 'research' | 'note' | 'decision' | 'source' | 'process' | 'analyze' | 'output';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  style: 'solid' | 'dashed' | 'arrow';
}

export interface CanvasState {
  id?: string;
  name?: string;
  type: 'mindmap' | 'workflow' | 'freeform';
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport: { zoom: number; panX: number; panY: number };
}

export interface UseFabricCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  selectedNodeId: string | null;
  addNode: (node: Omit<CanvasNode, 'id'>) => string;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  addConnection: (connection: Omit<CanvasConnection, 'id'>) => string;
  removeConnection: (id: string) => void;
  selectNode: (id: string | null) => void;
  exportJSON: () => CanvasState;
  exportSVG: () => string;
  loadState: (state: CanvasState) => void;
  clear: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
}

// Node color schemes by type
const NODE_COLORS: Record<CanvasNode['type'], { bg: string; border: string; text: string }> = {
  idea: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  task: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  research: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  note: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  decision: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  source: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },
  process: { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce' },
  analyze: { bg: '#fef9c3', border: '#eab308', text: '#a16207' },
  output: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

/**
 * Custom hook for managing a Fabric.js canvas
 * This is a lightweight implementation that can be enhanced with full Fabric.js
 */
export function useFabricCanvas(): UseFabricCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    contextRef.current = ctx;

    // Set canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        render();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setIsReady(true);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Render function
  const render = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply viewport transformations
    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, viewport);

    // Draw connections
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      const toNode = nodes.find(n => n.id === conn.toNodeId);
      if (fromNode && toNode) {
        drawConnection(ctx, fromNode, toNode, conn);
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      drawNode(ctx, node, node.id === selectedNodeId);
    });

    ctx.restore();
  }, [nodes, connections, selectedNodeId, viewport]);

  // Re-render when state changes
  useEffect(() => {
    render();
  }, [render]);

  // Draw grid helper
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, vp: typeof viewport) => {
    const gridSize = 50;
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1;

    const startX = Math.floor(-vp.panX / vp.zoom / gridSize) * gridSize;
    const startY = Math.floor(-vp.panY / vp.zoom / gridSize) * gridSize;
    const endX = startX + width / vp.zoom + gridSize;
    const endY = startY + height / vp.zoom + gridSize;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  };

  // Draw node helper
  const drawNode = (ctx: CanvasRenderingContext2D, node: CanvasNode, selected: boolean) => {
    const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;
    const radius = 8;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Background
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(node.x, node.y, node.width, node.height, radius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.strokeStyle = selected ? '#6366f1' : colors.border;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();

    // Selection glow
    if (selected) {
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Text
    ctx.fillStyle = colors.text;
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Word wrap
    const maxWidth = node.width - 20;
    const words = node.label.split(' ');
    let lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    const lineHeight = 18;
    const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, node.x + node.width / 2, startY + i * lineHeight);
    });

    // Type indicator
    const typeIcons: Record<CanvasNode['type'], string> = {
      idea: '💡',
      task: '✓',
      research: '🔬',
      note: '📝',
      decision: '⚖️',
      source: '📥',
      process: '⚙️',
      analyze: '📊',
      output: '📤',
    };

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(typeIcons[node.type] || '•', node.x + 8, node.y + 16);
  };

  // Draw connection helper
  const drawConnection = (ctx: CanvasRenderingContext2D, from: CanvasNode, to: CanvasNode, conn: CanvasConnection) => {
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height / 2;
    const toX = to.x + to.width / 2;
    const toY = to.y + to.height / 2;

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;

    if (conn.style === 'dashed') {
      ctx.setLineDash([8, 4]);
    } else {
      ctx.setLineDash([]);
    }

    // Draw curved line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const curvature = 0.2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const ctrlX = midX - dy * curvature;
    const ctrlY = midY + dx * curvature;

    ctx.quadraticCurveTo(ctrlX, ctrlY, toX, toY);
    ctx.stroke();

    // Draw arrow if needed
    if (conn.style === 'arrow') {
      const angle = Math.atan2(toY - ctrlY, toX - ctrlX);
      const arrowLength = 12;
      const arrowAngle = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw label if present
    if (conn.label) {
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(conn.label, midX, midY - 10);
    }
  };

  // Add node
  const addNode = useCallback((node: Omit<CanvasNode, 'id'>): string => {
    const id = crypto.randomUUID();
    const newNode: CanvasNode = { ...node, id };
    setNodes(prev => [...prev, newNode]);
    return id;
  }, []);

  // Update node
  const updateNode = useCallback((id: string, updates: Partial<CanvasNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, []);

  // Remove node
  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [selectedNodeId]);

  // Add connection
  const addConnection = useCallback((connection: Omit<CanvasConnection, 'id'>): string => {
    const id = crypto.randomUUID();
    const newConnection: CanvasConnection = { ...connection, id };
    setConnections(prev => [...prev, newConnection]);
    return id;
  }, []);

  // Remove connection
  const removeConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  // Select node
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  // Export to JSON
  const exportJSON = useCallback((): CanvasState => {
    return {
      type: 'freeform',
      nodes,
      connections,
      viewport,
    };
  }, [nodes, connections, viewport]);

  // Export to SVG
  const exportSVG = useCallback((): string => {
    if (nodes.length === 0) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"></svg>';
    }

    const padding = 50;
    const minX = Math.min(...nodes.map(n => n.x)) - padding;
    const minY = Math.min(...nodes.map(n => n.y)) - padding;
    const maxX = Math.max(...nodes.map(n => n.x + n.width)) + padding;
    const maxY = Math.max(...nodes.map(n => n.y + n.height)) + padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">`;
    
    svg += `<style>
      .node-bg { rx: 8; ry: 8; }
      .node-text { font-family: Inter, system-ui, sans-serif; font-size: 14px; }
      .connection { fill: none; stroke-width: 2; }
    </style>`;

    // Draw connections
    connections.forEach(conn => {
      const from = nodes.find(n => n.id === conn.fromNodeId);
      const to = nodes.find(n => n.id === conn.toNodeId);
      if (from && to) {
        const fromX = from.x + from.width / 2;
        const fromY = from.y + from.height / 2;
        const toX = to.x + to.width / 2;
        const toY = to.y + to.height / 2;
        svg += `<line class="connection" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="#6366f1" />`;
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;
      svg += `<rect class="node-bg" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2" />`;
      svg += `<text class="node-text" x="${node.x + node.width / 2}" y="${node.y + node.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="${colors.text}">${escapeXml(node.label)}</text>`;
    });

    svg += '</svg>';
    return svg;
  }, [nodes, connections]);

  // Load state
  const loadState = useCallback((state: CanvasState) => {
    setNodes(state.nodes);
    setConnections(state.connections);
    setViewport(state.viewport);
    setSelectedNodeId(null);
  }, []);

  // Clear canvas
  const clear = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setSelectedNodeId(null);
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.3) }));
  }, []);

  const fitToScreen = useCallback(() => {
    if (nodes.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const padding = 50;
    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = canvas.width / contentWidth;
    const scaleY = canvas.height / contentHeight;
    const zoom = Math.min(scaleX, scaleY, 1);

    const panX = (canvas.width - contentWidth * zoom) / 2 - minX * zoom + padding * zoom;
    const panY = (canvas.height - contentHeight * zoom) / 2 - minY * zoom + padding * zoom;

    setViewport({ zoom, panX, panY });
  }, [nodes]);

  return {
    canvasRef,
    isReady,
    nodes,
    connections,
    selectedNodeId,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    selectNode,
    exportJSON,
    exportSVG,
    loadState,
    clear,
    zoomIn,
    zoomOut,
    fitToScreen,
  };
}

// Helper function
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
