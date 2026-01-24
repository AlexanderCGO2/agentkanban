'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AgentConfig, AgentMessage, AgentResult, OutputFile } from '@/types/agent';
import { AGENT_TEMPLATES } from '@/lib/agent-templates';
import { OutputViewer } from './OutputViewer';
import { useV0 } from '@/hooks/useV0';
import { AgentFlowCanvas } from './AgentFlowCanvas';
import { CanvasViewer, extractCanvasIdsFromMessages } from './CanvasViewer';

// AI Elements imports
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  Suggestions,
  Suggestion,
  Loader,
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  Reasoning,
  ReasoningContent,
  ReasoningStep,
  type PromptInputMessage,
} from './ai-elements';

// Local type for message from (ai-elements Message component uses UIMessage["role"] from 'ai' package)
type MessageFrom = 'user' | 'assistant' | 'system';

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

// Role-specific suggestions
const ROLE_SUGGESTIONS: Record<string, string[]> = {
  design: [
    'Create a dashboard UI with charts and metrics',
    'Design a login page with social auth options',
    'Create a product card component with hover effects',
    'Design a responsive navigation menu',
  ],
  developer: [
    'Implement a REST API endpoint for user authentication',
    'Create a React component with TypeScript',
    'Set up a database migration script',
    'Write unit tests for the utility functions',
  ],
  'data-analyst': [
    'Analyze this CSV data and find trends',
    'Create a visualization of sales data',
    'Generate a statistical summary report',
    'Identify outliers in the dataset',
  ],
  intern: [
    'Research best practices for React performance',
    'Compile a list of competitor features',
    'Summarize the latest industry trends',
    'Create documentation for the API',
  ],
  'project-manager': [
    'Create a project plan with milestones',
    'Break down this feature into tasks',
    'Generate a sprint backlog',
    'Create a risk assessment document',
  ],
  'team-assist': [
    'Summarize the meeting notes',
    'Create action items from this discussion',
    'Draft a status update email',
    'Organize the team calendar',
  ],
  copywriter: [
    'Write landing page copy for a SaaS product',
    'Create email subject line variations',
    'Draft social media posts for product launch',
    'Write a blog post about industry trends',
  ],
  accountant: [
    'Calculate quarterly expenses breakdown',
    'Generate a financial summary report',
    'Create an invoice template',
    'Analyze budget vs actual spending',
  ],
  'ui-generator': [
    'Generate a concise chat response with suggested next actions',
    'Summarize this request into UI message blocks',
    'Create a helpful assistant reply and 3 suggestions',
  ],
  custom: [
    'Help me with this task',
    'Analyze this information',
    'Create a document',
    'Research this topic',
  ],
};

