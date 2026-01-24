'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MindMapCanvas from '@/components/canvas/MindMapCanvas';
import EditableCanvas from '@/components/canvas/EditableCanvas';
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

        {/* Loaded Canvas Editor */}
        {!loading && !error && loadedCanvas && (
          <EditableCanvas
            canvas={loadedCanvas}
            onSave={(updatedCanvas) => setLoadedCanvas(updatedCanvas)}
          />
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