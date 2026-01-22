import { AgentConfig, AgentSession, AgentMessage, AgentResult, AgentStatus, OutputFile, AgentRole } from '@/types/agent';
import { sql } from './db';

// Check if database is configured
const isDatabaseConfigured = () => !!process.env.DATABASE_URL;

// In-memory fallback store for when database is not configured
class InMemoryStore {
  private agents: Map<string, AgentConfig> = new Map();
  private sessions: Map<string, AgentSession> = new Map();
  private sessionsByAgent: Map<string, string[]> = new Map();

  createAgent(config: Omit<AgentConfig, 'id'>): AgentConfig {
    const id = crypto.randomUUID();
    const agent: AgentConfig = { ...config, id };
    this.agents.set(id, agent);
    this.sessionsByAgent.set(id, []);
    return agent;
  }

  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  updateAgent(id: string, updates: Partial<Omit<AgentConfig, 'id'>>): AgentConfig | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates };
    this.agents.set(id, updated);
    return updated;
  }

  deleteAgent(id: string): boolean {
    const deleted = this.agents.delete(id);
    if (deleted) {
      const sessionIds = this.sessionsByAgent.get(id) || [];
      sessionIds.forEach(sessionId => this.sessions.delete(sessionId));
      this.sessionsByAgent.delete(id);
    }
    return deleted;
  }

  createSession(agentId: string): AgentSession {
    const id = crypto.randomUUID();
    const session: AgentSession = {
      id,
      agentId,
      status: 'idle',
      messages: [],
      outputFiles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(id, session);
    const agentSessions = this.sessionsByAgent.get(agentId) || [];
    agentSessions.push(id);
    this.sessionsByAgent.set(agentId, agentSessions);
    return session;
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  getSessionsForAgent(agentId: string): AgentSession[] {
    const sessionIds = this.sessionsByAgent.get(agentId) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter((s): s is AgentSession => s !== undefined);
  }

  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  updateSessionStatus(sessionId: string, status: AgentStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();
    }
  }

  setSessionId(localSessionId: string, sdkSessionId: string): void {
    const session = this.sessions.get(localSessionId);
    if (session) {
      session.sessionId = sdkSessionId;
      session.updatedAt = new Date();
    }
  }

  addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    session.messages.push(fullMessage);
    session.updatedAt = new Date();
    return fullMessage;
  }

  setSessionResult(sessionId: string, result: AgentResult): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.result = result;
      session.status = result.success ? 'completed' : 'error';
      session.updatedAt = new Date();
    }
  }

  addOutputFile(sessionId: string, file: Omit<OutputFile, 'id' | 'sessionId' | 'createdAt'>): OutputFile {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const outputFile: OutputFile = {
      ...file,
      id: crypto.randomUUID(),
      sessionId,
      createdAt: new Date(),
    };
    session.outputFiles.push(outputFile);
    session.updatedAt = new Date();
    return outputFile;
  }

  getOutputFiles(sessionId: string): OutputFile[] {
    const session = this.sessions.get(sessionId);
    return session?.outputFiles || [];
  }

  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id);
    const agentSessions = this.sessionsByAgent.get(session.agentId);
    if (agentSessions) {
      const index = agentSessions.indexOf(id);
      if (index > -1) agentSessions.splice(index, 1);
    }
    return true;
  }
}

// Database-backed store using Neon
class DatabaseStore {
  // Agent CRUD operations
  async createAgent(config: Omit<AgentConfig, 'id'>): Promise<AgentConfig> {
    const client = sql();
    const result = await client`
      INSERT INTO agents (name, role, prompt, allowed_tools, permission_mode, max_turns, system_prompt, cwd, output_dir, mcp_servers, enable_replicate)
      VALUES (
        ${config.name},
        ${config.role || 'custom'},
        ${config.prompt},
        ${config.allowedTools},
        ${config.permissionMode},
        ${config.maxTurns || null},
        ${config.systemPrompt || null},
        ${config.cwd || null},
        ${config.outputDir || null},
        ${config.mcpServers ? JSON.stringify(config.mcpServers) : null},
        ${config.enableReplicate || false}
      )
      RETURNING *
    ` as Record<string, unknown>[];
    return this.mapAgentRow(result[0]);
  }

