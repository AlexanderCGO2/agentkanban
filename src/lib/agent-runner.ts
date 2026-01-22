import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

const anthropic = new Anthropic();

// MCP Server URL for canvas tools
const MCP_SERVER_URL = process.env.DESIGN_MCP_URL || 'https://agentkanban.vercel.app';

// Tool definitions - includes standard tools + MCP canvas tools
const TOOLS: Anthropic.Tool[] = [
  // Web tools
  {
    name: 'web_search',
    description: 'Search the web for information. Returns search results with titles, snippets, and URLs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'The search query' },
        num_results: { type: 'number', description: 'Number of results to return (default 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch the content of a web page. Returns the text content of the page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'The URL to fetch' }
      },
      required: ['url']
    }
  },
  // Canvas/MCP tools
  {
    name: 'mindmap_create',
    description: 'Create a new mindmap with a central topic and branches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the mindmap' },
        centralTopic: { type: 'string', description: 'The central topic' },
        branches: { type: 'array', items: { type: 'string' }, description: 'Branch labels' }
      },
      required: ['name', 'centralTopic', 'branches']
    }
  },
  {
    name: 'workflow_create',
    description: 'Create a workflow diagram from a template.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the workflow' },
        template: { type: 'string', enum: ['literature-review', 'competitive-analysis', 'user-research', 'data-analysis'], description: 'Template type' }
      },
      required: ['name', 'template']
    }
  },
  {
    name: 'canvas_list',
    description: 'List all available canvases.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'canvas_export_svg',
    description: 'Export a canvas as SVG.',
    input_schema: {
      type: 'object' as const,
      properties: {
        canvasId: { type: 'string', description: 'Canvas ID to export' }
      },
      required: ['canvasId']
    }
  }
];

/**
 * Execute a tool call
 */
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'web_search':
        return await webSearch(args.query as string, args.num_results as number || 5);
      
      case 'web_fetch':
        return await webFetch(args.url as string);
      
      // MCP canvas tools - forward to API
      case 'mindmap_create':
      case 'workflow_create':
      case 'canvas_list':
      case 'canvas_export_svg':
      case 'canvas_get':
        return await callMcpTool(name, args);
      
      default:
        return `Tool '${name}' is not implemented`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Web search using DuckDuckGo Instant Answer API (free, no key needed)
 */
