'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface CanvasNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string;
  imageData?: string;
  // Styling properties
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  style: string;
  color?: string;
}

interface CanvasData {
  id: string;
  name: string;
  type: string;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  createdAt: string;
  updatedAt: string;
}

interface EditableCanvasProps {
  canvas: CanvasData;
  onSave?: (canvas: CanvasData) => void;
  onClose?: () => void;
}

type DragMode = 'none' | 'pan' | 'move' | 'resize';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  idea: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  task: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  research: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  note: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  decision: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  source: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },
  process: { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce' },
  analyze: { bg: '#fef9c3', border: '#eab308', text: '#a16207' },
  output: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  image: { bg: '#18181b', border: '#6366f1', text: '#e5e7eb' },
};

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Monaco, monospace', label: 'Mono' },
  { value: 'Comic Sans MS, cursive', label: 'Comic' },
];

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#ffffff',
];

export default function EditableCanvas({ canvas: initialCanvas, onSave, onClose }: EditableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas state
  const [canvas, setCanvas] = useState<CanvasData>(initialCanvas);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Interaction state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle>(null);

  // UI state
  const [showFormatting, setShowFormatting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Load images
  useEffect(() => {
    const imageNodes = canvas.nodes.filter(n => n.imageUrl || n.imageData);
    const newImages = new Map<string, HTMLImageElement>();
    let loadedCount = 0;

    if (imageNodes.length === 0) {
      setLoadedImages(new Map());
      return;
    }

    imageNodes.forEach(node => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        newImages.set(node.id, img);
        loadedCount++;
        if (loadedCount === imageNodes.length) {
          setLoadedImages(new Map(newImages));
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === imageNodes.length) {
          setLoadedImages(new Map(newImages));
        }
      };
      img.src = node.imageData || node.imageUrl || '';
    });
  }, [canvas.nodes]);

  // Get node at position (in canvas coordinates)
  const getNodeAtPosition = useCallback((canvasX: number, canvasY: number): CanvasNode | null => {
    // Check nodes in reverse order (top-most first)
    for (let i = canvas.nodes.length - 1; i >= 0; i--) {
      const node = canvas.nodes[i];
      if (
        canvasX >= node.x &&
        canvasX <= node.x + node.width &&
        canvasY >= node.y &&
        canvasY <= node.y + node.height
      ) {
        return node;
      }
    }
    return null;
  }, [canvas.nodes]);

  // Get resize handle at position
  const getResizeHandleAtPosition = useCallback((canvasX: number, canvasY: number, node: CanvasNode): ResizeHandle => {
    const handleSize = 8 / zoom;
    const handles: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: 'nw', x: node.x, y: node.y },
      { handle: 'n', x: node.x + node.width / 2, y: node.y },
      { handle: 'ne', x: node.x + node.width, y: node.y },
      { handle: 'e', x: node.x + node.width, y: node.y + node.height / 2 },
      { handle: 'se', x: node.x + node.width, y: node.y + node.height },
      { handle: 's', x: node.x + node.width / 2, y: node.y + node.height },
      { handle: 'sw', x: node.x, y: node.y + node.height },
      { handle: 'w', x: node.x, y: node.y + node.height / 2 },
    ];

    for (const { handle, x, y } of handles) {
      if (
        Math.abs(canvasX - x) <= handleSize &&
        Math.abs(canvasY - y) <= handleSize
      ) {
        return handle;
      }
    }
    return null;
  }, [zoom]);

  // Convert screen position to canvas position
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;

    // Calculate base offset for centering
    const minX = canvas.nodes.length > 0 ? Math.min(...canvas.nodes.map(n => n.x)) : 0;
    const minY = canvas.nodes.length > 0 ? Math.min(...canvas.nodes.map(n => n.y)) : 0;
    const maxX = canvas.nodes.length > 0 ? Math.max(...canvas.nodes.map(n => n.x + n.width)) : 0;
    const maxY = canvas.nodes.length > 0 ? Math.max(...canvas.nodes.map(n => n.y + n.height)) : 0;
    const contentWidth = maxX - minX || 100;
    const contentHeight = maxY - minY || 100;

    const baseOffsetX = (container.clientWidth - contentWidth * zoom) / 2 - minX * zoom;
    const baseOffsetY = (container.clientHeight - contentHeight * zoom) / 2 - minY * zoom;

    return {
      x: (x - baseOffsetX - panOffset.x) / zoom,
      y: (y - baseOffsetY - panOffset.y) / zoom,
    };
  }, [canvas.nodes, zoom, panOffset]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // Check if clicking on a resize handle of selected node
    if (selectedNodeIds.size === 1) {
      const selectedNode = canvas.nodes.find(n => selectedNodeIds.has(n.id));
      if (selectedNode) {
        const handle = getResizeHandleAtPosition(x, y, selectedNode);
        if (handle) {
          setDragMode('resize');
          setResizeHandle(handle);
          setDragStart({ x: e.clientX, y: e.clientY });
          return;
        }
      }
    }

    // Check if clicking on a node
    const node = getNodeAtPosition(x, y);
    if (node) {
      if (e.shiftKey) {
        // Toggle selection with shift
        setSelectedNodeIds(prev => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      } else if (!selectedNodeIds.has(node.id)) {
        // Select only this node
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionIds(new Set());
      }
      setDragMode('move');
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Clear selection and start panning
      if (!e.shiftKey) {
        setSelectedNodeIds(new Set());
        setSelectedConnectionIds(new Set());
      }
      setDragMode('pan');
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [screenToCanvas, getNodeAtPosition, getResizeHandleAtPosition, selectedNodeIds, canvas.nodes, panOffset]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (dragMode === 'none') {
      // Update hover state
      const node = getNodeAtPosition(x, y);
      setHoveredNodeId(node?.id || null);

      // Check for resize handle hover
      if (selectedNodeIds.size === 1) {
        const selectedNode = canvas.nodes.find(n => selectedNodeIds.has(n.id));
        if (selectedNode) {
          setHoveredHandle(getResizeHandleAtPosition(x, y, selectedNode));
        }
      } else {
        setHoveredHandle(null);
      }
      return;
    }

    if (dragMode === 'pan') {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (dragMode === 'move') {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      setDragStart({ x: e.clientX, y: e.clientY });

      setCanvas(prev => ({
        ...prev,
        nodes: prev.nodes.map(node =>
          selectedNodeIds.has(node.id)
            ? { ...node, x: node.x + dx, y: node.y + dy }
            : node
        ),
      }));
      setHasUnsavedChanges(true);
    } else if (dragMode === 'resize' && resizeHandle && selectedNodeIds.size === 1) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      setDragStart({ x: e.clientX, y: e.clientY });

      setCanvas(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
          if (!selectedNodeIds.has(node.id)) return node;

          let { x, y, width, height } = node;
          const minSize = 40;

          switch (resizeHandle) {
            case 'nw':
              x += dx; y += dy; width -= dx; height -= dy;
              break;
            case 'n':
              y += dy; height -= dy;
              break;
            case 'ne':
              y += dy; width += dx; height -= dy;
              break;
            case 'e':
              width += dx;
              break;
            case 'se':
              width += dx; height += dy;
              break;
            case 's':
              height += dy;
              break;
            case 'sw':
              x += dx; width -= dx; height += dy;
              break;
            case 'w':
              x += dx; width -= dx;
              break;
          }

          // Enforce minimum size
          if (width < minSize) { width = minSize; if (resizeHandle.includes('w')) x = node.x + node.width - minSize; }
          if (height < minSize) { height = minSize; if (resizeHandle.includes('n')) y = node.y + node.height - minSize; }

          return { ...node, x, y, width, height };
        }),
      }));
      setHasUnsavedChanges(true);
    }
  }, [dragMode, dragStart, zoom, selectedNodeIds, resizeHandle, screenToCanvas, getNodeAtPosition, getResizeHandleAtPosition, canvas.nodes]);

  const handleMouseUp = useCallback(() => {
    setDragMode('none');
    setResizeHandle(null);
  }, []);

  // Handle double-click for label editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const node = getNodeAtPosition(x, y);
    if (node) {
      setEditingLabel(node.id);
      setEditLabelValue(node.label);
      setTimeout(() => labelInputRef.current?.focus(), 0);
    }
  }, [screenToCanvas, getNodeAtPosition]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingLabel) {
        if (e.key === 'Escape') {
          setEditingLabel(null);
        } else if (e.key === 'Enter') {
          // Save label
          setCanvas(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
              n.id === editingLabel ? { ...n, label: editLabelValue } : n
            ),
          }));
          setEditingLabel(null);
          setHasUnsavedChanges(true);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.size > 0) {
          deleteSelectedNodes();
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeIds(new Set());
        setSelectedConnectionIds(new Set());
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelectedNodeIds(new Set(canvas.nodes.map(n => n.id)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingLabel, editLabelValue, selectedNodeIds, canvas.nodes]);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    setCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => !selectedNodeIds.has(n.id)),
      connections: prev.connections.filter(
        c => !selectedNodeIds.has(c.fromNodeId) && !selectedNodeIds.has(c.toNodeId)
      ),
    }));
    setSelectedNodeIds(new Set());
    setHasUnsavedChanges(true);
  }, [selectedNodeIds]);

  // Update node style
  const updateSelectedNodesStyle = useCallback((updates: Partial<CanvasNode>) => {
    setCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        selectedNodeIds.has(n.id) ? { ...n, ...updates } : n
      ),
    }));
    setHasUnsavedChanges(true);
  }, [selectedNodeIds]);

  // Handle wheel for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Save canvas
  const handleSave = useCallback(async () => {
    try {
      const response = await fetch(`/api/design-mcp/canvases/${canvas.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canvas),
      });

      if (!response.ok) throw new Error('Failed to save');

      setHasUnsavedChanges(false);
      onSave?.(canvas);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save canvas');
    }
  }, [canvas, onSave]);

  // Add new node
  const addNode = useCallback((type: string = 'note') => {
    const container = containerRef.current;
    if (!container) return;

    const centerX = (container.clientWidth / 2 - panOffset.x) / zoom;
    const centerY = (container.clientHeight / 2 - panOffset.y) / zoom;

    const newNode: CanvasNode = {
      id: crypto.randomUUID(),
      type,
      label: 'New Node',
      x: centerX - 60,
      y: centerY - 30,
      width: 120,
      height: 60,
    };

    setCanvas(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeIds(new Set([newNode.id]));
    setHasUnsavedChanges(true);
  }, [zoom, panOffset]);

  // Render canvas
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const container = containerRef.current;
    if (!canvasEl || !container) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = container.clientWidth * dpr;
    canvasEl.height = container.clientHeight * dpr;
    canvasEl.style.width = `${container.clientWidth}px`;
    canvasEl.style.height = `${container.clientHeight}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, container.clientWidth, container.clientHeight);

    // Draw grid
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < container.clientWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, container.clientHeight);
      ctx.stroke();
    }
    for (let y = 0; y < container.clientHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(container.clientWidth, y);
      ctx.stroke();
    }

    if (canvas.nodes.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Click "Add Node" to get started', container.clientWidth / 2, container.clientHeight / 2);
      return;
    }

    // Calculate transform
    const minX = Math.min(...canvas.nodes.map(n => n.x));
    const minY = Math.min(...canvas.nodes.map(n => n.y));
    const maxX = Math.max(...canvas.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...canvas.nodes.map(n => n.y + n.height));
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const baseOffsetX = (container.clientWidth - contentWidth * zoom) / 2 - minX * zoom;
    const baseOffsetY = (container.clientHeight - contentHeight * zoom) / 2 - minY * zoom;

    ctx.save();
    ctx.translate(baseOffsetX + panOffset.x, baseOffsetY + panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw connections
    ctx.lineWidth = 2 / zoom;
    canvas.connections.forEach(conn => {
      const fromNode = canvas.nodes.find(n => n.id === conn.fromNodeId);
      const toNode = canvas.nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;

      const isSelected = selectedConnectionIds.has(conn.id);
      ctx.strokeStyle = isSelected ? '#f59e0b' : (conn.color || '#6366f1');
      ctx.setLineDash(conn.style === 'dashed' ? [5, 5] : []);

      const fromX = fromNode.x + fromNode.width / 2;
      const fromY = fromNode.y + fromNode.height / 2;
      const toX = toNode.x + toNode.width / 2;
      const toY = toNode.y + toNode.height / 2;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Arrow
      if (conn.style === 'arrow' || !conn.style) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowLen = 12;
        const endX = toX - (toNode.width / 2) * Math.cos(angle);
        const endY = toY - (toNode.height / 2) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLen * Math.cos(angle - Math.PI / 6), endY - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowLen * Math.cos(angle + Math.PI / 6), endY - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);

    // Draw nodes
    canvas.nodes.forEach(node => {
      const defaultColors = NODE_COLORS[node.type] || NODE_COLORS.idea;
      const isSelected = selectedNodeIds.has(node.id);
      const isHovered = hoveredNodeId === node.id;

      const bgColor = node.bgColor || defaultColors.bg;
      const borderColor = isSelected ? '#f59e0b' : (node.borderColor || defaultColors.border);
      const textColor = node.textColor || defaultColors.text;

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = (isSelected ? 3 : (node.borderWidth || 2)) / zoom;

      // Draw rounded rect
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(node.x + radius, node.y);
      ctx.lineTo(node.x + node.width - radius, node.y);
      ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
      ctx.lineTo(node.x + node.width, node.y + node.height - radius);
      ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
      ctx.lineTo(node.x + radius, node.y + node.height);
      ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
      ctx.lineTo(node.x, node.y + radius);
      ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hover effect
      if (isHovered && !isSelected) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }

      // Draw image if available
      const hasImage = (node.imageUrl || node.imageData) && loadedImages.has(node.id);
      if (hasImage) {
        const img = loadedImages.get(node.id)!;
        const padding = 4;
        const labelHeight = node.label ? 24 : 0;
        const availW = node.width - padding * 2;
        const availH = node.height - padding * 2 - labelHeight;
        const imgAspect = img.width / img.height;
        const boxAspect = availW / availH;

        let drawW, drawH;
        if (imgAspect > boxAspect) {
          drawW = availW;
          drawH = availW / imgAspect;
        } else {
          drawH = availH;
          drawW = availH * imgAspect;
        }

        const drawX = node.x + padding + (availW - drawW) / 2;
        const drawY = node.y + padding + (availH - drawH) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(drawX, drawY, drawW, drawH);
        ctx.clip();
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();

        if (node.label) {
          ctx.fillStyle = textColor;
          ctx.font = `bold ${node.fontSize || 11}px ${node.fontFamily || 'system-ui'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, node.x + node.width / 2, node.y + node.height - labelHeight / 2);
        }
      } else {
        // Draw text
        ctx.fillStyle = textColor;
        ctx.font = `bold ${node.fontSize || 12}px ${node.fontFamily || 'system-ui'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = node.label.split('\n');
        const lineHeight = (node.fontSize || 12) + 4;
        const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;

        lines.forEach((line, i) => {
          let text = line;
          const maxW = node.width - 16;
          while (ctx.measureText(text).width > maxW && text.length > 3) {
            text = text.slice(0, -4) + '...';
          }
          ctx.fillText(text, node.x + node.width / 2, startY + i * lineHeight);
        });
      }

      // Draw resize handles for selected nodes
      if (isSelected) {
        const handleSize = 8 / zoom;
        const handles = [
          { x: node.x, y: node.y },
          { x: node.x + node.width / 2, y: node.y },
          { x: node.x + node.width, y: node.y },
          { x: node.x + node.width, y: node.y + node.height / 2 },
          { x: node.x + node.width, y: node.y + node.height },
          { x: node.x + node.width / 2, y: node.y + node.height },
          { x: node.x, y: node.y + node.height },
          { x: node.x, y: node.y + node.height / 2 },
        ];

        ctx.fillStyle = '#f59e0b';
        handles.forEach(({ x, y }) => {
          ctx.beginPath();
          ctx.arc(x, y, handleSize / 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    ctx.restore();
  }, [canvas, zoom, panOffset, loadedImages, selectedNodeIds, selectedConnectionIds, hoveredNodeId]);

  // Get cursor based on state
  const getCursor = (): string => {
    if (dragMode === 'pan') return 'grabbing';
    if (dragMode === 'move') return 'move';
    if (dragMode === 'resize' || hoveredHandle) {
      const cursors: Record<string, string> = {
        nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
        se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
      };
      return cursors[resizeHandle || hoveredHandle || 'se'];
    }
    if (hoveredNodeId) return 'pointer';
    return 'grab';
  };

  const selectedNode = canvas.nodes.find(n => selectedNodeIds.has(n.id));

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-none flex items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
        {/* Add node dropdown */}
        <div className="relative group">
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Node
          </button>
          <div className="absolute top-full left-0 mt-1 w-40 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {Object.keys(NODE_COLORS).map(type => (
              <button
                key={type}
                onClick={() => addNode(type)}
                className="w-full px-3 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg capitalize"
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-zinc-700" />

        {/* Delete button */}
        <button
          onClick={deleteSelectedNodes}
          disabled={selectedNodeIds.size === 0}
          className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>

        {/* Format button */}
        <button
          onClick={() => setShowFormatting(!showFormatting)}
          disabled={selectedNodeIds.size === 0}
          className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 ${
            showFormatting ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Format
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} className="p-1.5 text-zinc-400 hover:text-white rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="px-2 text-sm text-zinc-400 min-w-[4rem] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="p-1.5 text-zinc-400 hover:text-white rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-zinc-700" />

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`px-4 py-1.5 text-sm rounded-lg flex items-center gap-2 ${
            hasUnsavedChanges
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
        </button>
      </div>

      {/* Formatting panel */}
      {showFormatting && selectedNode && (
        <div className="flex-none flex items-center gap-4 p-3 bg-zinc-900/80 border-b border-zinc-800">
          {/* Font family */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Font:</span>
            <select
              value={selectedNode.fontFamily || 'system-ui'}
              onChange={(e) => updateSelectedNodesStyle({ fontFamily: e.target.value })}
              className="bg-zinc-800 text-zinc-300 text-sm rounded px-2 py-1 border border-zinc-700"
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Size:</span>
            <input
              type="number"
              value={selectedNode.fontSize || 12}
              onChange={(e) => updateSelectedNodesStyle({ fontSize: parseInt(e.target.value) || 12 })}
              className="w-14 bg-zinc-800 text-zinc-300 text-sm rounded px-2 py-1 border border-zinc-700"
              min={8}
              max={48}
            />
          </div>

          <div className="h-6 w-px bg-zinc-700" />

          {/* Text color */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Text:</span>
            <div className="flex gap-1">
              {COLORS.slice(0, 8).map(color => (
                <button
                  key={color}
                  onClick={() => updateSelectedNodesStyle({ textColor: color })}
                  className={`w-5 h-5 rounded border-2 ${selectedNode.textColor === color ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Background color */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Fill:</span>
            <div className="flex gap-1">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateSelectedNodesStyle({ bgColor: color })}
                  className={`w-5 h-5 rounded border-2 ${selectedNode.bgColor === color ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Border color */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Border:</span>
            <div className="flex gap-1">
              {COLORS.slice(0, 8).map(color => (
                <button
                  key={color}
                  onClick={() => updateSelectedNodesStyle({ borderColor: color })}
                  className={`w-5 h-5 rounded border-2 ${selectedNode.borderColor === color ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: getCursor() }}
      >
        <canvas ref={canvasRef} className="block" />

        {/* Label editor */}
        {editingLabel && (
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <input
              ref={labelInputRef}
              type="text"
              value={editLabelValue}
              onChange={(e) => setEditLabelValue(e.target.value)}
              onBlur={() => {
                setCanvas(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n =>
                    n.id === editingLabel ? { ...n, label: editLabelValue } : n
                  ),
                }));
                setEditingLabel(null);
                setHasUnsavedChanges(true);
              }}
              className="px-3 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-600 shadow-xl text-center min-w-[200px]"
              placeholder="Enter label..."
            />
          </div>
        )}

        {/* Help text */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800/80 rounded-full text-xs text-zinc-500 backdrop-blur-sm pointer-events-none">
          Click to select • Drag to move • Double-click to edit • Del to delete • Scroll to zoom
        </div>
      </div>
    </div>
  );
}
