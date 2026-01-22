# Fabric.js Design MCP & Visual Tools Proposal

## Executive Summary

This document outlines how to leverage **Fabric.js** to build interactive visual design tools (research workflow builder, mindmap editor) and expose them as **MCP servers** deployable on Cloudflare Workers or Vercel Edge Functions.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js + Fabric.js)                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Visual Canvas Components                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │  MindMapper  │  │ ResearchFlow │  │    Design Canvas         │  │   │
│  │  │   Component  │  │   Component  │  │      Component           │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │   │
│  │         │                 │                      │                  │   │
│  │         └────────────────┼──────────────────────┘                  │   │
│  │                          │                                          │   │
│  │                   ┌──────▼──────┐                                   │   │
│  │                   │ useFabric() │                                   │   │
│  │                   │ React Hook  │                                   │   │
│  │                   └──────┬──────┘                                   │   │
│  │                          │                                          │   │
│  │                   ┌──────▼──────┐                                   │   │
│  │                   │ Fabric.js   │                                   │   │
│  │                   │   Canvas    │                                   │   │
│  │                   └─────────────┘                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                          HTTP / WebSocket                                   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MCP SERVER (Cloudflare Workers / Vercel Edge)            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          Design MCP Server                            │  │
│  │                                                                       │  │
│  │   Tools:                          Resources:                          │  │
│  │   ├─ canvas_create               ├─ canvas://{id}                    │  │
│  │   ├─ canvas_add_node             ├─ canvas://{id}/nodes              │  │
│  │   ├─ canvas_add_connection       ├─ canvas://{id}/connections        │  │
│  │   ├─ canvas_export_svg           ├─ templates://mindmap              │  │
│  │   ├─ canvas_export_json          ├─ templates://workflow             │  │
│  │   ├─ mindmap_create              └─ templates://research             │  │
│  │   ├─ workflow_create                                                  │  │
│  │   ├─ node_style_apply                                                │  │
│  │   └─ canvas_layout_auto                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    │               │               │                       │
│               ┌────▼────┐   ┌─────▼─────┐   ┌────▼────┐                   │
│               │   KV    │   │  Durable  │   │   R2    │                   │
│               │ Storage │   │  Objects  │   │  Bucket │                   │
│               └─────────┘   └───────────┘   └─────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 Fabric.js React Integration

