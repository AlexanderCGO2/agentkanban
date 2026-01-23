'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface CanvasNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  style: string;
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

interface CanvasViewerProps {
  canvasId?: string;
  canvasIds?: string[];
  className?: string;
  onCanvasSelect?: (canvasId: string) => void;
}

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
};

/**
 * CanvasViewer - Displays canvases created by agents
 * Fetches canvas data and renders it visually with zoom and pan support
 */
export function CanvasViewer({ canvasId, canvasIds = [], className = '', onCanvasSelect }: CanvasViewerProps) {
  const [canvases, setCanvases] = useState<CanvasData[]>([]);
  const [selectedCanvas, setSelectedCanvas] = useState<string | null>(canvasId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Fetch canvases
  const fetchCanvases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // If specific IDs provided, fetch them
      const idsToFetch = canvasId ? [canvasId] : canvasIds;

      if (idsToFetch.length > 0) {
        const results = await Promise.all(
          idsToFetch.map(async (id) => {
            const response = await fetch(`/api/design-mcp/canvases/${id}`);
            if (!response.ok) return null;
            const data = await response.json();
            // Handle both direct canvas and wrapped { canvas: ... } format
            return (data.canvas || data) as CanvasData;
          })
        );
        setCanvases(results.filter((c): c is CanvasData => c !== null));
      } else {
        // Fetch all canvases
        const response = await fetch('/api/design-mcp/canvases');
        if (!response.ok) throw new Error('Failed to fetch canvases');
        const data = await response.json();
        // Handle both array and wrapped format
        setCanvases(Array.isArray(data) ? data : (data.canvases || []));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load canvases');
    } finally {
      setLoading(false);
    }
  }, [canvasId, canvasIds]);

  useEffect(() => {
    fetchCanvases();
  }, [fetchCanvases]);

  // Select first canvas if none selected
  useEffect(() => {
    if (!selectedCanvas && canvases.length > 0) {
      setSelectedCanvas(canvases[0].id);
    }
  }, [canvases, selectedCanvas]);

  // Reset zoom and pan when canvas changes
  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [selectedCanvas]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  }, []);

  // Handle mouse events for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Add wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };
  const fitToScreen = useCallback(() => {
    const selectedCanvasData = canvases.find(c => c.id === selectedCanvas);
    if (!selectedCanvasData || selectedCanvasData.nodes.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const minX = Math.min(...selectedCanvasData.nodes.map(n => n.x));
    const minY = Math.min(...selectedCanvasData.nodes.map(n => n.y));
    const maxX = Math.max(...selectedCanvasData.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...selectedCanvasData.nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 80;
    const scaleX = (container.clientWidth - padding) / contentWidth;
    const scaleY = (container.clientHeight - padding) / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 2);

    setZoom(newZoom);
    setPanOffset({ x: 0, y: 0 });
  }, [canvases, selectedCanvas]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Render the selected canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const selectedCanvasData = canvases.find(c => c.id === selectedCanvas);

    if (!canvas || !container || !selectedCanvasData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (fixed to canvas, not affected by zoom)
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Calculate bounds for centering
    if (selectedCanvasData.nodes.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Empty canvas', canvas.width / 2, canvas.height / 2);
      return;
    }

    const minX = Math.min(...selectedCanvasData.nodes.map(n => n.x));
    const minY = Math.min(...selectedCanvasData.nodes.map(n => n.y));
    const maxX = Math.max(...selectedCanvasData.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...selectedCanvasData.nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate base offset to center content
    const baseOffsetX = (canvas.width - contentWidth * zoom) / 2 - minX * zoom;
    const baseOffsetY = (canvas.height - contentHeight * zoom) / 2 - minY * zoom;

    // Apply transform with pan offset
    ctx.save();
    ctx.translate(baseOffsetX + panOffset.x, baseOffsetY + panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw connections
    ctx.lineWidth = 2 / zoom;
    selectedCanvasData.connections.forEach(conn => {
      const fromNode = selectedCanvasData.nodes.find(n => n.id === conn.fromNodeId);
      const toNode = selectedCanvasData.nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;

      ctx.strokeStyle = '#6366f1';
      if (conn.style === 'dashed') {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }

      const fromCenterX = fromNode.x + fromNode.width / 2;
      const fromCenterY = fromNode.y + fromNode.height / 2;
      const toCenterX = toNode.x + toNode.width / 2;
      const toCenterY = toNode.y + toNode.height / 2;

      ctx.beginPath();
      ctx.moveTo(fromCenterX, fromCenterY);
      ctx.lineTo(toCenterX, toCenterY);
      ctx.stroke();

      // Draw arrow head if arrow style
      if (conn.style === 'arrow' || !conn.style) {
        const angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX);
        const arrowLength = 12;
        const arrowX = toCenterX - (toNode.width / 2) * Math.cos(angle);
        const arrowY = toCenterY - (toNode.height / 2) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }

      // Draw label if present
      if (conn.label) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = `${10}px system-ui`;
        ctx.textAlign = 'center';
        const midX = (fromCenterX + toCenterX) / 2;
        const midY = (fromCenterY + toCenterY) / 2;
        ctx.fillText(conn.label, midX, midY - 5);
      }
    });

    ctx.setLineDash([]);

    // Draw nodes
    selectedCanvasData.nodes.forEach(node => {
      const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;

      // Node background
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2 / zoom;

      // Rounded rectangle
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

      // Node label
      ctx.fillStyle = colors.text;
      ctx.font = `bold ${12}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Split label into lines
      const lines = node.label.split('\n');
      const lineHeight = 16;
      const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;

      lines.forEach((line, i) => {
        // Truncate long lines
        const maxWidth = node.width - 16;
        let displayText = line;
        while (ctx.measureText(displayText).width > maxWidth && displayText.length > 3) {
          displayText = displayText.slice(0, -4) + '...';
        }
        ctx.fillText(displayText, node.x + node.width / 2, startY + i * lineHeight);
      });
    });

    ctx.restore();

    // Draw title (not affected by zoom/pan)
    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(selectedCanvasData.name, 12, 24);

    ctx.fillStyle = '#71717a';
    ctx.font = '11px system-ui';
    ctx.fillText(`${selectedCanvasData.type} • ${selectedCanvasData.nodes.length} nodes`, 12, 42);

  }, [selectedCanvas, canvases, zoom, panOffset]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-sm text-zinc-500">Loading canvases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchCanvases}
            className="mt-2 px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}>
        <div className="text-center text-zinc-500">
          <div className="text-4xl mb-2">🎨</div>
          <p className="text-sm">No canvases created yet</p>
          <p className="text-xs mt-1 text-zinc-600">The agent will create visual diagrams here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={fullscreenRef}
      className={`flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''} ${className}`}
    >
      {/* Canvas tabs if multiple canvases */}
      {canvases.length > 1 && (
        <div className="flex gap-1 p-2 bg-zinc-800/50 border-b border-zinc-700 overflow-x-auto">
          {canvases.map(canvas => (
            <button
              key={canvas.id}
              onClick={() => {
                setSelectedCanvas(canvas.id);
                onCanvasSelect?.(canvas.id);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedCanvas === canvas.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {canvas.name}
            </button>
          ))}
        </div>
      )}

      {/* Canvas render area */}
      <div
        ref={containerRef}
        className={`flex-1 relative ${isFullscreen ? 'min-h-0' : 'min-h-[200px]'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Zoom indicator */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 backdrop-blur-sm">
          {Math.round(zoom * 100)}%
        </div>

        {/* Zoom controls */}
        <div className="absolute left-2 bottom-2 flex flex-col gap-1">
          <button
            onClick={zoomIn}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Zoom in"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={zoomOut}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Zoom out"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <button
            onClick={fitToScreen}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Fit to screen"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Reset (100%)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="absolute bottom-2 right-2 flex gap-2">
          <button
            onClick={fetchCanvases}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
          {selectedCanvas && (
            <a
              href={`/canvas?id=${selectedCanvas}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Open in Canvas Editor"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        {/* Pan hint */}
        {!isPanning && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-zinc-800/60 rounded-full text-xs text-zinc-500 backdrop-blur-sm pointer-events-none">
            Drag to pan • Scroll to zoom
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Extract canvas IDs from agent messages
 */
export function extractCanvasIdsFromMessages(messages: { content: string; type: string }[]): string[] {
  const canvasIdPattern = /Canvas ID:\s*([a-f0-9-]{36})/gi;
  const ids = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'tool_result' || msg.type === 'assistant') {
      const matches = msg.content.matchAll(canvasIdPattern);
      for (const match of matches) {
        ids.add(match[1]);
      }
    }
  }

  return Array.from(ids);
}