  async getAgent(id: string): Promise<AgentConfig | undefined> {
    const client = sql();
    const result = await client`SELECT * FROM agents WHERE id = ${id}` as Record<string, unknown>[];
    return result[0] ? this.mapAgentRow(result[0]) : undefined;
  }

  async getAllAgents(): Promise<AgentConfig[]> {
    const client = sql();
    const result = await client`SELECT * FROM agents ORDER BY created_at DESC` as Record<string, unknown>[];
    return result.map(row => this.mapAgentRow(row));
  }

  async updateAgent(id: string, updates: Partial<Omit<AgentConfig, 'id'>>): Promise<AgentConfig | undefined> {
    const client = sql();
    const result = await client`
      UPDATE agents SET
        name = COALESCE(${updates.name}, name),
        role = COALESCE(${updates.role}, role),
        prompt = COALESCE(${updates.prompt}, prompt),
        allowed_tools = COALESCE(${updates.allowedTools}, allowed_tools),
        permission_mode = COALESCE(${updates.permissionMode}, permission_mode),
        max_turns = COALESCE(${updates.maxTurns}, max_turns),
        system_prompt = COALESCE(${updates.systemPrompt}, system_prompt),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Record<string, unknown>[];
    return result[0] ? this.mapAgentRow(result[0]) : undefined;
  }

  async deleteAgent(id: string): Promise<boolean> {
    const client = sql();
    const result = await client`DELETE FROM agents WHERE id = ${id} RETURNING id` as Record<string, unknown>[];
    return result.length > 0;
  }

  // Session operations
  async createSession(agentId: string): Promise<AgentSession> {
    const client = sql();
    const result = await client`
      INSERT INTO sessions (agent_id, status)
      VALUES (${agentId}, 'idle')
      RETURNING *
    ` as Record<string, unknown>[];
    return this.mapSessionRow(result[0]);
  }

  async getSession(id: string): Promise<AgentSession | undefined> {
    const client = sql();
    const sessionResult = await client`SELECT * FROM sessions WHERE id = ${id}` as Record<string, unknown>[];
    const session = sessionResult[0];
    if (!session) return undefined;
    
    const messages = await client`SELECT * FROM messages WHERE session_id = ${id} ORDER BY created_at ASC` as Record<string, unknown>[];
    const outputFiles = await client`SELECT * FROM output_files WHERE session_id = ${id} ORDER BY created_at ASC` as Record<string, unknown>[];
    
    return {
      ...this.mapSessionRow(session),
      messages: messages.map(m => this.mapMessageRow(m)),
      outputFiles: outputFiles.map(f => this.mapOutputFileRow(f)),
    };
  }

  async getSessionsForAgent(agentId: string): Promise<AgentSession[]> {
    const client = sql();
    const sessions = await client`SELECT * FROM sessions WHERE agent_id = ${agentId} ORDER BY created_at DESC` as Record<string, unknown>[];
    return Promise.all(sessions.map(async (session) => {
      const messages = await client`SELECT * FROM messages WHERE session_id = ${session.id} ORDER BY created_at ASC` as Record<string, unknown>[];
      const outputFiles = await client`SELECT * FROM output_files WHERE session_id = ${session.id} ORDER BY created_at ASC` as Record<string, unknown>[];
      return {
        ...this.mapSessionRow(session),
        messages: messages.map(m => this.mapMessageRow(m)),
        outputFiles: outputFiles.map(f => this.mapOutputFileRow(f)),
      };
    }));
  }

  async getAllSessions(): Promise<AgentSession[]> {
    const client = sql();
    const sessions = await client`SELECT * FROM sessions ORDER BY created_at DESC` as Record<string, unknown>[];
    return Promise.all(sessions.map(async (session) => {
      const messages = await client`SELECT * FROM messages WHERE session_id = ${session.id} ORDER BY created_at ASC` as Record<string, unknown>[];
      const outputFiles = await client`SELECT * FROM output_files WHERE session_id = ${session.id} ORDER BY created_at ASC` as Record<string, unknown>[];
      return {
        ...this.mapSessionRow(session),
        messages: messages.map(m => this.mapMessageRow(m)),
        outputFiles: outputFiles.map(f => this.mapOutputFileRow(f)),
      };
    }));
  }

  async updateSessionStatus(sessionId: string, status: AgentStatus): Promise<void> {
    const client = sql();
    await client`UPDATE sessions SET status = ${status}, updated_at = NOW() WHERE id = ${sessionId}`;
  }

  async setSessionId(localSessionId: string, sdkSessionId: string): Promise<void> {
    const client = sql();
    await client`UPDATE sessions SET sdk_session_id = ${sdkSessionId}, updated_at = NOW() WHERE id = ${localSessionId}`;
  }

  async addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage> {
    const client = sql();
    const result = await client`
      INSERT INTO messages (session_id, type, content, tool_name, tool_input, tool_result, parent_tool_use_id)
      VALUES (
        ${sessionId},
        ${message.type},
        ${message.content},
        ${message.toolName || null},
        ${message.toolInput ? JSON.stringify(message.toolInput) : null},
        ${message.toolResult ? JSON.stringify(message.toolResult) : null},
        ${message.parentToolUseId || null}
      )
      RETURNING *
    ` as Record<string, unknown>[];
    await client`UPDATE sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
    return this.mapMessageRow(result[0]);
  }