```typescript
// src/hooks/useFabricCanvas.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricObject, Circle, Rect, Textbox, Line, Group } from 'fabric';

export interface CanvasNode {
  id: string;
  type: 'idea' | 'task' | 'research' | 'note' | 'decision';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
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
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport: { zoom: number; panX: number; panY: number };
}

export function useFabricCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const nodesMap = useRef<Map<string, FabricObject>>(new Map());
  const connectionsMap = useRef<Map<string, Line>>(new Map());

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight - 100,
      backgroundColor: '#0a0a0a',
      selection: true,
      preserveObjectStacking: true,
    });

    // Enable pan & zoom
    fabricCanvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = fabricCanvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(0.1, zoom), 5);
      fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan with middle mouse or space+drag
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    fabricCanvas.on('mouse:down', (opt) => {
      if (opt.e.button === 1 || opt.e.altKey) {
        isPanning = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        fabricCanvas.selection = false;
      }
    });

    fabricCanvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const vpt = fabricCanvas.viewportTransform;
        if (vpt) {
          vpt[4] += opt.e.clientX - lastPosX;
          vpt[5] += opt.e.clientY - lastPosY;
          fabricCanvas.requestRenderAll();
          lastPosX = opt.e.clientX;
          lastPosY = opt.e.clientY;
        }
      }
    });

    fabricCanvas.on('mouse:up', () => {
      isPanning = false;
      fabricCanvas.selection = true;
    });

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [canvasRef]);

  // Add node to canvas
  const addNode = useCallback((node: CanvasNode) => {
    if (!canvas) return;

    const nodeGroup = createNodeShape(node);
    nodesMap.current.set(node.id, nodeGroup);
    canvas.add(nodeGroup);
    canvas.requestRenderAll();
  }, [canvas]);

  // Add connection between nodes
  const addConnection = useCallback((connection: CanvasConnection) => {
    if (!canvas) return;

    const fromNode = nodesMap.current.get(connection.fromNodeId);
    const toNode = nodesMap.current.get(connection.toNodeId);

    if (!fromNode || !toNode) return;

    const fromCenter = fromNode.getCenterPoint();
    const toCenter = toNode.getCenterPoint();

    const line = new Line([fromCenter.x, fromCenter.y, toCenter.x, toCenter.y], {
      stroke: connection.style === 'dashed' ? '#6366f1' : '#3b82f6',
      strokeWidth: 2,
      strokeDashArray: connection.style === 'dashed' ? [5, 5] : undefined,
      selectable: false,
      evented: false,
    });

    connectionsMap.current.set(connection.id, line);
    canvas.add(line);
    canvas.sendObjectToBack(line);
    canvas.requestRenderAll();
  }, [canvas]);

  // Export to JSON (Fabric.js serialization)
  const exportJSON = useCallback(() => {
    if (!canvas) return null;
    return canvas.toJSON();
  }, [canvas]);

  // Export to SVG
  const exportSVG = useCallback(() => {
    if (!canvas) return null;
    return canvas.toSVG();
  }, [canvas]);

  // Import from JSON
  const loadFromJSON = useCallback(async (json: object) => {
    if (!canvas) return;
    await canvas.loadFromJSON(json);
    canvas.requestRenderAll();
  }, [canvas]);

  return {
    canvas,
    selectedNode,
    addNode,
    addConnection,
    exportJSON,
    exportSVG,
    loadFromJSON,
  };
}

// Helper: Create visual node shape
function createNodeShape(node: CanvasNode): Group {
  const colors: Record<CanvasNode['type'], { bg: string; border: string }> = {
    idea: { bg: '#fef3c7', border: '#f59e0b' },
    task: { bg: '#dbeafe', border: '#3b82f6' },
    research: { bg: '#ede9fe', border: '#8b5cf6' },
    note: { bg: '#f0fdf4', border: '#22c55e' },
    decision: { bg: '#fce7f3', border: '#ec4899' },
  };

  const { bg, border } = colors[node.type] || colors.idea;

  const rect = new Rect({
    width: node.width,
    height: node.height,
    fill: bg,
    stroke: border,
    strokeWidth: 2,
    rx: 8,
    ry: 8,
  });

  const text = new Textbox(node.label, {
    width: node.width - 20,
    fontSize: 14,
    fontFamily: 'Inter, system-ui, sans-serif',
    fill: '#1f2937',
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
  });

  return new Group([rect, text], {
    left: node.x,
    top: node.y,
    hasControls: true,
    hasBorders: true,
    data: { nodeId: node.id, ...node },
  });
}
```

---

### 2.2 MindMap Component

