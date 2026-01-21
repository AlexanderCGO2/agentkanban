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
  | 'Task';

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export interface AgentConfig {
  id: string;
  name: string;
  prompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
  cwd?: string;
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
  prompt: string;
  allowedTools: ToolName[];
  permissionMode: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
}

export interface RunAgentRequest {
  agentId: string;
  prompt: string;
}
