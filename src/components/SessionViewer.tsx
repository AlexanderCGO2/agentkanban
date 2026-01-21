'use client';

import { AgentSession, AgentConfig } from '@/types/agent';
import { MessageList } from './MessageList';

interface SessionViewerProps {
  session: AgentSession;
  agent?: AgentConfig;
  onClose: () => void;
}

export function SessionViewer({ session, agent, onClose }: SessionViewerProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: AgentSession['status']) => {
    switch (status) {
      case 'idle':
        return 'text-zinc-600 dark:text-zinc-400';
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {agent?.name || 'Session Details'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-sm font-medium ${getStatusColor(session.status)}`}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(session.createdAt)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Result Summary */}
        {session.result && (
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
            <div className={`rounded-lg p-4 ${session.result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-center gap-2 mb-3">
                {session.result.success ? (
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`font-medium ${session.result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {session.result.success ? 'Completed Successfully' : 'Failed'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
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
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Tokens</span>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {session.result.usage.inputTokens.toLocaleString()} / {session.result.usage.outputTokens.toLocaleString()}
                  </p>
                </div>
              </div>

              {session.result.error && (
                <div className="mt-3 rounded bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {session.result.error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {session.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  No messages in this session
                </p>
              </div>
            </div>
          ) : (
            <MessageList messages={session.messages} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>Session ID: {session.id}</span>
            {session.sessionId && (
              <span>SDK Session: {session.sessionId.slice(0, 8)}...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
