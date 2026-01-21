'use client';

import { AgentConfig } from '@/types/agent';

interface AgentCardProps {
  agent: AgentConfig;
  onRun: (agent: AgentConfig) => void;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onRun, onDelete }: AgentCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {agent.prompt}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onRun(agent)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Run
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {agent.allowedTools.map(tool => (
          <span
            key={tool}
            className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          >
            {tool}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {agent.permissionMode}
        </span>
        {agent.maxTurns && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {agent.maxTurns} turns
          </span>
        )}
      </div>
    </div>
  );
}