```typescript
// src/components/canvas/MindMapCanvas.tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { useFabricCanvas, CanvasNode, CanvasConnection } from '@/hooks/useFabricCanvas';
import { v4 as uuid } from 'uuid';

interface MindMapProps {
  initialData?: { nodes: CanvasNode[]; connections: CanvasConnection[] };
  onSave?: (data: { nodes: CanvasNode[]; connections: CanvasConnection[] }) => void;
}

export function MindMapCanvas({ initialData, onSave }: MindMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canvas, addNode, addConnection, exportJSON, exportSVG } = useFabricCanvas(canvasRef);
  const [nodes, setNodes] = useState<CanvasNode[]>(initialData?.nodes || []);
  const [connections, setConnections] = useState<CanvasConnection[]>(initialData?.connections || []);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  const handleAddNode = useCallback((type: CanvasNode['type'] = 'idea') => {
    const node: CanvasNode = {
      id: uuid(),
      type,
      label: `New ${type}`,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      width: 160,
      height: 80,
      color: '#ffffff',
    };
    setNodes((prev) => [...prev, node]);
    addNode(node);
  }, [addNode]);

  const handleSave = useCallback(async () => {
    const json = exportJSON();
    if (onSave) {
      onSave({ nodes, connections });
    }
    // Also save to MCP server
    await fetch('/api/design-mcp/canvas/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, connections, fabricState: json }),
    });
  }, [nodes, connections, exportJSON, onSave]);

  const handleExportSVG = useCallback(() => {
    const svg = exportSVG();
    if (svg) {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindmap.svg';
      a.click();
    }
  }, [exportSVG]);

  return (
    <div className="relative h-full w-full bg-zinc-950">
      {/* Toolbar */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-xl bg-zinc-900/90 p-2 backdrop-blur-sm border border-zinc-800">
        <button
          onClick={() => handleAddNode('idea')}
          className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/30"
        >
          <span>💡</span> Idea
        </button>
        <button
          onClick={() => handleAddNode('task')}
          className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-500/30"
        >
          <span>✅</span> Task
        </button>
        <button
          onClick={() => handleAddNode('research')}
          className="flex items-center gap-2 rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-medium text-violet-400 transition hover:bg-violet-500/30"
        >
          <span>🔬</span> Research
        </button>
        <button
          onClick={() => handleAddNode('note')}
          className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/30"
        >
          <span>📝</span> Note
        </button>
        <button
          onClick={() => handleAddNode('decision')}
          className="flex items-center gap-2 rounded-lg bg-pink-500/20 px-3 py-2 text-sm font-medium text-pink-400 transition hover:bg-pink-500/30"
        >
          <span>⚖️</span> Decision
        </button>
        
        <div className="my-1 h-px bg-zinc-700" />
        
        <button
          onClick={() => setIsAddingConnection(!isAddingConnection)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isAddingConnection 
              ? 'bg-indigo-500 text-white' 
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          <span>🔗</span> Connect
        </button>
      </div>

      {/* Action Bar */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          onClick={handleExportSVG}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          Export SVG
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Save
        </button>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-4 rounded-lg bg-zinc-900/90 px-4 py-2 text-xs text-zinc-500 backdrop-blur-sm border border-zinc-800">
        <span>{nodes.length} nodes</span>
        <span>{connections.length} connections</span>
        <span>Scroll to zoom • Alt+drag to pan</span>
      </div>
    </div>
  );
}
```

---

### 2.3 Research Workflow Component