  async setSessionResult(sessionId: string, result: AgentResult): Promise<void> {
    const client = sql();
    await client`
      UPDATE sessions SET 
        result = ${JSON.stringify(result)},
        status = ${result.success ? 'completed' : 'error'},
        updated_at = NOW()
      WHERE id = ${sessionId}
    `;
  }

  async addOutputFile(sessionId: string, file: Omit<OutputFile, 'id' | 'sessionId' | 'createdAt'>): Promise<OutputFile> {
    const client = sql();
    const result = await client`
      INSERT INTO output_files (session_id, filename, path, type, mime_type, size, content, url)
      VALUES (
        ${sessionId},
        ${file.filename},
        ${file.path},
        ${file.type},
        ${file.mimeType},
        ${file.size},
        ${file.content || null},
        ${file.url || null}
      )
      RETURNING *
    ` as Record<string, unknown>[];
    await client`UPDATE sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
    return this.mapOutputFileRow(result[0]);
  }

  async getOutputFiles(sessionId: string): Promise<OutputFile[]> {
    const client = sql();
    const result = await client`SELECT * FROM output_files WHERE session_id = ${sessionId} ORDER BY created_at ASC` as Record<string, unknown>[];
    return result.map(f => this.mapOutputFileRow(f));
  }

  async deleteSession(id: string): Promise<boolean> {
    const client = sql();
    const result = await client`DELETE FROM sessions WHERE id = ${id} RETURNING id` as Record<string, unknown>[];
    return result.length > 0;
  }

  // Helper methods to map database rows to TypeScript types
  private mapAgentRow(row: Record<string, unknown>): AgentConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      role: (row.role as AgentRole) || 'custom',
      prompt: row.prompt as string,
      allowedTools: row.allowed_tools as AgentConfig['allowedTools'],
      permissionMode: row.permission_mode as AgentConfig['permissionMode'],
      maxTurns: row.max_turns as number | undefined,
      systemPrompt: row.system_prompt as string | undefined,
      cwd: row.cwd as string | undefined,
      outputDir: row.output_dir as string | undefined,
      mcpServers: row.mcp_servers as AgentConfig['mcpServers'],
      enableReplicate: row.enable_replicate as boolean | undefined,
    };
  }

  private mapSessionRow(row: Record<string, unknown>): AgentSession {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      sessionId: row.sdk_session_id as string | undefined,
      status: row.status as AgentStatus,
      messages: [],
      outputFiles: [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      result: row.result as AgentResult | undefined,
    };
  }

  private mapMessageRow(row: Record<string, unknown>): AgentMessage {
    return {
      id: row.id as string,
      timestamp: new Date(row.created_at as string),
      type: row.type as AgentMessage['type'],
      content: row.content as string,
      toolName: row.tool_name as string | undefined,
      toolInput: row.tool_input as unknown,
      toolResult: row.tool_result as unknown,
      parentToolUseId: row.parent_tool_use_id as string | null | undefined,
    };
  }

  private mapOutputFileRow(row: Record<string, unknown>): OutputFile {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      filename: row.filename as string,
      path: row.path as string,
      type: row.type as OutputFile['type'],
      mimeType: row.mime_type as string,
      size: row.size as number,
      content: row.content as string | undefined,
      url: row.url as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Unified store interface that works with both in-memory and database storage
class AgentStore {
  private inMemory = new InMemoryStore();
  private database = new DatabaseStore();

  private useDatabase(): boolean {
    return isDatabaseConfigured();
  }

  // Agent operations
  async createAgent(config: Omit<AgentConfig, 'id'>): Promise<AgentConfig> {
    if (this.useDatabase()) {
      return this.database.createAgent(config);
    }
    return this.inMemory.createAgent(config);
  }

  async getAgent(id: string): Promise<AgentConfig | undefined> {
    if (this.useDatabase()) {
      return this.database.getAgent(id);
    }
    return this.inMemory.getAgent(id);
  }

  async getAllAgents(): Promise<AgentConfig[]> {
    if (this.useDatabase()) {
      return this.database.getAllAgents();
    }
    return this.inMemory.getAllAgents();
  }

  async updateAgent(id: string, updates: Partial<Omit<AgentConfig, 'id'>>): Promise<AgentConfig | undefined> {
    if (this.useDatabase()) {
      return this.database.updateAgent(id, updates);
    }
    return this.inMemory.updateAgent(id, updates);
  }

  async deleteAgent(id: string): Promise<boolean> {
    if (this.useDatabase()) {
      return this.database.deleteAgent(id);
    }
    return this.inMemory.deleteAgent(id);
  }

  // Session operations
  async createSession(agentId: string): Promise<AgentSession> {
    if (this.useDatabase()) {
      return this.database.createSession(agentId);
    }
    return this.inMemory.createSession(agentId);
  }

  async getSession(id: string): Promise<AgentSession | undefined> {
    if (this.useDatabase()) {
      return this.database.getSession(id);
    }
    return this.inMemory.getSession(id);
  }

  async getSessionsForAgent(agentId: string): Promise<AgentSession[]> {
    if (this.useDatabase()) {
      return this.database.getSessionsForAgent(agentId);
    }
    return this.inMemory.getSessionsForAgent(agentId);
  }

  async getAllSessions(): Promise<AgentSession[]> {
    if (this.useDatabase()) {
      return this.database.getAllSessions();
    }
    return this.inMemory.getAllSessions();
  }

  async updateSessionStatus(sessionId: string, status: AgentStatus): Promise<void> {
    if (this.useDatabase()) {
      return this.database.updateSessionStatus(sessionId, status);
    }
    this.inMemory.updateSessionStatus(sessionId, status);
  }

  async setSessionId(localSessionId: string, sdkSessionId: string): Promise<void> {
    if (this.useDatabase()) {
      return this.database.setSessionId(localSessionId, sdkSessionId);
    }
    this.inMemory.setSessionId(localSessionId, sdkSessionId);
  }

  async addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage> {
    if (this.useDatabase()) {
      return this.database.addMessage(sessionId, message);
    }
    return this.inMemory.addMessage(sessionId, message);
  }

  async setSessionResult(sessionId: string, result: AgentResult): Promise<void> {
    if (this.useDatabase()) {
      return this.database.setSessionResult(sessionId, result);
    }
    this.inMemory.setSessionResult(sessionId, result);
  }

  async addOutputFile(sessionId: string, file: Omit<OutputFile, 'id' | 'sessionId' | 'createdAt'>): Promise<OutputFile> {
    if (this.useDatabase()) {
      return this.database.addOutputFile(sessionId, file);
    }
    return this.inMemory.addOutputFile(sessionId, file);
  }

  async getOutputFiles(sessionId: string): Promise<OutputFile[]> {
    if (this.useDatabase()) {
      return this.database.getOutputFiles(sessionId);
    }
    return this.inMemory.getOutputFiles(sessionId);
  }

  async deleteSession(id: string): Promise<boolean> {
    if (this.useDatabase()) {
      return this.database.deleteSession(id);
    }
    return this.inMemory.deleteSession(id);
  }
}

// Extend global to include our store for HMR persistence
declare global {
  // eslint-disable-next-line no-var
  var __agentStoreInstance: AgentStore | undefined;
}

// Singleton instance that persists across HMR in development
function getAgentStore(): AgentStore {
  if (process.env.NODE_ENV === 'development') {
    if (!global.__agentStoreInstance) {
      global.__agentStoreInstance = new AgentStore();
    }
    return global.__agentStoreInstance;
  }
  return new AgentStore();
}

export const agentStore = getAgentStore();
