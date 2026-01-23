export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebSearch'
  | 'WebFetch'
  | 'Task'
  | 'NotebookEdit'
  | 'MCP'
  // Canvas tools
  | 'canvas_create'
  | 'canvas_delete'
  | 'canvas_add_node'
  | 'canvas_update_node'
  | 'canvas_delete_node'
  | 'canvas_add_connection'
  | 'canvas_delete_connection'
  | 'canvas_list'
  | 'canvas_get'
  | 'canvas_export_svg'
  | 'canvas_export_json'
  | 'canvas_layout_auto'
  // Mindmap tools
  | 'mindmap_create'
  | 'mindmap_add_branch'
  // Workflow tools
  | 'workflow_create'
  // Replicate AI tools
  | 'replicate_run'
  | 'replicate_search_models'
  | 'replicate_get_model';

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export type AgentRole = 
  | 'design'
  | 'intern'
  | 'project-manager'
  | 'team-assist'
  | 'data-analyst'
  | 'copywriter'
  | 'accountant'
  | 'developer'
  | 'custom';

export type OutputFileType = 'text' | 'markdown' | 'json' | 'csv' | 'image' | 'pdf' | 'other';

export interface OutputFile {
  id: string;
  sessionId: string;
  filename: string;
  path: string;
  type: OutputFileType;
  mimeType: string;
  size: number;
  content?: string;
  url?: string;
  createdAt: Date;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  prompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
  cwd?: string;
  outputDir?: string;
  mcpServers?: Record<string, McpServerConfig>;
  enableReplicate?: boolean;
  model?: string;
}

export interface AgentMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system' | 'result' | 'tool_use' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  parentToolUseId?: string | null;
}

export interface AgentSession {
  id: string;
  agentId: string;
  sessionId?: string;
  status: AgentStatus;
  messages: AgentMessage[];
  outputFiles: OutputFile[];
  createdAt: Date;
  updatedAt: Date;
  result?: AgentResult;
}

export interface AgentResult {
  success: boolean;
  result?: string;
  error?: string;
  durationMs: number;
  totalCostUsd: number;
  numTurns: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
}

export interface CreateAgentRequest {
  name: string;
  role: AgentRole;
  prompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
  enableReplicate?: boolean;
}

export interface RunAgentRequest {
  agentId: string;
  prompt: string;
}
