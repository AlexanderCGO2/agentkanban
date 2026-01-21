'use client';

import { useState } from 'react';
import { AgentConfig, AgentMessage, AgentResult, OutputFile } from '@/types/agent';
import { MessageList } from './MessageList';
import { OutputViewer } from './OutputViewer';

interface AgentRunnerProps {
  agent: AgentConfig;
  messages: AgentMessage[];
  result: AgentResult | null;
  running: boolean;
  error: string | null;
  sessionId: string | null;
  outputFiles: OutputFile[];
  onRun: (prompt: string) => void;
  onClose: () => void;
}

export function AgentRunner({
  agent,
  messages,
  result,
  running,
  error,
  sessionId,
  outputFiles,
  onRun,
  onClose,
}: AgentRunnerProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || running) return;
    onRun(prompt.trim());
    setPrompt('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {agent.name}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'Ready to run'}
            </p>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !running && (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-zinc-900 dark:text-white">
                  Start a conversation
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Enter a prompt below to run the agent
                </p>
              </div>
            </div>
          )}

          <MessageList messages={messages} />

          {running && (
            <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Agent is working...
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className={`mt-4 rounded-lg p-4 ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`font-medium ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {result.success ? 'Completed' : 'Failed'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Duration</span>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {(result.durationMs / 1000).toFixed(2)}s
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Turns</span>
                  <p className="font-medium text-zinc-900 dark:text-white">{result.numTurns}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Cost</span>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    ${result.totalCostUsd.toFixed(4)}
                  </p>
                </div>
              </div>
              {result.usage && (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Tokens: {result.usage.inputTokens.toLocaleString()} in / {result.usage.outputTokens.toLocaleString()} out
                </div>
              )}
            </div>
          )}

          {outputFiles.length > 0 && (
            <div className="mt-4">
              <OutputViewer files={outputFiles} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              disabled={running}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={running || !prompt.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
