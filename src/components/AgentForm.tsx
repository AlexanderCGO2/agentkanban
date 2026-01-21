'use client';

import { useState } from 'react';
import { CreateAgentRequest, ToolName, PermissionMode } from '@/types/agent';

const AVAILABLE_TOOLS: ToolName[] = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task'
];

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Standard permission behavior with prompts' },
  { value: 'acceptEdits', label: 'Accept Edits', description: 'Auto-accept file edits without prompts' },
  { value: 'bypassPermissions', label: 'Bypass All', description: 'Bypass all permission checks (dangerous)' },
  { value: 'plan', label: 'Plan Only', description: 'Planning mode - no execution' },
];

interface AgentFormProps {
  onSubmit: (config: CreateAgentRequest) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function AgentForm({ onSubmit, onCancel, loading }: AgentFormProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [allowedTools, setAllowedTools] = useState<ToolName[]>(['Read', 'Glob', 'Grep']);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');
  const [maxTurns, setMaxTurns] = useState<number | undefined>();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToolToggle = (tool: ToolName) => {
    setAllowedTools(prev =>
      prev.includes(tool)
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!prompt.trim()) {
      setError('Base prompt is required');
      return;
    }
    if (allowedTools.length === 0) {
      setError('At least one tool must be selected');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        prompt: prompt.trim(),
        allowedTools,
        permissionMode,
        maxTurns: maxTurns || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      // Reset form on success
      setName('');
      setPrompt('');
      setAllowedTools(['Read', 'Glob', 'Grep']);
      setPermissionMode('default');
      setMaxTurns(undefined);
      setSystemPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Agent Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Code Reviewer, Bug Fixer"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Base Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe what this agent should do..."
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Allowed Tools
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TOOLS.map(tool => (
            <button
              key={tool}
              type="button"
              onClick={() => handleToolToggle(tool)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                allowedTools.includes(tool)
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'
              }`}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Permission Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PERMISSION_MODES.map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setPermissionMode(mode.value)}
              className={`rounded-lg p-3 text-left transition-colors ${
                permissionMode === mode.value
                  ? 'bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-900/40'
                  : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <div className="font-medium text-zinc-900 dark:text-white">{mode.label}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showAdvanced ? '- Hide Advanced Options' : '+ Show Advanced Options'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <div>
            <label htmlFor="maxTurns" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Max Turns (optional)
            </label>
            <input
              type="number"
              id="maxTurns"
              value={maxTurns || ''}
              onChange={(e) => setMaxTurns(e.target.value ? parseInt(e.target.value) : undefined)}
              min={1}
              placeholder="No limit"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Custom System Prompt (optional)
            </label>
            <textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="Custom instructions for the agent..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Agent'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
