'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFabricCanvas, CanvasNode } from '@/hooks/useFabricCanvas';

interface MindMapCanvasProps {
  onSave?: (data: ReturnType<ReturnType<typeof useFabricCanvas>['exportJSON']>) => void;
  className?: string;
}

type NodeType = CanvasNode['type'];

const NODE_TYPES: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: 'idea', label: 'Idea', icon: '💡', color: 'amber' },
  { type: 'task', label: 'Task', icon: '✓', color: 'blue' },
  { type: 'research', label: 'Research', icon: '🔬', color: 'violet' },
  { type: 'note', label: 'Note', icon: '📝', color: 'emerald' },
  { type: 'decision', label: 'Decision', icon: '⚖️', color: 'pink' },
];

export function MindMapCanvas({ onSave, className = '' }: MindMapCanvasProps) {
  const {
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
    clear,
    zoomIn,
    zoomOut,
    fitToScreen,
  } = useFabricCanvas();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle canvas click for node selection and dragging
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked node
    const clickedNode = nodes.find(
      node => x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height
    );

    if (clickedNode) {
      if (isConnecting && connectionStart) {
        // Complete connection
        if (connectionStart !== clickedNode.id) {
          addConnection({
            fromNodeId: connectionStart,
            toNodeId: clickedNode.id,
            style: 'arrow',
          });
        }
        setConnectionStart(null);
        setIsConnecting(false);
      } else if (isConnecting) {
        // Start connection
        setConnectionStart(clickedNode.id);
      } else {
        // Select and prepare for drag
        selectNode(clickedNode.id);
        setIsDragging(true);
        setDragOffset({ x: x - clickedNode.x, y: y - clickedNode.y });
      }
    } else {
      selectNode(null);
      if (isConnecting) {
        setConnectionStart(null);
        setIsConnecting(false);
      }
    }
  }, [nodes, canvasRef, isConnecting, connectionStart, addConnection, selectNode]);

  // Handle mouse move for dragging
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedNodeId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    updateNode(selectedNodeId, { x, y });
  }, [isDragging, selectedNodeId, canvasRef, dragOffset, updateNode]);

  // Handle mouse up to stop dragging
  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle double click to edit node
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find(
      node => x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height
    );

    if (clickedNode) {
      setEditingNode(clickedNode.id);
      setEditText(clickedNode.label);
    }
  }, [nodes, canvasRef]);

  // Save edited text
  const handleSaveEdit = useCallback(() => {
    if (editingNode && editText.trim()) {
      updateNode(editingNode, { label: editText.trim() });
    }
    setEditingNode(null);
    setEditText('');
  }, [editingNode, editText, updateNode]);

  // Add new node
  const handleAddNode = useCallback((type: NodeType) => {
    const centerX = (canvasRef.current?.width || 800) / 2 - 80;
    const centerY = (canvasRef.current?.height || 600) / 2 - 40;
    const offset = nodes.length * 30;

    addNode({
      type,
      label: `New ${type}`,
      x: centerX + offset,
      y: centerY + offset,
      width: 160,
      height: 80,
    });
  }, [addNode, nodes.length, canvasRef]);

  // Delete selected node
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  }, [selectedNodeId, removeNode]);

  // Export handlers
  const handleExportSVG = useCallback(() => {
    const svg = exportSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportSVG]);

  const handleExportJSON = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON]);

  const handleSave = useCallback(() => {
    const data = exportJSON();
    onSave?.(data);
  }, [exportJSON, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingNode) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        selectNode(null);
        setIsConnecting(false);
        setConnectionStart(null);
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        fitToScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingNode, handleDeleteSelected, selectNode, zoomIn, zoomOut, fitToScreen]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div ref={containerRef} className={`relative h-full w-full bg-zinc-950 overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-2 rounded-xl bg-zinc-900/95 p-3 backdrop-blur-sm border border-zinc-800 shadow-2xl">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Add Node</div>
        {NODE_TYPES.map(({ type, label, icon, color }) => (
          <button
            key={type}
            onClick={() => handleAddNode(type)}
            className={`flex items-center gap-2 rounded-lg bg-${color}-500/20 px-3 py-2 text-sm font-medium text-${color}-400 transition hover:bg-${color}-500/30`}
            style={{
              backgroundColor: `color-mix(in srgb, var(--color-${color}-500) 20%, transparent)`,
            }}
          >
            <span>{icon}</span> {label}
          </button>
        ))}

        <div className="my-2 h-px bg-zinc-700" />

        <button
          onClick={() => {
            setIsConnecting(!isConnecting);
            setConnectionStart(null);
          }}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isConnecting
              ? 'bg-indigo-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
          }`}
        >
          <span>🔗</span> {isConnecting ? 'Connecting...' : 'Connect'}
        </button>

        {selectedNodeId && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30"
          >
            <span>🗑️</span> Delete
          </button>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute left-4 bottom-4 z-20 flex gap-2 rounded-xl bg-zinc-900/95 p-2 backdrop-blur-sm border border-zinc-800">
        <button
          onClick={zoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          title="Zoom Out (-)"
        >
          −
        </button>
        <button
          onClick={fitToScreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          title="Fit to Screen (0)"
        >
          ⊡
        </button>
      </div>

      {/* Action Bar */}
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          onClick={clear}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          Clear
        </button>
        <button
          onClick={handleExportJSON}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          Export JSON
        </button>
        <button
          onClick={handleExportSVG}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          Export SVG
        </button>
        {onSave && (
          <button
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Save
          </button>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
      />

      {/* Status Bar */}
      <div className="absolute bottom-4 right-4 z-20 flex gap-4 rounded-lg bg-zinc-900/95 px-4 py-2 text-xs text-zinc-500 backdrop-blur-sm border border-zinc-800">
        <span>{nodes.length} nodes</span>
        <span>{connections.length} connections</span>
        {isConnecting && <span className="text-indigo-400">Click nodes to connect</span>}
        {selectedNode && <span className="text-emerald-400">Selected: {selectedNode.label}</span>}
      </div>

      {/* Edit Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-white">Edit Node</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingNode(null)}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Overlay (shown when empty) */}
      {nodes.length === 0 && isReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Start Your Mind Map</h2>
            <p className="text-zinc-500 max-w-md">
              Click the buttons on the left to add nodes.<br />
              Use &quot;Connect&quot; mode to link ideas together.<br />
              Double-click nodes to edit text.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MindMapCanvas;
