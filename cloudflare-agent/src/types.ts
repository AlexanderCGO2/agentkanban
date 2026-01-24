/**
 * Shared type definitions for the Cloudflare Agent Worker
 */

// Environment bindings
export interface Env {
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;

  // Canvas MCP API URL (Vercel app)
  CANVAS_MCP_URL?: string;

  // Replicate API token
  REPLICATE_API_TOKEN?: string;

  // Durable Object binding for session state
  AGENT_SESSION: DurableObjectNamespace;

  // R2 bucket for file workspaces
  FILE_STORAGE: R2Bucket;

  // Queue for long-running tasks
  TASK_QUEUE: Queue<QueuedTask>;

  // Optional sandbox binding (requires paid plan + enablement)
  SANDBOX?: {
    create(): Promise<Sandbox>;
  };
}

// Sandbox interfaces
export interface Sandbox {
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>;
  spawn(command: string, args?: string[], options?: ExecOptions): SpawnProcess;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  destroy(): Promise<void>;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnProcess {
  stdout: AsyncIterable<Uint8Array>;
  stderr: AsyncIterable<Uint8Array>;
  wait(): Promise<{ exitCode: number }>;
}

// Tool types - Core tools
export type CoreToolName = 'web_search' | 'read_file' | 'write_file' | 'list_files' | 'bash';

// Tool types - Canvas MCP tools
export type CanvasToolName =
  | 'canvas_create'
  | 'canvas_delete'
  | 'canvas_list'
  | 'canvas_get'
  | 'canvas_add_node'
  | 'canvas_add_image'
  | 'canvas_update_node'
  | 'canvas_delete_node'
  | 'canvas_add_connection'
  | 'canvas_delete_connection'
  | 'canvas_export_svg'
  | 'canvas_export_json'
  | 'canvas_layout_auto'
  | 'mindmap_create'
  | 'mindmap_add_branch'
  | 'workflow_create';

// Tool types - Replicate tools
export type ReplicateToolName =
  | 'replicate_run'
  | 'replicate_search_models'
  | 'replicate_get_model';

// All tool names
export type ToolName = CoreToolName | CanvasToolName | ReplicateToolName;

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

// Agent request/response types
export interface AgentRequest {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: ToolName[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
  sessionId?: string;
}

export interface AgentMessage {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  toolUseId?: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

// Session state (persisted in Durable Object)
export interface SessionState {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  messages: ConversationMessage[];
  files: FileReference[];
  usage: TokenUsage;
  config: SessionConfig;
}

export interface SessionConfig {
  systemPrompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

export interface FileReference {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

// Tool definitions for Claude API
export interface ToolDefinition {
  name: ToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolExecutionContext {
  sessionId: string;
  env: Env;
  fileStorage: R2Bucket;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<string>;

// Queue task types
export interface QueuedTask {
  type: 'agent_run';
  sessionId: string;
  prompt: string;
  config: SessionConfig;
  timestamp: string;
}

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export type ErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'TOOL_EXECUTION_FAILED'
  | 'API_ERROR'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED';
