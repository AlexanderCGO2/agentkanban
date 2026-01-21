'use client';

import { AgentSession, AgentConfig } from '@/types/agent';

interface SessionListProps {
  sessions: AgentSession[];
  agents: AgentConfig[];
  onSelect: (session: AgentSession) => void;
  onDelete: (id: string) => void;
}

export function SessionList({ sessions, agents, onSelect, onDelete }: SessionListProps) {
  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || 'Unknown Agent';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: AgentSession['status']) => {
    const styles = {
      idle: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
      running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };

    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No sessions yet. Run an agent to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map(session => (
        <div
          key={session.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-zinc-900 dark:text-white">
                  {getAgentName(session.agentId)}
                </h4>
                {getStatusBadge(session.status)}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(session.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onSelect(session)}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                View
              </button>
              <button
                onClick={() => onDelete(session.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          </div>

          {session.messages.length > 0 && (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
            </div>
          )}

          {session.result && (
            <div className="mt-3 grid grid-cols-3 gap-4 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900/50">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Duration</span>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {(session.result.durationMs / 1000).toFixed(2)}s
                </p>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Turns</span>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {session.result.numTurns}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Cost</span>
                <p className="font-medium text-zinc-900 dark:text-white">
                  ${session.result.totalCostUsd.toFixed(4)}
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
