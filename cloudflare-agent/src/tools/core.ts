/**
 * Core tools: web_search, read_file, write_file, list_files, bash
 */

import type { ToolDefinition, ToolHandler, ToolExecutionContext } from '../types';

// ============================================================
// DEFINITIONS
// ============================================================

export const CORE_TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information. Returns relevant search results.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        max_results: { type: 'number', description: 'Maximum number of results (default: 5)' },
      },
      required: ['query'],
    },
  },

  read_file: {
    name: 'read_file',
    description: 'Read the contents of a file from the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file within the session workspace' },
      },
      required: ['path'],
    },
  },

  write_file: {
    name: 'write_file',
    description: 'Write content to a file in the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },

  list_files: {
    name: 'list_files',
    description: 'List all files in the session workspace.',
    input_schema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'Optional prefix to filter files' },
      },
      required: [],
    },
  },

  bash: {
    name: 'bash',
    description: 'Execute safe bash commands (echo, ls, pwd, date, cat, grep, etc.). For full code execution, use execute_bash tool instead.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
      },
      required: ['command'],
    },
  },
};

// ============================================================
// HANDLERS
// ============================================================

export const CORE_TOOL_HANDLERS: Record<string, ToolHandler> = {
  web_search: async (input, context) => {
    const { query, max_results = 5 } = input as { query: string; max_results?: number };

    // Try Brave Search API first
    const braveApiKey = context.env?.BRAVE_API_KEY;
    if (braveApiKey) {
      try {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(Math.min(max_results, 10)));

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': braveApiKey,
          },
        });

        if (response.ok) {
          const data = await response.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
          const results = (data.web?.results || []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
          }));

          return JSON.stringify({
            query,
            results,
            source: 'brave',
          }, null, 2);
        }
      } catch (error) {
        console.error('Brave search error:', error);
      }
    }

    // Try Serper API as fallback
    const serperApiKey = context.env?.SERPER_API_KEY;
    if (serperApiKey) {
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: query,
            num: Math.min(max_results, 10),
          }),
        });

        if (response.ok) {
          const data = await response.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
          const results = (data.organic || []).map((r) => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
          }));

          return JSON.stringify({
            query,
            results,
            source: 'serper',
          }, null, 2);
        }
      } catch (error) {
        console.error('Serper search error:', error);
      }
    }

    // Fallback: Use DuckDuckGo Instant Answer API (free, no key required)
    try {
      const url = new URL('https://api.duckduckgo.com/');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('no_html', '1');
      url.searchParams.set('skip_disambig', '1');

      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json() as {
          Abstract?: string;
          AbstractURL?: string;
          AbstractSource?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
          Results?: Array<{ Text?: string; FirstURL?: string }>;
        };

        const results: Array<{ title: string; url: string; snippet: string }> = [];

        // Add abstract if available
        if (data.Abstract && data.AbstractURL) {
          results.push({
            title: data.AbstractSource || 'Summary',
            url: data.AbstractURL,
            snippet: data.Abstract,
          });
        }

        // Add related topics
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, max_results - results.length)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
                url: topic.FirstURL,
                snippet: topic.Text,
              });
            }
          }
        }

        // Add direct results
        if (data.Results) {
          for (const result of data.Results.slice(0, max_results - results.length)) {
            if (result.Text && result.FirstURL) {
              results.push({
                title: result.Text.split(' - ')[0] || result.Text.slice(0, 50),
                url: result.FirstURL,
                snippet: result.Text,
              });
            }
          }
        }

        if (results.length > 0) {
          return JSON.stringify({
            query,
            results,
            source: 'duckduckgo',
          }, null, 2);
        }
      }
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
    }

    // If all APIs fail, return helpful message with manual search suggestions
    return JSON.stringify({
      query,
      results: [],
      note: 'Search API unavailable. For best results, configure BRAVE_API_KEY or SERPER_API_KEY in your environment.',
      suggestion: `To research "${query}", you could search these sources: TechCrunch, The Verge, ArsTechnica, or official company blogs.`,
    }, null, 2);
  },

  read_file: async (input, context) => {
    const { path } = input as { path: string };
    const r2Key = `sessions/${context.sessionId}/files/${path}`;
    try {
      const object = await context.fileStorage.get(r2Key);
      if (!object) return `Error: File not found: ${path}`;
      return await object.text();
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  write_file: async (input, context) => {
    const { path, content } = input as { path: string; content: string };
    const r2Key = `sessions/${context.sessionId}/files/${path}`;
    try {
      await context.fileStorage.put(r2Key, content, {
        customMetadata: {
          sessionId: context.sessionId,
          originalPath: path,
          createdAt: new Date().toISOString(),
        },
      });
      return `Successfully wrote ${content.length} bytes to ${path}`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  list_files: async (input, context) => {
    const { prefix = '' } = input as { prefix?: string };
    const r2Prefix = `sessions/${context.sessionId}/files/${prefix}`;
    try {
      const listed = await context.fileStorage.list({ prefix: r2Prefix });
      const files = listed.objects.map((obj) => ({
        name: obj.key.replace(`sessions/${context.sessionId}/files/`, ''),
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }));
      return files.length === 0 ? 'No files found in workspace.' : JSON.stringify(files, null, 2);
    } catch (error) {
      return `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },

  bash: async (input, context) => {
    const { command } = input as { command: string };
    const ALLOWED = ['echo', 'cat', 'ls', 'pwd', 'date', 'wc', 'head', 'tail', 'grep', 'sort', 'uniq'];
    const firstWord = command.trim().split(/\s+/)[0];

    if (!ALLOWED.includes(firstWord)) {
      return `Error: Command '${firstWord}' not allowed in basic bash. Use execute_bash for full shell access. Allowed: ${ALLOWED.join(', ')}`;
    }

    // Simulate basic commands
    if (firstWord === 'echo') return command.slice(5).trim().replace(/^["']|["']$/g, '');
    if (firstWord === 'date') return new Date().toISOString();
    if (firstWord === 'pwd') return `/workspace/sessions/${context.sessionId}`;
    if (firstWord === 'ls') {
      const listed = await context.fileStorage.list({ prefix: `sessions/${context.sessionId}/files/` });
      return listed.objects.map((obj) => obj.key.replace(`sessions/${context.sessionId}/files/`, '')).join('\n') || '(empty)';
    }

    return `Command '${command}' requires sandbox execution. Use execute_bash tool.`;
  },
};
