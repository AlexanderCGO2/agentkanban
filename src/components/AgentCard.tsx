'use client';

import { AgentConfig } from '@/types/agent';
import { AGENT_TEMPLATES } from '@/lib/agent-templates';

interface AgentCardProps {
  agent: AgentConfig;
  onRun: (agent: AgentConfig) => void;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onRun, onDelete }: AgentCardProps) {
  const template = AGENT_TEMPLATES[agent.role] || AGENT_TEMPLATES.custom;

  return (
    <div 
      className={`group relative overflow-hidden rounded-xl border-2 shadow-sm transition-all hover:shadow-lg hover:scale-[1.01] ${template.color.border} ${template.color.bg}`}
    >
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${template.color.gradient} opacity-0 transition-opacity group-hover:opacity-5`} />
      
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Role badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{template.icon}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${template.color.text} bg-white/60 dark:bg-black/20`}>
                {template.name}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate">
              {agent.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
              {agent.prompt}
            </p>
          </div>
        </div>

        {/* Tools */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.allowedTools.slice(0, 5).map(tool => (
            <span
              key={tool}
              className="rounded-full bg-white/80 dark:bg-zinc-800/80 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50"
            >
              {tool}
            </span>
          ))}
          {agent.allowedTools.length > 5 && (
            <span className="rounded-full bg-white/80 dark:bg-zinc-800/80 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              +{agent.allowedTools.length - 5}
            </span>
          )}
        </div>

        {/* Meta info */}
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

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onRun(agent)}
            className={`flex-1 rounded-lg bg-gradient-to-r ${template.color.gradient} px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run
            </span>
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="rounded-lg border border-red-200 bg-white/80 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/50 dark:bg-zinc-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Delete agent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