```typescript
// src/components/canvas/ResearchWorkflowCanvas.tsx
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useFabricCanvas, CanvasNode, CanvasConnection } from '@/hooks/useFabricCanvas';
import { v4 as uuid } from 'uuid';

interface WorkflowStep {
  id: string;
  type: 'source' | 'process' | 'analyze' | 'synthesize' | 'output';
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  agentRole?: string;
  outputArtifacts?: string[];
}

const WORKFLOW_TEMPLATES = {
  'literature-review': {
    name: 'Literature Review',
    steps: [
      { type: 'source', title: 'Gather Sources', description: 'Search academic databases, web, internal docs' },
      { type: 'process', title: 'Filter & Categorize', description: 'Apply inclusion criteria, tag by theme' },
      { type: 'analyze', title: 'Extract Key Findings', description: 'Pull quotes, data, methodologies' },
      { type: 'synthesize', title: 'Synthesize Themes', description: 'Identify patterns, gaps, contradictions' },
      { type: 'output', title: 'Generate Report', description: 'Structured markdown with citations' },
    ],
  },
  'competitive-analysis': {
    name: 'Competitive Analysis',
    steps: [
      { type: 'source', title: 'Identify Competitors', description: 'Direct, indirect, aspirational' },
      { type: 'process', title: 'Collect Data', description: 'Features, pricing, positioning' },
      { type: 'analyze', title: 'Gap Analysis', description: 'Compare against our offering' },
      { type: 'synthesize', title: 'SWOT Mapping', description: 'Strengths, weaknesses, opportunities' },
      { type: 'output', title: 'Strategy Doc', description: 'Recommendations with evidence' },
    ],
  },
  'user-research': {
    name: 'User Research',
    steps: [
      { type: 'source', title: 'Define Scope', description: 'Research questions, target users' },
      { type: 'process', title: 'Collect Interviews', description: 'Notes, transcripts, observations' },
      { type: 'analyze', title: 'Code & Tag', description: 'Affinity mapping, theme extraction' },
      { type: 'synthesize', title: 'Build Personas', description: 'User archetypes with needs/goals' },
      { type: 'output', title: 'Insights Deck', description: 'Key findings + design implications' },
    ],
  },
};

export function ResearchWorkflowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canvas, addNode, addConnection, exportJSON, loadFromJSON } = useFabricCanvas(canvasRef);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof WORKFLOW_TEMPLATES | null>(null);

  const applyTemplate = useCallback((templateKey: keyof typeof WORKFLOW_TEMPLATES) => {
    const template = WORKFLOW_TEMPLATES[templateKey];
    const startX = 100;
    const startY = 150;
    const stepWidth = 200;
    const stepGap = 80;

    const newSteps: WorkflowStep[] = template.steps.map((step, idx) => ({
      id: uuid(),
      type: step.type as WorkflowStep['type'],
      title: step.title,
      description: step.description,
      status: 'pending',
    }));

    setWorkflow(newSteps);

    // Add nodes to canvas
    newSteps.forEach((step, idx) => {
      const node: CanvasNode = {
        id: step.id,
        type: step.type === 'source' ? 'research' : 
              step.type === 'output' ? 'task' : 
              step.type === 'analyze' ? 'decision' : 'idea',
        label: `${step.title}\n\n${step.description}`,
        x: startX + idx * (stepWidth + stepGap),
        y: startY,
        width: stepWidth,
        height: 120,
        color: '#ffffff',
        metadata: { step },
      };
      addNode(node);

      // Add connections between sequential steps
      if (idx > 0) {
        addConnection({
          id: uuid(),
          fromNodeId: newSteps[idx - 1].id,
          toNodeId: step.id,
          style: 'arrow',
        });
      }
    });

    setSelectedTemplate(templateKey);
  }, [addNode, addConnection]);

  const runWorkflowWithAgent = useCallback(async () => {
    // Trigger agent run for each step
    for (const step of workflow) {
      setWorkflow((prev) =>
        prev.map((s) =>
          s.id === step.id ? { ...s, status: 'in-progress' } : s
        )
      );

      // Call your agent API
      const response = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: step.agentRole || 'intern', // Default to research intern
          prompt: `Execute workflow step: ${step.title}\n\nDescription: ${step.description}`,
        }),
      });

      const result = await response.json();

      setWorkflow((prev) =>
        prev.map((s) =>
          s.id === step.id
            ? { ...s, status: result.success ? 'complete' : 'error', outputArtifacts: result.files }
            : s
        )
      );
    }
  }, [workflow]);

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Template Selector */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-3 rounded-xl bg-zinc-900/95 p-4 backdrop-blur-sm border border-zinc-800 shadow-2xl">
        <h3 className="text-sm font-semibold text-zinc-300">Workflow Templates</h3>
        {Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => (
          <button
            key={key}
            onClick={() => applyTemplate(key as keyof typeof WORKFLOW_TEMPLATES)}
            className={`rounded-lg px-4 py-2.5 text-left text-sm transition ${
              selectedTemplate === key
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="font-medium">{template.name}</div>
            <div className="text-xs opacity-70">{template.steps.length} steps</div>
          </button>
        ))}
      </div>

      {/* Run Button */}
      {workflow.length > 0 && (
        <div className="absolute right-4 top-4 z-10 flex gap-3">
          <button
            onClick={runWorkflowWithAgent}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-xl hover:brightness-110"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Workflow
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Workflow Status Panel */}
      {workflow.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 w-80 rounded-xl bg-zinc-900/95 p-4 backdrop-blur-sm border border-zinc-800 shadow-2xl">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Workflow Progress</h3>
          <div className="space-y-2">
            {workflow.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-lg p-2 text-sm ${
                  step.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                  step.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400' :
                  step.status === 'error' ? 'bg-red-500/10 text-red-400' :
                  'bg-zinc-800/50 text-zinc-500'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/20 text-xs font-bold">
                  {step.status === 'complete' ? '✓' : 
                   step.status === 'in-progress' ? '⟳' :
                   step.status === 'error' ? '!' : idx + 1}
                </span>
                <span className="flex-1 truncate">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Design MCP Server

### 3.1 MCP Server for Cloudflare Workers

```typescript
// mcp-servers/design-mcp/src/index.ts
import { McpServer, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// For Cloudflare Workers, we'd use the HTTP transport instead
// import { HttpServerTransport } from './http-transport.js';

interface CanvasData {
  id: string;
  type: 'mindmap' | 'workflow' | 'freeform';
  name: string;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    metadata?: Record<string, unknown>;
  }>;
  connections: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    label?: string;
  }>;
  fabricState?: object; // Serialized Fabric.js canvas
  createdAt: string;
  updatedAt: string;
}

class DesignMcpServer {
  private server: McpServer;
  private canvases: Map<string, CanvasData> = new Map();

  constructor() {
    this.server = new McpServer({
      name: 'design-mcp',
      version: '1.0.0',
    });

    this.setupResources();
    this.setupTools();
  }

  private setupResources() {
    // Canvas resource template
    this.server.resource(
      'canvas',
      new ResourceTemplate('canvas://{canvasId}', { list: undefined }),
      async (uri, { canvasId }) => {
        const canvas = this.canvases.get(canvasId as string);
        if (!canvas) {
          throw new Error(`Canvas not found: ${canvasId}`);
        }
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(canvas, null, 2),
          }],
        };
      }
    );

    // List all canvases
    this.server.resource(
      'canvases',
      'canvas://list',
      async () => {
        const list = Array.from(this.canvases.values()).map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          nodeCount: c.nodes.length,
          updatedAt: c.updatedAt,
        }));
        return {
          contents: [{
            uri: 'canvas://list',
            mimeType: 'application/json',
            text: JSON.stringify(list, null, 2),
          }],
        };
      }
    );

    // Mindmap templates
    this.server.resource(
      'templates',
      'templates://mindmap',
      async () => ({
        contents: [{
          uri: 'templates://mindmap',
          mimeType: 'application/json',
          text: JSON.stringify({
            templates: [
              { id: 'brainstorm', name: 'Brainstorming Session', nodes: ['Central Idea', 'Branch 1', 'Branch 2'] },
              { id: 'project-plan', name: 'Project Planning', nodes: ['Goal', 'Phase 1', 'Phase 2', 'Resources'] },
              { id: 'decision-tree', name: 'Decision Tree', nodes: ['Decision', 'Option A', 'Option B', 'Outcome'] },
            ],
          }, null, 2),
        }],
      })
    );
  }

  private setupTools() {
    // Create a new canvas
    this.server.tool(
      'canvas_create',
      {
        name: { type: 'string', description: 'Name of the canvas' },
        type: { type: 'string', enum: ['mindmap', 'workflow', 'freeform'], description: 'Type of canvas' },
      },
      async ({ name, type }) => {
        const id = crypto.randomUUID();
        const canvas: CanvasData = {
          id,
          name: name as string,
          type: type as 'mindmap' | 'workflow' | 'freeform',
          nodes: [],
          connections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.canvases.set(id, canvas);
        return {
          content: [{
            type: 'text',
            text: `Created canvas "${name}" with ID: ${id}`,
          }],
        };
      }
    );

    // Add a node to a canvas
    this.server.tool(
      'canvas_add_node',
      {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        nodeType: { type: 'string', enum: ['idea', 'task', 'research', 'note', 'decision'], description: 'Type of node' },
        label: { type: 'string', description: 'Label/text for the node' },
        x: { type: 'number', description: 'X position (optional, auto-layout if not provided)' },
        y: { type: 'number', description: 'Y position (optional, auto-layout if not provided)' },
      },
      async ({ canvasId, nodeType, label, x, y }) => {
        const canvas = this.canvases.get(canvasId as string);
        if (!canvas) throw new Error(`Canvas not found: ${canvasId}`);

        const nodeId = crypto.randomUUID();
        const node = {
          id: nodeId,
          type: nodeType as string,
          label: label as string,
          x: (x as number) ?? (canvas.nodes.length * 200 + 100),
          y: (y as number) ?? 150,
          width: 160,
          height: 80,
        };

        canvas.nodes.push(node);
        canvas.updatedAt = new Date().toISOString();

        return {
          content: [{
            type: 'text',
            text: `Added ${nodeType} node "${label}" with ID: ${nodeId}`,
          }],
        };
      }
    );

    // Add a connection between nodes
    this.server.tool(
      'canvas_add_connection',
      {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        fromNodeId: { type: 'string', description: 'Source node ID' },
        toNodeId: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Optional label for the connection' },
      },
      async ({ canvasId, fromNodeId, toNodeId, label }) => {
        const canvas = this.canvases.get(canvasId as string);
        if (!canvas) throw new Error(`Canvas not found: ${canvasId}`);

        const connectionId = crypto.randomUUID();
        canvas.connections.push({
          id: connectionId,
          fromNodeId: fromNodeId as string,
          toNodeId: toNodeId as string,
          label: label as string | undefined,
        });
        canvas.updatedAt = new Date().toISOString();

        return {
          content: [{
            type: 'text',
            text: `Connected nodes ${fromNodeId} → ${toNodeId}`,
          }],
        };
      }
    );

    // Export canvas as SVG
    this.server.tool(
      'canvas_export_svg',
      {
        canvasId: { type: 'string', description: 'ID of the canvas to export' },
      },
      async ({ canvasId }) => {
        const canvas = this.canvases.get(canvasId as string);
        if (!canvas) throw new Error(`Canvas not found: ${canvasId}`);

        // Generate SVG from canvas data
        const svg = generateSVGFromCanvas(canvas);

        return {
          content: [{
            type: 'text',
            text: svg,
          }],
        };
      }
    );

    // Auto-layout nodes
    this.server.tool(
      'canvas_layout_auto',
      {
        canvasId: { type: 'string', description: 'ID of the canvas' },
        algorithm: { type: 'string', enum: ['horizontal', 'vertical', 'radial', 'force'], description: 'Layout algorithm' },
      },
      async ({ canvasId, algorithm }) => {
        const canvas = this.canvases.get(canvasId as string);
        if (!canvas) throw new Error(`Canvas not found: ${canvasId}`);

        // Apply layout algorithm
        applyLayout(canvas, algorithm as string);
        canvas.updatedAt = new Date().toISOString();

        return {
          content: [{
            type: 'text',
            text: `Applied ${algorithm} layout to canvas`,
          }],
        };
      }
    );

    // Create mindmap from text
    this.server.tool(
      'mindmap_from_text',
      {
        name: { type: 'string', description: 'Name for the mindmap' },
        centralTopic: { type: 'string', description: 'Central topic/theme' },
        branches: { type: 'array', items: { type: 'string' }, description: 'List of branch topics' },
      },
      async ({ name, centralTopic, branches }) => {
        const id = crypto.randomUUID();
        const branchArray = branches as string[];

        // Create nodes
        const centralNode = {
          id: crypto.randomUUID(),
          type: 'idea',
          label: centralTopic as string,
          x: 400,
          y: 300,
          width: 200,
          height: 100,
        };

        const branchNodes = branchArray.map((branch, idx) => {
          const angle = (2 * Math.PI * idx) / branchArray.length;
          const radius = 250;
          return {
            id: crypto.randomUUID(),
            type: 'idea',
            label: branch,
            x: 400 + radius * Math.cos(angle),
            y: 300 + radius * Math.sin(angle),
            width: 150,
            height: 70,
          };
        });

        const nodes = [centralNode, ...branchNodes];
        const connections = branchNodes.map(node => ({
          id: crypto.randomUUID(),
          fromNodeId: centralNode.id,
          toNodeId: node.id,
        }));

        const canvas: CanvasData = {
          id,
          name: name as string,
          type: 'mindmap',
          nodes,
          connections,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.canvases.set(id, canvas);

        return {
          content: [{
            type: 'text',
            text: `Created mindmap "${name}" with central topic "${centralTopic}" and ${branchArray.length} branches. Canvas ID: ${id}`,
          }],
        };
      }
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Helper functions
function generateSVGFromCanvas(canvas: CanvasData): string {
  const padding = 50;
  const minX = Math.min(...canvas.nodes.map(n => n.x)) - padding;
  const minY = Math.min(...canvas.nodes.map(n => n.y)) - padding;
  const maxX = Math.max(...canvas.nodes.map(n => n.x + n.width)) + padding;
  const maxY = Math.max(...canvas.nodes.map(n => n.y + n.height)) + padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">`;
  
  // Add styles
  svg += `<style>
    .node { fill: #fef3c7; stroke: #f59e0b; stroke-width: 2; rx: 8; }
    .node-label { font-family: Inter, sans-serif; font-size: 14px; fill: #1f2937; }
    .connection { stroke: #6366f1; stroke-width: 2; fill: none; }
  </style>`;

  // Draw connections
  for (const conn of canvas.connections) {
    const from = canvas.nodes.find(n => n.id === conn.fromNodeId);
    const to = canvas.nodes.find(n => n.id === conn.toNodeId);
    if (from && to) {
      const fromCenterX = from.x + from.width / 2;
      const fromCenterY = from.y + from.height / 2;
      const toCenterX = to.x + to.width / 2;
      const toCenterY = to.y + to.height / 2;
      svg += `<line class="connection" x1="${fromCenterX}" y1="${fromCenterY}" x2="${toCenterX}" y2="${toCenterY}" />`;
    }
  }

  // Draw nodes
  for (const node of canvas.nodes) {
    svg += `<rect class="node" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" />`;
    svg += `<text class="node-label" x="${node.x + node.width / 2}" y="${node.y + node.height / 2}" text-anchor="middle" dominant-baseline="middle">${node.label}</text>`;
  }

  svg += '</svg>';
  return svg;
}

function applyLayout(canvas: CanvasData, algorithm: string) {
  switch (algorithm) {
    case 'horizontal':
      canvas.nodes.forEach((node, idx) => {
        node.x = 100 + idx * 220;
        node.y = 200;
      });
      break;
    case 'vertical':
      canvas.nodes.forEach((node, idx) => {
        node.x = 300;
        node.y = 100 + idx * 120;
      });
      break;
    case 'radial':
      const centerX = 400;
      const centerY = 300;
      canvas.nodes.forEach((node, idx) => {
        if (idx === 0) {
          node.x = centerX - node.width / 2;
          node.y = centerY - node.height / 2;
        } else {
          const angle = (2 * Math.PI * (idx - 1)) / (canvas.nodes.length - 1);
          const radius = 200;
          node.x = centerX + radius * Math.cos(angle) - node.width / 2;
          node.y = centerY + radius * Math.sin(angle) - node.height / 2;
        }
      });
      break;
    // force-directed would need more complex implementation
  }
}

// Start server
const server = new DesignMcpServer();
server.run().catch(console.error);
```

---

### 3.2 Cloudflare Worker HTTP Transport

```typescript
// mcp-servers/design-mcp/src/worker.ts
// Cloudflare Worker entry point

import { DesignMcpServer } from './server';

export interface Env {
  DESIGN_KV: KVNamespace;
  DESIGN_DURABLE: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // MCP protocol endpoints
    if (url.pathname === '/mcp/tools/list') {
      return handleToolsList();
    }
    
    if (url.pathname === '/mcp/tools/call' && request.method === 'POST') {
      return handleToolCall(request, env);
    }
    
    if (url.pathname === '/mcp/resources/list') {
      return handleResourcesList(env);
    }
    
    if (url.pathname.startsWith('/mcp/resources/read')) {
      return handleResourceRead(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'design-mcp' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleToolsList(): Promise<Response> {
  const tools = [
    {
      name: 'canvas_create',
      description: 'Create a new design canvas (mindmap, workflow, or freeform)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the canvas' },
          type: { type: 'string', enum: ['mindmap', 'workflow', 'freeform'] },
        },
        required: ['name', 'type'],
      },
    },
    {
      name: 'canvas_add_node',
      description: 'Add a node to an existing canvas',
      inputSchema: {
        type: 'object',
        properties: {
          canvasId: { type: 'string' },
          nodeType: { type: 'string', enum: ['idea', 'task', 'research', 'note', 'decision'] },
          label: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['canvasId', 'nodeType', 'label'],
      },
    },
    {
      name: 'mindmap_from_text',
      description: 'Create a mindmap from a central topic and branch list',
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
    // ... more tools
  ];

  return new Response(JSON.stringify({ tools }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleToolCall(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { name: string; arguments: Record<string, unknown> };
  const { name, arguments: args } = body;

  // Route to appropriate handler
  switch (name) {
    case 'canvas_create':
      return await createCanvas(args, env);
    case 'canvas_add_node':
      return await addNode(args, env);
    case 'mindmap_from_text':
      return await createMindmapFromText(args, env);
    default:
      return new Response(JSON.stringify({ error: `Unknown tool: ${name}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}

async function createCanvas(args: Record<string, unknown>, env: Env): Promise<Response> {
  const id = crypto.randomUUID();
  const canvas = {
    id,
    name: args.name,
    type: args.type,
    nodes: [],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await env.DESIGN_KV.put(`canvas:${id}`, JSON.stringify(canvas));

  return new Response(JSON.stringify({
    content: [{ type: 'text', text: `Created canvas "${args.name}" with ID: ${id}` }],
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ... implement other handlers
```

---

## 4. Integration with Agent Hub

### 4.1 Add Design MCP to Agent Config

```typescript
// In your existing agent configuration, add the design MCP server:

const designAgentWithMcp: AgentConfig = {
  id: 'design-agent-mcp',
  name: 'Design Agent with Canvas',
  role: 'design',
  prompt: 'Create visual design artifacts using the canvas tools',
  allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'WebSearch'],
  permissionMode: 'acceptEdits',
  maxTurns: 20,
  mcpServers: {
    'design-mcp': {
      command: 'node',
      args: ['./mcp-servers/design-mcp/dist/index.js'],
      // Or for Cloudflare-hosted:
      // url: 'https://design-mcp.your-domain.workers.dev/mcp'
    },
  },
};
```

### 4.2 New API Route for Design Canvas

```typescript
// src/app/api/design-canvas/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, ...params } = body;

  // Forward to MCP server
  const mcpResponse = await fetch('https://design-mcp.your-domain.workers.dev/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: action, arguments: params }),
  });

  const result = await mcpResponse.json();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const canvasId = searchParams.get('id');

  if (canvasId) {
    const response = await fetch(
      `https://design-mcp.your-domain.workers.dev/mcp/resources/read?uri=canvas://${canvasId}`
    );
    const canvas = await response.json();
    return NextResponse.json(canvas);
  }

  // List all canvases
  const response = await fetch('https://design-mcp.your-domain.workers.dev/mcp/resources/list');
  const canvases = await response.json();
  return NextResponse.json(canvases);
}
```

---

## 5. Package Dependencies

Add to your `package.json`:

```json
{
  "dependencies": {
    "fabric": "^7.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

For Cloudflare Workers deployment, create a separate package:

```json
{
  "name": "design-mcp-worker",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

---

## 6. Deployment Options

### Option A: Vercel (Recommended for tight Next.js integration)

- Deploy the Next.js app with canvas components
- Use Vercel Edge Functions for the MCP server
- Store canvas data in Vercel KV or Neon (already in your project)

### Option B: Cloudflare Workers (Recommended for MCP server)

- Deploy MCP server as a Cloudflare Worker
- Use KV for canvas metadata, R2 for large files
- Use Durable Objects for real-time collaboration

### Hybrid Approach (Best of both worlds)

- **Vercel**: Frontend Next.js app with Fabric.js components
- **Cloudflare**: MCP server with KV/Durable Objects
- Connect via HTTP endpoints

---

## 7. Next Steps

1. **Phase 1**: Install Fabric.js, create `useFabricCanvas` hook
2. **Phase 2**: Build MindMap component with basic CRUD
3. **Phase 3**: Build ResearchWorkflow component with agent integration
4. **Phase 4**: Create Design MCP server (local first)
5. **Phase 5**: Deploy MCP to Cloudflare Workers
6. **Phase 6**: Add real-time collaboration (WebSocket/Durable Objects)

---

## References

- [Fabric.js Documentation](https://fabricjs.com/docs/getting-started/installing/)
- [MCP Server on Cloudflare Workers](https://developers.cloudflare.com/labs/mcp)
- [Building MCP Servers Tutorial](https://www.adamdehaven.com/articles/build-an-mcp-server-and-deploy-as-a-cloudflare-worker)
