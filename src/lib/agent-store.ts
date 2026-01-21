import { AgentConfig, AgentSession, AgentMessage, AgentResult, AgentStatus } from '@/types/agent';
import { v4 as uuidv4 } from 'uuid';

// In-memory store for agents and sessions
// In production, this would be replaced with a database
class AgentStore {
  private agents: Map<string, AgentConfig> = new Map();
  private sessions: Map<string, AgentSession> = new Map();
  private sessionsByAgent: Map<string, string[]> = new Map();

  // Agent CRUD operations
  createAgent(config: Omit<AgentConfig, 'id'>): AgentConfig {
    const id = uuidv4();
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
      // Clean up sessions for this agent
      const sessionIds = this.sessionsByAgent.get(id) || [];
      sessionIds.forEach(sessionId => this.sessions.delete(sessionId));
      this.sessionsByAgent.delete(id);
    }
    return deleted;
  }

  // Session operations
  createSession(agentId: string): AgentSession {
    const id = uuidv4();
    const session: AgentSession = {
      id,
      agentId,
      status: 'idle',
      messages: [],
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
      id: uuidv4(),
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

// Singleton instance
export const agentStore = new AgentStore();
