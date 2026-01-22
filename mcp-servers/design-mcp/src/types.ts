// Canvas Data Types

export type NodeType = 'idea' | 'task' | 'research' | 'note' | 'decision' | 'source' | 'process' | 'analyze' | 'output';
export type CanvasType = 'mindmap' | 'workflow' | 'freeform';
export type ConnectionStyle = 'solid' | 'dashed' | 'arrow';

export interface CanvasNode {
  id: string;
  type: NodeType;
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
  style: ConnectionStyle;
}

export interface CanvasData {
  id: string;
  name: string;
  type: CanvasType;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  fabricState?: object;
  createdAt: string;
  updatedAt: string;
}

// MCP Protocol Types

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

export interface McpToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  }>;
}

// Cloudflare Bindings
export interface Env {
  CANVAS_KV: KVNamespace;
  CORS_ORIGIN: string;
}

// Workflow Templates
export interface WorkflowStep {
  type: NodeType;
  title: string;
  description: string;
}

export interface WorkflowTemplate {
  name: string;
  description: string;
  steps: WorkflowStep[];
}
