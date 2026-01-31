/**
 * Tool registry - consolidates all tool definitions and handlers
 */

import type { ToolName, ToolDefinition, ToolHandler, ToolExecutionContext } from '../types';

// Import tool modules
import { CORE_TOOL_DEFINITIONS, CORE_TOOL_HANDLERS } from './core';
import { SANDBOX_TOOL_DEFINITIONS, SANDBOX_TOOL_HANDLERS } from './sandbox';
import { CANVAS_TOOL_DEFINITIONS, CANVAS_TOOL_HANDLERS } from './canvas';
import { REPLICATE_TOOL_DEFINITIONS, REPLICATE_TOOL_HANDLERS } from './replicate';
import { ELEVENLABS_TOOL_DEFINITIONS, ELEVENLABS_TOOL_HANDLERS } from './elevenlabs';
import { EMAIL_TOOL_DEFINITIONS, EMAIL_TOOL_HANDLERS } from './email';
import { RESEARCH_TOOL_DEFINITIONS, RESEARCH_TOOL_HANDLERS } from './research';

// ============================================================
// CONSOLIDATED DEFINITIONS
// ============================================================

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  ...CORE_TOOL_DEFINITIONS,
  ...SANDBOX_TOOL_DEFINITIONS,
  ...CANVAS_TOOL_DEFINITIONS,
  ...REPLICATE_TOOL_DEFINITIONS,
  ...ELEVENLABS_TOOL_DEFINITIONS,
  ...EMAIL_TOOL_DEFINITIONS,
  ...RESEARCH_TOOL_DEFINITIONS,
};

// ============================================================
// CONSOLIDATED HANDLERS
// ============================================================

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  ...CORE_TOOL_HANDLERS,
  ...SANDBOX_TOOL_HANDLERS,
  ...CANVAS_TOOL_HANDLERS,
  ...REPLICATE_TOOL_HANDLERS,
  ...ELEVENLABS_TOOL_HANDLERS,
  ...EMAIL_TOOL_HANDLERS,
  ...RESEARCH_TOOL_HANDLERS,
};

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Get tool definitions for specified tool names
 * Note: web_search is handled as a server tool, not a custom tool
 */
export function getToolDefinitions(allowedTools: ToolName[]): ToolDefinition[] {
  return allowedTools
    // Filter out web_search - it's handled as a server tool via Anthropic API
    .filter((name) => name !== 'web_search' && TOOL_DEFINITIONS[name])
    .map((name) => TOOL_DEFINITIONS[name]);
}

/**
 * Check if web_search is in the allowed tools (used to add server tool)
 */
export function hasWebSearchTool(allowedTools: ToolName[]): boolean {
  return allowedTools.includes('web_search');
}

/**
 * Execute a tool call
 */
export async function executeToolCall(
  toolName: ToolName,
  input: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<string> {
  const handler = TOOL_HANDLERS[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(input, context);
}

/**
 * Get all available tool names
 */
export function getAllToolNames(): ToolName[] {
  return Object.keys(TOOL_DEFINITIONS) as ToolName[];
}

/**
 * Check if a tool exists
 */
export function hasTool(toolName: string): boolean {
  return toolName in TOOL_DEFINITIONS;
}

// ============================================================
// TOOL GROUPS
// ============================================================

export const TOOL_GROUPS = {
  core: ['web_search', 'read_file', 'write_file', 'list_files', 'bash'] as ToolName[],
  sandbox: ['execute_python', 'execute_javascript', 'execute_bash'] as ToolName[],
  canvas: [
    'canvas_create', 'canvas_delete', 'canvas_list', 'canvas_get',
    'canvas_add_node', 'canvas_add_image', 'canvas_add_video', 'canvas_add_audio',
    'canvas_update_node', 'canvas_delete_node',
    'canvas_add_connection', 'canvas_delete_connection',
    'canvas_export_svg', 'canvas_export_json', 'canvas_layout_auto',
    'mindmap_create', 'mindmap_add_branch', 'workflow_create',
  ] as ToolName[],
  replicate: ['replicate_run', 'replicate_search_models', 'replicate_get_model'] as ToolName[],
  elevenlabs: ['elevenlabs_text_to_dialogue'] as ToolName[],
  email: ['email_search', 'email_read', 'email_draft'] as ToolName[],
  research: ['delegate_to_agent'] as ToolName[],
};

/**
 * Get tools by group name
 */
export function getToolsByGroup(group: keyof typeof TOOL_GROUPS): ToolName[] {
  return TOOL_GROUPS[group] || [];
}

// ============================================================
// DEFAULT TOOLS
// ============================================================

export const DEFAULT_TOOLS: ToolName[] = [
  'read_file',
  'write_file',
  'list_files',
  'canvas_list',
  'canvas_create',
  'canvas_add_node',
  'mindmap_create',
  'replicate_run',
];

// Re-export individual modules for direct access
export {
  CORE_TOOL_DEFINITIONS,
  CORE_TOOL_HANDLERS,
  SANDBOX_TOOL_DEFINITIONS,
  SANDBOX_TOOL_HANDLERS,
  CANVAS_TOOL_DEFINITIONS,
  CANVAS_TOOL_HANDLERS,
  REPLICATE_TOOL_DEFINITIONS,
  REPLICATE_TOOL_HANDLERS,
  ELEVENLABS_TOOL_DEFINITIONS,
  ELEVENLABS_TOOL_HANDLERS,
  EMAIL_TOOL_DEFINITIONS,
  EMAIL_TOOL_HANDLERS,
  RESEARCH_TOOL_DEFINITIONS,
  RESEARCH_TOOL_HANDLERS,
};
