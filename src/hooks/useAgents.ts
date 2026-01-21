'use client';

import { useState, useCallback, useEffect } from 'react';
import { AgentConfig, AgentSession, CreateAgentRequest, AgentMessage, AgentResult } from '@/types/agent';

export function useAgents() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (config: CreateAgentRequest): Promise<AgentConfig> => {
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create agent');
    }
    const agent = await response.json();
    setAgents(prev => [...prev, agent]);
    return agent;
  }, []);

  const deleteAgent = useCallback(async (id: string) => {
    const response = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete agent');
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, loading, error, fetchAgents, createAgent, deleteAgent };
}

export function useSessions() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    const response = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete session');
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, fetchSessions, deleteSession };
}

export function useAgentRunner() {
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAgent = useCallback(async (agentId: string, prompt: string) => {
    setRunning(true);
    setMessages([]);
    setResult(null);
    setError(null);
    setSessionId(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run agent');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'session_start') {
                setSessionId(data.sessionId);
              } else if (data.type === 'complete') {
                setResult(data.result);
              } else if (data.type === 'error') {
                setError(data.error);
              } else if (data.id) {
                // It's an AgentMessage
                setMessages(prev => [...prev, data]);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setResult(null);
    setSessionId(null);
    setError(null);
  }, []);

  return { running, messages, result, sessionId, error, runAgent, reset };
}
