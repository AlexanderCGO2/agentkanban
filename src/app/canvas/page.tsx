'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MindMapCanvas from '@/components/canvas/MindMapCanvas';
import Link from 'next/link';

type CanvasType = 'mindmap' | 'workflow' | 'freeform';

interface CanvasNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string; // For images (e.g., from Replicate)
  imageData?: string; // Base64 image data
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

// Wrapper component with Suspense boundary
export default function CanvasPage() {
  return (
    <Suspense fallback={<CanvasPageLoading />}>
      <CanvasPageContent />
    </Suspense>
  );
}

// Loading fallback
function CanvasPageLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">Loading canvas...</p>
      </div>
    </div>
  );
}

// Main content component
function CanvasPageContent() {
  const searchParams = useSearchParams();
  const canvasId = searchParams.get('id');

  const [activeCanvas, setActiveCanvas] = useState<CanvasType>('mindmap');
  const [savedStates, setSavedStates] = useState<Array<{ id: string; name: string; data: unknown }>>([]);
  const [loadedCanvas, setLoadedCanvas] = useState<CanvasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load canvas from API if ID is provided
  const loadCanvas = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/design-mcp/canvases/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load canvas');
      }
      const data = await response.json();
      // Handle both direct canvas and wrapped { canvas: ... } format
      const canvas = data.canvas || data;
      setLoadedCanvas(canvas);

      // Set canvas type based on loaded data
      if (canvas.type === 'workflow') {
        setActiveCanvas('workflow');
      } else if (canvas.type === 'mindmap') {
        setActiveCanvas('mindmap');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load canvas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId);
    }
  }, [canvasId, loadCanvas]);

  const handleSave = (data: unknown) => {
    const id = crypto.randomUUID();
    const name = `Canvas ${savedStates.length + 1}`;
    setSavedStates(prev => [...prev, { id, name, data }]);

    // In a real app, you'd save to your API/MCP server here
    console.log('Saved canvas:', { id, name, data });
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex-none border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {loadedCanvas ? loadedCanvas.name : 'Design Canvas'}
                </h1>
                <p className="text-xs text-zinc-500">
                  {loadedCanvas ? `${loadedCanvas.type} • ${loadedCanvas.nodes.length} nodes` : 'Powered by Fabric.js'}
                </p>
              </div>
            </div>
          </div>

          {/* Canvas Type Tabs */}
          {!loadedCanvas && (
            <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
              {[
                { type: 'mindmap' as const, label: 'Mind Map', icon: '🗺️' },
                { type: 'workflow' as const, label: 'Workflow', icon: '⚡' },
                { type: 'freeform' as const, label: 'Freeform', icon: '✏️' },
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setActiveCanvas(type)}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                    activeCanvas === type
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Canvas Info when loaded */}
          {loadedCanvas && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setLoadedCanvas(null);
                  window.history.pushState({}, '', '/canvas');
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Canvas
              </button>
            </div>
          )}

          {/* MCP Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-400">MCP Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 relative">
        {/* Loading State */}
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-zinc-400">Loading canvas...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-red-400 mb-2">Failed to Load Canvas</h2>
              <p className="text-zinc-500 max-w-md mb-4">{error}</p>
              <button
                onClick={() => canvasId && loadCanvas(canvasId)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loaded Canvas Viewer */}
        {!loading && !error && loadedCanvas && (
          <LoadedCanvasViewer canvas={loadedCanvas} />
        )}

        {/* Default Canvas Editor */}
        {!loading && !error && !loadedCanvas && (
          <>
            {activeCanvas === 'mindmap' && (
              <MindMapCanvas onSave={handleSave} />
            )}

            {activeCanvas === 'workflow' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🚧</div>
                  <h2 className="text-xl font-semibold text-zinc-300 mb-2">Workflow Canvas</h2>
                  <p className="text-zinc-500 max-w-md">
                    Research workflow builder coming soon.<br />
                    Will integrate with agent templates for automated execution.
                  </p>
                </div>
              </div>
            )}

            {activeCanvas === 'freeform' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎨</div>
                  <h2 className="text-xl font-semibold text-zinc-300 mb-2">Freeform Canvas</h2>
                  <p className="text-zinc-500 max-w-md">
                    Full Fabric.js canvas with drawing tools coming soon.<br />
                    Supports complex paths, images, and text editing.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Saved States Sidebar (collapsed by default) */}
      {savedStates.length > 0 && (
        <div className="absolute right-4 top-20 z-10 w-64 rounded-xl bg-zinc-900/95 p-4 backdrop-blur-sm border border-zinc-800 shadow-2xl">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">Saved Canvases</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {savedStates.map((state) => (
              <div
                key={state.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm"
              >
                <span className="text-zinc-300">{state.name}</span>
                <button className="text-xs text-indigo-400 hover:text-indigo-300">Load</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Component to render a loaded canvas with zoom/pan
function LoadedCanvasViewer({ canvas }: { canvas: CanvasData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Load images for nodes that have imageUrl or imageData
  useEffect(() => {
    const imageNodes = canvas.nodes.filter(n => n.imageUrl || n.imageData);
    const newImages = new Map<string, HTMLImageElement>();

    let loadedCount = 0;
    const totalImages = imageNodes.length;

    if (totalImages === 0) {
      setLoadedImages(new Map());
      return;
    }

    imageNodes.forEach(node => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        newImages.set(node.id, img);
        loadedCount++;
        if (loadedCount === totalImages) {
          setLoadedImages(new Map(newImages));
        }
      };

      img.onerror = () => {
        console.error(`Failed to load image for node ${node.id}`);
        loadedCount++;
        if (loadedCount === totalImages) {
          setLoadedImages(new Map(newImages));
        }
      };

      // Use imageData (base64) if available, otherwise use imageUrl
      img.src = node.imageData || node.imageUrl || '';
    });
  }, [canvas.nodes]);

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

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  }, []);

  // Handle mouse events for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
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
    if (canvas.nodes.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const minX = Math.min(...canvas.nodes.map(n => n.x));
    const minY = Math.min(...canvas.nodes.map(n => n.y));
    const maxX = Math.max(...canvas.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...canvas.nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 80;
    const scaleX = (container.clientWidth - padding) / contentWidth;
    const scaleY = (container.clientHeight - padding) / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 2);

    setZoom(newZoom);
    setPanOffset({ x: 0, y: 0 });
  }, [canvas.nodes]);

  // Render the canvas
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const container = containerRef.current;

    if (!canvasEl || !container) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvasEl.width = container.clientWidth;
    canvasEl.height = container.clientHeight;

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    // Draw grid
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvasEl.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasEl.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvasEl.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasEl.width, y);
      ctx.stroke();
    }

    if (canvas.nodes.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Empty canvas', canvasEl.width / 2, canvasEl.height / 2);
      return;
    }

    const minX = Math.min(...canvas.nodes.map(n => n.x));
    const minY = Math.min(...canvas.nodes.map(n => n.y));
    const maxX = Math.max(...canvas.nodes.map(n => n.x + n.width));
    const maxY = Math.max(...canvas.nodes.map(n => n.y + n.height));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const baseOffsetX = (canvasEl.width - contentWidth * zoom) / 2 - minX * zoom;
    const baseOffsetY = (canvasEl.height - contentHeight * zoom) / 2 - minY * zoom;

    ctx.save();
    ctx.translate(baseOffsetX + panOffset.x, baseOffsetY + panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw connections
    ctx.lineWidth = 2 / zoom;
    canvas.connections.forEach(conn => {
      const fromNode = canvas.nodes.find(n => n.id === conn.fromNodeId);
      const toNode = canvas.nodes.find(n => n.id === conn.toNodeId);
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

      if (conn.label) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        const midX = (fromCenterX + toCenterX) / 2;
        const midY = (fromCenterY + toCenterY) / 2;
        ctx.fillText(conn.label, midX, midY - 5);
      }
    });

    ctx.setLineDash([]);

    // Draw nodes
    canvas.nodes.forEach(node => {
      const colors = NODE_COLORS[node.type] || NODE_COLORS.idea;
      const hasImage = (node.imageUrl || node.imageData) && loadedImages.has(node.id);
      const radius = 8;

      // Draw node background/border
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2 / zoom;

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

      // Draw image if available
      if (hasImage) {
        const img = loadedImages.get(node.id)!;
        const padding = 4;
        const labelHeight = node.label ? 24 : 0;

        // Calculate image dimensions maintaining aspect ratio
        const availableWidth = node.width - padding * 2;
        const availableHeight = node.height - padding * 2 - labelHeight;
        const imgAspect = img.width / img.height;
        const boxAspect = availableWidth / availableHeight;

        let drawWidth, drawHeight;
        if (imgAspect > boxAspect) {
          drawWidth = availableWidth;
          drawHeight = availableWidth / imgAspect;
        } else {
          drawHeight = availableHeight;
          drawWidth = availableHeight * imgAspect;
        }

        const drawX = node.x + padding + (availableWidth - drawWidth) / 2;
        const drawY = node.y + padding + (availableHeight - drawHeight) / 2;

        // Clip to rounded rect
        ctx.save();
        ctx.beginPath();
        const imgRadius = 4;
        ctx.moveTo(drawX + imgRadius, drawY);
        ctx.lineTo(drawX + drawWidth - imgRadius, drawY);
        ctx.quadraticCurveTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + imgRadius);
        ctx.lineTo(drawX + drawWidth, drawY + drawHeight - imgRadius);
        ctx.quadraticCurveTo(drawX + drawWidth, drawY + drawHeight, drawX + drawWidth - imgRadius, drawY + drawHeight);
        ctx.lineTo(drawX + imgRadius, drawY + drawHeight);
        ctx.quadraticCurveTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - imgRadius);
        ctx.lineTo(drawX, drawY + imgRadius);
        ctx.quadraticCurveTo(drawX, drawY, drawX + imgRadius, drawY);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();

        // Draw label at bottom if present
        if (node.label) {
          ctx.fillStyle = colors.text;
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const labelY = node.y + node.height - labelHeight / 2;
          let displayText = node.label;
          const maxWidth = node.width - 16;
          while (ctx.measureText(displayText).width > maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -4) + '...';
          }
          ctx.fillText(displayText, node.x + node.width / 2, labelY);
        }
      } else {
        // Draw text label (no image)
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = node.label.split('\n');
        const lineHeight = 16;
        const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;

        lines.forEach((line, i) => {
          const maxWidth = node.width - 16;
          let displayText = line;
          while (ctx.measureText(displayText).width > maxWidth && displayText.length > 3) {
            displayText = displayText.slice(0, -4) + '...';
          }
          ctx.fillText(displayText, node.x + node.width / 2, startY + i * lineHeight);
        });
      }
    });

    ctx.restore();

  }, [canvas, zoom, panOffset, loadedImages]);

  return (
    <div
      ref={containerRef}
      className="h-full relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 px-3 py-1.5 bg-zinc-800/80 rounded-lg text-sm text-zinc-400 backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </div>

      {/* Zoom controls */}
      <div className="absolute left-4 bottom-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Zoom in"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
        <button
          onClick={zoomOut}
          className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Zoom out"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          onClick={fitToScreen}
          className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Fit to screen"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={resetZoom}
          className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg backdrop-blur-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Reset (100%)"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          </svg>
        </button>
      </div>

      {/* Pan hint */}
      {!isPanning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800/60 rounded-full text-sm text-zinc-500 backdrop-blur-sm pointer-events-none">
          Drag to pan • Scroll to zoom
        </div>
      )}
    </div>
  );
}