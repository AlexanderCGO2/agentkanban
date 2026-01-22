/**
 * Canvas Store - In-memory storage for development, Neon DB for production
 * This provides the same functionality as the Cloudflare KV-based MCP server
 */

import { neon } from '@neondatabase/serverless';

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

// In-memory store for development (data persists during server lifetime)
const memoryStore = new Map<string, CanvasData>();

// Get SQL client
function getSql() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  return neon(process.env.DATABASE_URL);
}

// Initialize database table
export async function initCanvasTable(): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// Get canvas by ID
export async function getCanvas(id: string): Promise<CanvasData | null> {
  const sql = getSql();
  
  if (sql) {
    const result = await sql`SELECT data FROM canvases WHERE id = ${id}`;
    if (result.length > 0) {
      return result[0].data as CanvasData;
    }
    return null;
  }
  
  return memoryStore.get(id) || null;
}

// Save canvas
export async function saveCanvas(canvas: CanvasData): Promise<void> {
  const sql = getSql();
  
  if (sql) {
    await sql`
      INSERT INTO canvases (id, name, type, data, updated_at)
      VALUES (${canvas.id}, ${canvas.name}, ${canvas.type}, ${JSON.stringify(canvas)}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = ${canvas.name},
        type = ${canvas.type},
        data = ${JSON.stringify(canvas)},
        updated_at = CURRENT_TIMESTAMP
    `;
  } else {
    memoryStore.set(canvas.id, canvas);
  }
}

// Delete canvas
export async function deleteCanvas(id: string): Promise<void> {
  const sql = getSql();
  
  if (sql) {
    await sql`DELETE FROM canvases WHERE id = ${id}`;
  } else {
    memoryStore.delete(id);
  }
}

// List all canvases
export async function listCanvases(): Promise<CanvasData[]> {
  const sql = getSql();
  
  if (sql) {
    const result = await sql`SELECT data FROM canvases ORDER BY updated_at DESC`;
    return result.map(row => row.data as CanvasData);
  }
  
  return Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// Workflow templates
export const WORKFLOW_TEMPLATES: Record<string, { name: string; steps: { type: NodeType; title: string; description: string }[] }> = {
  'literature-review': {
    name: 'Literature Review',
    steps: [
      { type: 'source', title: 'Gather Sources', description: 'Search databases, web, docs' },
      { type: 'process', title: 'Filter & Categorize', description: 'Apply criteria, tag by theme' },
      { type: 'analyze', title: 'Extract Findings', description: 'Pull quotes, data, methods' },
      { type: 'analyze', title: 'Synthesize Themes', description: 'Patterns, gaps, contradictions' },
      { type: 'output', title: 'Generate Report', description: 'Markdown with citations' },
    ],
  },
  'competitive-analysis': {
    name: 'Competitive Analysis',
    steps: [
      { type: 'source', title: 'Identify Competitors', description: 'Direct, indirect, aspirational' },
      { type: 'process', title: 'Collect Data', description: 'Features, pricing, positioning' },
      { type: 'analyze', title: 'Gap Analysis', description: 'Compare against our offering' },
      { type: 'analyze', title: 'SWOT Mapping', description: 'Strengths, weaknesses, opportunities' },
      { type: 'output', title: 'Strategy Doc', description: 'Recommendations with evidence' },
    ],
  },
  'user-research': {
    name: 'User Research',
    steps: [
      { type: 'source', title: 'Define Scope', description: 'Questions, target users' },
      { type: 'process', title: 'Collect Data', description: 'Interviews, surveys, observations' },
      { type: 'analyze', title: 'Code & Tag', description: 'Affinity mapping, themes' },
      { type: 'analyze', title: 'Build Personas', description: 'Archetypes with needs/goals' },
      { type: 'output', title: 'Insights Deck', description: 'Findings + implications' },
    ],
  },
  'data-analysis': {
    name: 'Data Analysis',
    steps: [
      { type: 'source', title: 'Data Collection', description: 'Gather datasets' },
      { type: 'process', title: 'Clean & Validate', description: 'Handle missing values' },
      { type: 'analyze', title: 'Exploratory Analysis', description: 'Stats, distributions' },
      { type: 'analyze', title: 'Deep Analysis', description: 'Hypothesis testing' },
      { type: 'output', title: 'Report', description: 'Charts, insights' },
    ],
  },
};
