'use client';

import { useState } from 'react';
import { AgentForm } from '@/components/AgentForm';
import { AgentCard } from '@/components/AgentCard';
import { AgentRunner } from '@/components/AgentRunner';
import { SessionList } from '@/components/SessionList';
import { SessionViewer } from '@/components/SessionViewer';
import { useAgents, useSessions, useAgentRunner } from '@/hooks/useAgents';
import { AgentConfig, AgentSession } from '@/types/agent';

type Tab = 'agents' | 'sessions';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const { agents, loading: agentsLoading, createAgent, deleteAgent } = useAgents();
  const { sessions, loading: sessionsLoading, fetchSessions, deleteSession } = useSessions();
  const { running, messages, result, sessionId, error, runAgent, reset } = useAgentRunner();

  const handleCreateAgent = async (config: Parameters<typeof createAgent>[0]) => {
    setCreateLoading(true);
    try {
      await createAgent(config);
      setShowCreateForm(false);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRunAgent = (agent: AgentConfig) => {
    reset();
    setSelectedAgent(agent);
  };

  const handleCloseRunner = () => {
    setSelectedAgent(null);
    reset();
    // Refresh sessions to show the new one
    fetchSessions();
  };

  const handleViewSession = (session: AgentSession) => {
    setSelectedSession(session);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Claude Agent Manager
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create and monitor Claude agents powered by the Agent SDK
              </p>
            </div>
            {activeTab === 'agents' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Agent
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1">
            <button
              onClick={() => setActiveTab('agents')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'agents'
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
              }`}
            >
              Agents
              {agents.length > 0 && (
                <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
                  {agents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
              }`}
            >
              Sessions
              {sessions.length > 0 && (
                <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'agents' && (
          <>
            {agentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="h-8 w-8 animate-spin text-zinc-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                  No agents yet
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Create your first agent to get started
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Agent
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onRun={handleRunAgent}
                    onDelete={deleteAgent}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'sessions' && (
          <>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="h-8 w-8 animate-spin text-zinc-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : (
              <SessionList
                sessions={sessions}
                agents={agents}
                onSelect={handleViewSession}
                onDelete={deleteSession}
              />
            )}
          </>
        )}
      </main>

      {/* Create Agent Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Create New Agent
              </h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <AgentForm
              onSubmit={handleCreateAgent}
              onCancel={() => setShowCreateForm(false)}
              loading={createLoading}
            />
          </div>
        </div>
      )}

      {/* Agent Runner Modal */}
      {selectedAgent && (
        <AgentRunner
          agent={selectedAgent}
          messages={messages}
          result={result}
          running={running}
          error={error}
          sessionId={sessionId}
          onRun={(prompt) => runAgent(selectedAgent.id, prompt)}
          onClose={handleCloseRunner}
        />
      )}

      {/* Session Viewer Modal */}
      {selectedSession && (
        <SessionViewer
          session={selectedSession}
          agent={agents.find(a => a.id === selectedSession.agentId)}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
