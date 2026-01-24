'use client';

import { useState } from 'react';
import { ToolName, PermissionMode, AgentRole, McpServerConfig, CreateAgentRequest } from '@/types/agent';
import { AGENT_TEMPLATES, AgentTemplate, getAllTemplates, McpServerConfig as TemplateMcpConfig } from '@/lib/agent-templates';

const AVAILABLE_TOOLS: ToolName[] = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task', 'NotebookEdit'
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

type FormStep = 'template' | 'configure';

export function AgentForm({ onSubmit, onCancel, loading }: AgentFormProps) {
  const [step, setStep] = useState<FormStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState<AgentRole>('custom');
  const [prompt, setPrompt] = useState('');
  const [allowedTools, setAllowedTools] = useState<ToolName[]>(['Read', 'Write', 'Glob', 'Grep']);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('acceptEdits');
  const [maxTurns, setMaxTurns] = useState<number | undefined>();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enableReplicate, setEnableReplicate] = useState(true); // Enabled by default
  const [mcpServers, setMcpServers] = useState<Record<string, McpServerConfig> | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = getAllTemplates();

  const handleSelectTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setRole(template.role);
    setPrompt(template.defaultPrompt);
    setAllowedTools(template.allowedTools);
    setPermissionMode(template.permissionMode);
    setMaxTurns(template.maxTurns);
    setSystemPrompt(template.systemPrompt);
    setEnableReplicate(template.enableReplicate ?? false);
    // Convert template MCP config to agent MCP config
    if (template.mcpServers) {
      const converted: Record<string, McpServerConfig> = {};
      for (const [key, val] of Object.entries(template.mcpServers)) {
        converted[key] = {
          command: val.command || 'http',
          args: val.args,
          env: { ...val.env, ...(val.url ? { MCP_URL: val.url } : {}) },
        };
      }
      setMcpServers(converted);
    } else {
      setMcpServers(undefined);
    }
    setStep('configure');
  };

  const handleSelectCustom = () => {
    const customTemplate = AGENT_TEMPLATES.custom;
    setSelectedTemplate(customTemplate);
    setRole('custom');
    setName('');
    setPrompt('');
    setAllowedTools(['Read', 'Write', 'Glob', 'Grep']);
    setPermissionMode('acceptEdits');
    setMaxTurns(undefined);
    setSystemPrompt('');
    setMcpServers(undefined);
    setStep('configure');
  };

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
        role,
        prompt: prompt.trim(),
        allowedTools,
        permissionMode,
        maxTurns: maxTurns || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        enableReplicate,
        mcpServers,
      });
      // Reset form on success
      setStep('template');
      setSelectedTemplate(null);
      setName('');
      setRole('custom');
      setPrompt('');
      setAllowedTools(['Read', 'Write', 'Glob', 'Grep']);
      setPermissionMode('acceptEdits');
      setMaxTurns(undefined);
      setSystemPrompt('');
      setEnableReplicate(false);
      setMcpServers(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const handleBack = () => {
    setStep('template');
    setSelectedTemplate(null);
  };

  // Template selection step
  if (step === 'template') {
    return (
      <div className="space-y-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choose an agent template to get started quickly, or create a custom agent from scratch.
        </p>

        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map((template) => (
            <button
              key={template.role}
              onClick={() => handleSelectTemplate(template)}
              className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${template.color.border} ${template.color.bg}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${template.color.gradient} opacity-0 transition-opacity group-hover:opacity-10`} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{template.icon}</span>
                  <h3 className={`font-semibold ${template.color.text}`}>
                    {template.name}
                  </h3>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {template.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.skills.slice(0, 2).map((skill, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-white/60 dark:bg-black/20 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      {skill.input} → {skill.output}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Agent Option */}
        <button
          onClick={handleSelectCustom}
          className="w-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-left transition-all hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                Custom Agent
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Create a fully customized agent from scratch
              </p>
            </div>
          </div>
        </button>

        {onCancel && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Configuration step
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Header */}
      {selectedTemplate && selectedTemplate.role !== 'custom' && (
        <div className={`-mx-6 -mt-6 px-6 py-4 mb-6 ${selectedTemplate.color.bg} border-b ${selectedTemplate.color.border}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selectedTemplate.icon}</span>
            <div>
              <h3 className={`font-bold text-lg ${selectedTemplate.color.text}`}>
                {selectedTemplate.name}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {selectedTemplate.description}
              </p>
            </div>
          </div>
        </div>
      )}

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
          rows={3}
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

      {/* Integrations */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Integrations
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 cursor-pointer transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600">
            <input
              type="checkbox"
              checked={enableReplicate}
              onChange={(e) => setEnableReplicate(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700"
            />
            <div className="flex-1">
              <div className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                Replicate AI
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  Image Generation
                </span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Enable image generation using Flux, SDXL, and other models via Replicate
              </div>
            </div>
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Requires REPLICATE_API_TOKEN environment variable
        </p>
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
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Custom instructions for the agent..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {selectedTemplate?.role !== 'custom' && 'Pre-filled from template. '}
              Defines the agent&apos;s personality and behavior.
            </p>
          </div>

          {/* MCP Tools Info for templates */}
          {selectedTemplate && selectedTemplate.mcpTools.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Recommended MCP Tools
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedTemplate.mcpTools.map((tool, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Configure MCP servers separately to enable these integrations
              </p>
            </div>
          )}

          {/* Skill Matrix for templates */}
          {selectedTemplate && selectedTemplate.skills.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Skill Matrix (Input → Output)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {selectedTemplate.skills.map((skill, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-white p-2 dark:bg-zinc-700"
                  >
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {skill.input}
                    </span>
                    <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                      {skill.output}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back
        </button>
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
