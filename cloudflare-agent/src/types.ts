/**
 * Shared type definitions for the Cloudflare Agent Worker
 * Version 2.0 - Includes SDK adapter and sandbox types
 */

// Environment bindings
export interface Env {
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;

  // Canvas MCP API URL (Vercel app)
  CANVAS_MCP_URL?: string;

  // Replicate API token
  REPLICATE_API_TOKEN?: string;

  // ElevenLabs API key
  ELEVENLABS_API_KEY?: string;

  // Search API keys (for web_search tool)
  BRAVE_API_KEY?: string;
  SERPER_API_KEY?: string;

  // Durable Object binding for session state
  AGENT_SESSION: DurableObjectNamespace;

  // Sandbox Durable Object for code execution
  SANDBOX_DO: DurableObjectNamespace;

  // R2 bucket for file workspaces
  FILE_STORAGE: R2Bucket;

  // Queue for long-running tasks
  TASK_QUEUE: Queue<QueuedTask>;

  // Optional sandbox binding (requires paid plan + enablement)
  SANDBOX?: {
    create(): Promise<Sandbox>;
  };
}

// ============================================================
// SANDBOX TYPES
// ============================================================

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

export type SandboxLanguage = 'python' | 'javascript' | 'bash';

export interface CodeExecutionRequest {
  language: SandboxLanguage;
  code: string;
  timeout?: number;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode: number;
}

// ============================================================
// TOOL TYPES
// ============================================================

// Core tools
export type CoreToolName = 'web_search' | 'read_file' | 'write_file' | 'list_files' | 'bash';

// Sandbox execution tools
export type SandboxToolName = 'execute_python' | 'execute_javascript' | 'execute_bash';

// Canvas MCP tools
export type CanvasToolName =
  | 'canvas_create'
  | 'canvas_delete'
  | 'canvas_list'
  | 'canvas_get'
  | 'canvas_add_node'
  | 'canvas_add_image'
  | 'canvas_add_video'
  | 'canvas_add_audio'
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

// Replicate tools
export type ReplicateToolName =
  | 'replicate_run'
  | 'replicate_search_models'
  | 'replicate_get_model';

// ElevenLabs tools
export type ElevenLabsToolName = 'elevenlabs_text_to_dialogue';

// Email tools (stub for Workers)
export type EmailToolName = 'email_search' | 'email_read' | 'email_draft';

// Research agent tools
export type ResearchToolName = 'delegate_to_agent';

// All tool names
export type ToolName =
  | CoreToolName
  | SandboxToolName
  | CanvasToolName
  | ReplicateToolName
  | ElevenLabsToolName
  | EmailToolName
  | ResearchToolName;

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

// ============================================================
// SDK ADAPTER TYPES
// ============================================================

export type SDKMessageType =
  | 'user'
  | 'assistant'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'error'
  | 'done';

export interface SDKMessage {
  type: SDKMessageType;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  toolUseId?: string;
  thinking?: string;
  usage?: TokenUsage;
}

export interface SDKSessionOptions {
  model?: string;
  systemPrompt?: string;
  tools?: ToolName[];
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface SDKStreamOptions {
  onMessage?: (message: SDKMessage) => void;
  onToolUse?: (tool: { name: string; input: unknown; id: string }) => void;
  onToolResult?: (result: { id: string; output: string }) => void;
  onError?: (error: Error) => void;
  onDone?: (result: { content: string; usage: TokenUsage }) => void;
}

// ============================================================
// AGENT TYPES
// ============================================================

export type AgentName =
  | 'hello-world'
  | 'research'
  | 'chat'
  | 'resume'
  | 'email'
  | 'excel'
  | 'code-interpreter';

export interface AgentConfig {
  name: AgentName;
  description: string;
  systemPrompt: string;
  tools: ToolName[];
  maxTurns: number;
  model?: string;
  temperature?: number;
}

export interface AgentRegistry {
  [key: string]: AgentConfig;
}

export interface SubAgent {
  name: string;
  role: string;
  systemPrompt: string;
  tools: ToolName[];
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface AgentRequest {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: ToolName[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
  sessionId?: string;
  enableReplicate?: boolean;
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

// ============================================================
// SESSION TYPES
// ============================================================

export interface SessionState {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  messages: ConversationMessage[];
  files: FileReference[];
  usage: TokenUsage;
  config: SessionConfig;
  agentName?: AgentName;
}

export interface SessionConfig {
  systemPrompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns: number;
  model?: string;
  temperature?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'server_tool_use' | 'web_search_tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | unknown;
}

export interface FileReference {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

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
  sandboxDO?: DurableObjectStub;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<string>;

// ============================================================
// QUEUE TYPES
// ============================================================

export interface QueuedTask {
  type: 'agent_run';
  sessionId: string;
  prompt: string;
  config: SessionConfig;
  timestamp: string;
}

// ============================================================
// ERROR TYPES
// ============================================================

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
  | 'QUOTA_EXCEEDED'
  | 'AGENT_NOT_FOUND'
  | 'SANDBOX_ERROR';

// ============================================================
// WEBSOCKET TYPES (for chat agent)
// ============================================================

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'connected' | 'disconnected';
  content?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