// Agents that should show preview panel
const PREVIEW_ENABLED_ROLES = ['design', 'developer', 'data-analyst', 'copywriter'];

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
  const [showPreview, setShowPreview] = useState(false);
  const [showFlowView, setShowFlowView] = useState(false);
  const [showCanvasView, setShowCanvasView] = useState(false);
  const [showFilesView, setShowFilesView] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [useV0Generation, setUseV0Generation] = useState(false);
  
  // Extract canvas IDs from messages
  const canvasIds = useMemo(() => {
    return extractCanvasIdsFromMessages(messages);
  }, [messages]);
  
  // Auto-show canvas view when canvases are created
  useEffect(() => {
    if (canvasIds.length > 0 && !showCanvasView && !showPreview && !showFlowView && !showFilesView) {
      setShowCanvasView(true);
    }
  }, [canvasIds.length, showCanvasView, showPreview, showFlowView, showFilesView]);

  // Auto-show files view when files are created
  useEffect(() => {
    if (outputFiles.length > 0 && !showFilesView && !showCanvasView && !showPreview && !showFlowView) {
      setShowFilesView(true);
    }
  }, [outputFiles.length, showFilesView, showCanvasView, showPreview, showFlowView]);
  const template = AGENT_TEMPLATES[agent.role] || AGENT_TEMPLATES.custom;

  // v0 integration for design agent
  const v0 = useV0();

  // Check v0 configuration on mount for design agents
  useEffect(() => {
    if (agent.role === 'design') {
      v0.checkConfiguration();
    }
  }, [agent.role, v0.checkConfiguration]);

  // Check if this agent should show preview
  const canShowPreview = PREVIEW_ENABLED_ROLES.includes(agent.role);
  const canUseV0 = agent.role === 'design' && v0.isConfigured;

  // Extract previewable content from output files or v0 response
  const previewContent = useMemo(() => {
    // If v0 has generated a demo, use that
    if (v0.response?.demo) {
      return {
        type: 'v0' as const,
        url: v0.response.demo,
        filename: 'v0 Preview',
      };
    }

    // Look for HTML files first
    const htmlFile = outputFiles.find(f => f.filename.endsWith('.html') && f.content);
    if (htmlFile?.content) {
      return {
        type: 'html' as const,
        url: `data:text/html;charset=utf-8,${encodeURIComponent(htmlFile.content)}`,
        filename: htmlFile.filename,
      };
    }

    // Look for markdown files
    const mdFile = outputFiles.find(f => (f.filename.endsWith('.md') || f.filename.endsWith('.markdown')) && f.content);
    if (mdFile?.content) {
      // Wrap markdown in basic HTML
      const htmlContent = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
  pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
  code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
  h1, h2, h3 { margin-top: 1.5em; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1rem; color: #666; }
</style>
</head><body>
<pre style="white-space: pre-wrap;">${mdFile.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body></html>`;
      return {
        type: 'markdown' as const,
        url: `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
        filename: mdFile.filename,
      };
    }

    // Check for JSON data that could be visualized
    const jsonFile = outputFiles.find(f => f.filename.endsWith('.json') && f.content);
    if (jsonFile?.content) {
      const htmlContent = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body { font-family: monospace; padding: 1rem; background: #1e1e1e; color: #d4d4d4; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
</style>
</head><body>
<pre>${JSON.stringify(JSON.parse(jsonFile.content), null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body></html>`;
      return {
        type: 'json' as const,
        url: `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
        filename: jsonFile.filename,
      };
    }

    return null;
  }, [outputFiles, v0.response]);

  // Auto-show preview when content is available
  useEffect(() => {
    if (previewContent && canShowPreview) {
      setShowPreview(true);
    }
  }, [previewContent, canShowPreview]);

  // Handle v0 generation
  const handleV0Generate = useCallback(async (text: string) => {
    const response = await v0.generate(text);
    if (response?.demo) {
      setShowPreview(true);
    }
  }, [v0]);

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim();
    if (!text || running) return;

    // If v0 mode is enabled for design agent, use v0 generation
    if (useV0Generation && canUseV0) {
      handleV0Generate(text);
      setPrompt('');
      return;
    }

    onRun(text);
    setPrompt('');
  };

  const getPlaceholder = () => {
    switch (agent.role) {
      case 'design':
        return 'Describe the feature or component you want designed...';
      case 'intern':
        return 'What would you like me to research or compile?';
      case 'project-manager':
        return 'Describe the project or tasks to plan...';
      case 'team-assist':
        return 'What would you like help coordinating or summarizing?';
      case 'data-analyst':
        return 'What data would you like analyzed or what insights do you need?';
      case 'copywriter':
        return 'Describe the content you need written...';
      case 'accountant':
        return 'What financial data or calculations do you need processed?';
      case 'developer':
        return 'Describe the feature to implement or bug to fix...';
      case 'ui-generator':
        return 'Describe the UI response you want rendered...';
      default:
        return 'Enter your request...';
    }
  };

  const suggestions = ROLE_SUGGESTIONS[agent.role] || ROLE_SUGGESTIONS.custom;

  // Map agent message types to AI Elements message types
  const getMessageFrom = (type: AgentMessage['type']): MessageFrom => {
    switch (type) {
      case 'user':
        return 'user';
      case 'assistant':
      case 'result':
        return 'assistant';
      case 'system':
        return 'system';
      case 'tool_use':
      case 'tool_result':
        return 'assistant'; // Tool messages shown as assistant
      default:
        return 'assistant';
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Group tool_use and tool_result messages for reasoning display
  const toolMessages = messages.filter(m => m.type === 'tool_use' || m.type === 'tool_result');
  const regularMessages = messages.filter(m => m.type !== 'tool_use' && m.type !== 'tool_result');

  const toggleReasoning = (id: string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
      <div className={`flex h-[90vh] w-full ${(showPreview && previewContent) || showFlowView || showCanvasView || showFilesView ? 'max-w-7xl' : 'max-w-4xl'} flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 overflow-hidden animate-fade-in`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-6 py-4 ${template.color.border} ${template.color.bg}`}>
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${template.color.gradient} text-white text-2xl shadow-lg`}>
              {template.icon}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${template.color.text}`}>
                {agent.name}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'Ready to run'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* v0 Toggle for design agents */}
            {canUseV0 && (
              <button
                onClick={() => setUseV0Generation(!useV0Generation)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  useV0Generation
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                    : 'bg-white/50 text-zinc-600 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-black/30'
                }`}
                title="Generate React components with v0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                v0
              </button>
            )}
            {/* Flow View Toggle */}
            <button
              onClick={() => {
                setShowFlowView(!showFlowView);
                if (!showFlowView) {
                  setShowCanvasView(false);
                  setShowPreview(false);
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                showFlowView
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-white/50 text-zinc-600 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-black/30'
              }`}
              title="Show agent execution flow diagram"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Flow
            </button>
            
            {/* Canvas View Toggle */}
            <button
              onClick={() => {
                setShowCanvasView(!showCanvasView);
                if (!showCanvasView) {
                  setShowFlowView(false);
                  setShowPreview(false);
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                showCanvasView
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                  : 'bg-white/50 text-zinc-600 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-black/30'
              }`}
              title="Show agent-created diagrams"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Canvas
              {canvasIds.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-violet-500 text-white rounded-full">
                  {canvasIds.length}
                </span>
              )}
            </button>
            {/* Files View Toggle */}
            <button
              onClick={() => {
                setShowFilesView(!showFilesView);
                if (!showFilesView) {
                  setShowFlowView(false);
                  setShowCanvasView(false);
                  setShowPreview(false);
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                showFilesView
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  : 'bg-white/50 text-zinc-600 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-black/30'
              }`}
              title="Show created files"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Files
              {outputFiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                  {outputFiles.length}
                </span>
              )}
            </button>
            {canShowPreview && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  showPreview
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'bg-white/50 text-zinc-600 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:hover:bg-black/30'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Preview
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-black/20 dark:hover:text-zinc-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tool badges */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tools:</span>
          <div className="flex flex-wrap gap-1">
            {agent.allowedTools.map(tool => (
              <span
                key={tool}
                className="rounded-full bg-white dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat Panel */}
          <div className={`flex flex-col ${(showPreview && previewContent) || showFlowView || showCanvasView || showFilesView ? 'w-1/2 border-r border-zinc-200 dark:border-zinc-700' : 'w-full'}`}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.length === 0 && !running && (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="max-w-md">
                    <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${template.color.gradient} text-white text-4xl shadow-xl`}>
                      {template.icon}
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                      {template.name} Ready
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {template.description}
                    </p>

                    {/* Suggestions */}
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                        Try these:
                      </p>
                      <Suggestions>
                        {suggestions.slice(0, 3).map((suggestion, i) => (
                          <Suggestion
                            key={i}
                            suggestion={suggestion}
                            onClick={() => setPrompt(suggestion)}
                          />
                        ))}
                      </Suggestions>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-left">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>💡 Tip:</strong> This agent will use tools autonomously to complete your request.
                        Output files will appear below when the agent creates them.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <Conversation>
                  <ConversationContent>
                    {messages.map((message) => {
                      const from = getMessageFrom(message.type);

                      // Show tool messages as Reasoning component
                      if (message.type === 'tool_use') {
                        return (
                          <div key={message.id} className="my-2">
                            <Reasoning
                              expanded={expandedReasoning.has(message.id)}
                              onToggle={() => toggleReasoning(message.id)}
                            >
                              <ReasoningContent>
                                <ReasoningStep
                                  step={1}
                                  title={message.toolName || 'Tool'}
                                  status="complete"
                                >
                                  {message.content}
                                  {message.toolInput !== undefined && message.toolInput !== null && (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-violet-500 hover:text-violet-700 dark:hover:text-violet-300">
                                        View input
                                      </summary>
                                      <pre className="mt-1 overflow-x-auto rounded bg-violet-100 p-2 text-xs dark:bg-violet-900/30">
                                        {JSON.stringify(message.toolInput, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </ReasoningStep>
                              </ReasoningContent>
                            </Reasoning>
                          </div>
                        );
                      }

                      // Show tool results inline with less prominence
                      if (message.type === 'tool_result') {
                        return (
                          <div key={message.id} className="my-1 ml-10 text-xs text-emerald-600 dark:text-emerald-400">
                            <div className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="truncate max-w-[300px]">{message.content}</span>
                            </div>
                          </div>
                        );
                      }

                      // Regular messages
                      return (
                        <Message key={message.id} from={from}>
                          <MessageContent>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {formatTime(message.timestamp)}
                            </span>
                          </MessageContent>
                        </Message>
                      );
                    })}
                  </ConversationContent>
                </Conversation>
              )}

              {/* Running state with Loader */}
              {running && (
                <div className={`mt-4 flex items-center gap-3 rounded-xl p-4 ${template.color.bg}`}>
                  <Loader variant="dots" size="md" />
                  <div>
                    <p className={`font-medium ${template.color.text}`}>Agent is working...</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Using tools to complete your request
                    </p>
                  </div>
                </div>
              )}

              {/* v0 Loading state */}
              {v0.isLoading && (
                <div className="mt-4 flex items-center gap-3 rounded-xl p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800">
                  <Loader variant="dots" size="md" />
                  <div>
                    <p className="font-medium text-violet-700 dark:text-violet-300">Generating with v0...</p>
                    <p className="text-xs text-violet-500 dark:text-violet-400">
                      Creating React component preview
                    </p>
                  </div>
                </div>
              )}

              {/* v0 Error display */}
              {v0.error && (
                <div className="mt-4 rounded-xl bg-violet-50 p-4 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-violet-600 dark:text-violet-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-violet-700 dark:text-violet-400">v0 Error</p>
                      <p className="mt-1 text-sm text-violet-600 dark:text-violet-300">{v0.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Error occurred</p>
                      <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Result display */}
              {result && (
                <div className={`mt-4 rounded-xl p-4 border ${result.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
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
                      {result.success ? 'Task Completed' : 'Task Failed'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Duration</span>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {(result.durationMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Turns</span>
                      <p className="font-semibold text-zinc-900 dark:text-white">{result.numTurns}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Cost</span>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        ${result.totalCostUsd.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400">Tokens</span>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {((result.usage.inputTokens + result.usage.outputTokens) / 1000).toFixed(1)}k
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Output files */}
              {outputFiles.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Output Files ({outputFiles.length})
                    </span>
                  </div>
                  <OutputViewer files={outputFiles} />
                </div>
              )}
            </div>

            {/* Input - uncontrolled form with ref */}
            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem('prompt') as HTMLTextAreaElement;
                  const text = input?.value?.trim();
                  if (!text || running) return;
                  if (useV0Generation && canUseV0) {
                    handleV0Generate(text);
                    input.value = '';
                    return;
                  }
                  onRun(text);
                  input.value = '';
                }}
                className="relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm transition-all focus-within:border-zinc-300 focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-600"
              >
                <textarea
                  name="prompt"
                  defaultValue=""
                  placeholder={getPlaceholder()}
                  disabled={running}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100 dark:placeholder-zinc-400 min-h-[36px] max-h-[200px]"
                />
                <button
                  type="submit"
                  disabled={running}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                    running
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:brightness-110'
                  } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100`}
                >
                  {running ? (
                    <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Flow View Panel */}
          {showFlowView && !showPreview && !showCanvasView && !showFilesView && (
            <div className="w-1/2 flex flex-col border-l border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Agent Flow
                </span>
                <span className="text-xs text-zinc-500">{messages.length} steps</span>
              </div>
              <AgentFlowCanvas 
                messages={messages} 
                running={running}
                className="flex-1"
              />
            </div>
          )}

          {/* Canvas View Panel */}
          {showCanvasView && !showPreview && !showFlowView && !showFilesView && (
            <div className="w-1/2 flex flex-col border-l border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  Created Diagrams
                </span>
                <span className="text-xs text-zinc-500">{canvasIds.length} canvas{canvasIds.length !== 1 ? 'es' : ''}</span>
              </div>
              <CanvasViewer
                canvasIds={canvasIds}
                className="flex-1"
              />
            </div>
          )}

          {/* Files View Panel */}
          {showFilesView && !showPreview && !showFlowView && !showCanvasView && (
            <div className="w-1/2 flex flex-col border-l border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Created Files
                </span>
                <span className="text-xs text-zinc-500">{outputFiles.length} file{outputFiles.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-zinc-900">
                {outputFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    <div className="text-center">
                      <svg className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-sm">No files created yet</p>
                      <p className="text-xs mt-1 text-zinc-600">Files will appear here as the agent creates them</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outputFiles.map((file, index) => (
                      <div key={index} className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-700/50">
                          <span className="text-sm font-mono text-zinc-200">{file.filename}</span>
                          <div className="flex gap-2">
                            {file.content && (
                              <button
                                onClick={() => navigator.clipboard.writeText(file.content!)}
                                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Copy content"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            )}
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Open in new tab"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                        {file.content && (
                          <pre className="p-3 text-xs text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto">
                            {file.content.slice(0, 2000)}
                            {file.content.length > 2000 && '\n... (truncated)'}
                          </pre>
                        )}
                        {file.url && !file.content && (
                          <div className="p-3">
                            {file.url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) ? (
                              <img src={file.url} alt={file.filename} className="max-w-full h-auto rounded" />
                            ) : (
                              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm">
                                {file.url}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {showPreview && previewContent && (
            <div className="w-1/2 flex flex-col">
              <WebPreview>
                <WebPreviewNavigation>
                  <WebPreviewUrl
                    readOnly
                    value={previewContent.filename}
                    placeholder="Preview will appear here..."
                  />
                  <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                    {previewContent.type.toUpperCase()}
                  </span>
                </WebPreviewNavigation>
                <WebPreviewBody
                  src={previewContent.url}
                  fallback={
                    <div className="text-center">
                      <Loader variant="spinner" size="lg" />
                      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        Loading preview...
                      </p>
                    </div>
                  }
                />
              </WebPreview>
            </div>
          )}

          {/* Empty preview placeholder */}
          {showPreview && !previewContent && (
            <div className="w-1/2 flex flex-col">
              <WebPreview>
                <WebPreviewNavigation>
                  <WebPreviewUrl
                    readOnly
                    placeholder="Preview will appear here..."
                  />
                </WebPreviewNavigation>
                <WebPreviewBody />
              </WebPreview>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