async function webSearch(query: string, numResults: number = 5): Promise<string> {
  try {
    // Use DuckDuckGo HTML search (more reliable)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse results from HTML (simple regex extraction)
    const results: { title: string; snippet: string; url: string }[] = [];
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
      results.push({
        url: match[1],
        title: match[2].trim(),
        snippet: match[3].replace(/<[^>]+>/g, '').trim()
      });
    }
    
    if (results.length === 0) {
      // Fallback: try to extract any links
      const linkRegex = /<a class="result__url"[^>]*>([^<]+)<\/a>/g;
      while ((match = linkRegex.exec(html)) !== null && results.length < numResults) {
        results.push({
          url: `https://${match[1].trim()}`,
          title: match[1].trim(),
          snippet: 'No snippet available'
        });
      }
    }
    
    if (results.length === 0) {
      return `No search results found for: "${query}"`;
    }
    
    return `Search results for "${query}":\n\n` + results.map((r, i) => 
      `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
    ).join('\n\n');
    
  } catch (error) {
    return `Search error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Fetch web page content
 */
async function webFetch(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract text content (remove scripts, styles, tags)
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit to ~4000 chars
    if (text.length > 4000) {
      text = text.substring(0, 4000) + '... [truncated]';
    }
    
    return `Content from ${url}:\n\n${text}`;
  } catch (error) {
    return `Fetch error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Call MCP tool via HTTP
 */
async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/api/design-mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `MCP tool error: ${error}`;
    }

    const result = await response.json();
    if (result.content && Array.isArray(result.content)) {
      return result.content.map((c: { text?: string }) => c.text || '').join('\n');
    }
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return `MCP error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Build full prompt with agent context
 */
function buildFullPrompt(config: AgentConfig, userPrompt: string): string {
  return `## Your Task
${config.prompt || 'Help the user with their request.'}

## User Request
${userPrompt}

## Instructions
1. Think step by step about what the user needs
2. Use tools when helpful (web_search for research, mindmap_create for visualizing ideas)
3. Provide a thorough, helpful response
4. If creating visual artifacts, use the canvas tools`;
}

/**
 * Run agent with tool calling loop
 */
export async function runAgent(
  config: AgentConfig,
  sessionId: string,
  prompt: string,
  onMessage?: MessageCallback
): Promise<AgentResult> {
  await agentStore.updateSessionStatus(sessionId, 'running');

  const fullPrompt = buildFullPrompt(config, prompt);

  // Add user message
  const userMessage = await agentStore.addMessage(sessionId, {
    type: 'user',
    content: prompt,
  });
  onMessage?.(userMessage);

  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let numTurns = 0;
  let finalContent = '';

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: fullPrompt }
    ];

    // Determine which tools to provide based on agent config
    const allowedToolNames = new Set(config.allowedTools || ['Read', 'Write', 'WebSearch', 'WebFetch']);
    const toolsToProvide = TOOLS.filter(t => {
      // Map tool names to allowed tools
      if (t.name === 'web_search') return allowedToolNames.has('WebSearch');
      if (t.name === 'web_fetch') return allowedToolNames.has('WebFetch');
      // Canvas tools for design agents
      if (t.name.startsWith('mindmap_') || t.name.startsWith('workflow_') || t.name.startsWith('canvas_')) {
        return config.mcpServers && Object.keys(config.mcpServers).length > 0;
      }
      return true;
    });

    // Agent loop
    let continueLoop = true;
    const maxTurns = config.maxTurns || 10;

    while (continueLoop && numTurns < maxTurns) {
      numTurns++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: config.systemPrompt || 'You are a helpful AI assistant. Use the available tools to help the user.',
        messages,
        tools: toolsToProvide.length > 0 ? toolsToProvide : undefined,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Process response
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let textContent = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
          assistantContent.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          assistantContent.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });

          // Add tool use message to UI
          const toolUseMsg = await agentStore.addMessage(sessionId, {
            type: 'tool_use',
            content: `Using tool: ${block.name}`,
            toolName: block.name,
            toolInput: block.input as Record<string, unknown>,
          });
          onMessage?.(toolUseMsg);

          // Execute the tool
          const result = await executeTool(block.name, block.input as Record<string, unknown>);

          // Add tool result message to UI
          const toolResultMsg = await agentStore.addMessage(sessionId, {
            type: 'tool_result',
            content: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
            toolName: block.name,
            toolResult: result,
            parentToolUseId: block.id,
          });
          onMessage?.(toolResultMsg);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add assistant text as message
      if (textContent) {
        const assistantMsg = await agentStore.addMessage(sessionId, {
          type: 'assistant',
          content: textContent,
        });
        onMessage?.(assistantMsg);
        finalContent = textContent;
      }

      // Add to conversation history
      messages.push({ role: 'assistant', content: assistantContent });

      // If there were tool calls, add results and continue
      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }

      // Check stop reason
      if (response.stop_reason === 'end_turn' && toolResults.length === 0) {
        continueLoop = false;
      }
    }

    const result: AgentResult = {
      success: true,
      result: finalContent,
      durationMs: Date.now() - startTime,
      totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
      numTurns,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };

    await agentStore.setSessionResult(sessionId, result);
    await agentStore.updateSessionStatus(sessionId, 'completed');
    return result;

  } catch (error) {
    const errorResult: AgentResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      totalCostUsd: 0,
      numTurns,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
    await agentStore.setSessionResult(sessionId, errorResult);
    await agentStore.updateSessionStatus(sessionId, 'error');
    return errorResult;
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
