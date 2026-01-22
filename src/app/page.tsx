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
  const { running, messages, result, sessionId, outputFiles, error, runAgent, reset } = useAgentRunner();

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 bg-clip-text text-transparent dark:from-white dark:via-zinc-300 dark:to-white">
                  Craisee Agent Hub
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Orchestrate intelligent AI agents
                </p>
              </div>
            </div>
            
            {activeTab === 'agents' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-110"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Agent
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 rounded-xl bg-zinc-100/80 p-1 dark:bg-zinc-800/80">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === 'agents'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Agents
                {agents.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {agents.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === 'sessions'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sessions
                {sessions.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {sessions.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'agents' && (
          <>
            {agentsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading agents...</span>
                </div>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
                  <svg className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  No agents yet
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Create your first AI agent to automate design, development, research, and more.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-110"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Agent
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent, index) => (
                  <div key={agent.id} className="stagger-item" style={{ animationDelay: `${index * 50}ms` }}>
                    <AgentCard
                      agent={agent}
                      onRun={handleRunAgent}
                      onDelete={deleteAgent}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'sessions' && (
          <>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading sessions...</span>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div 
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 max-h-[90vh] overflow-hidden animate-fade-in"
          >
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Create New Agent
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <AgentForm
                onSubmit={handleCreateAgent}
                onCancel={() => setShowCreateForm(false)}
                loading={createLoading}
              />
            </div>
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
          outputFiles={outputFiles}
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
