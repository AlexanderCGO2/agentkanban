import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentConfig, AgentMessage, AgentResult, OutputFile, OutputFileType } from '@/types/agent';
import { agentStore } from './agent-store';
import * as path from 'path';
import * as fs from 'fs';

export type MessageCallback = (message: AgentMessage) => void;

export async function runAgent(
  config: AgentConfig,
  sessionId: string,
  prompt: string,
  onMessage?: MessageCallback
): Promise<AgentResult> {
  agentStore.updateSessionStatus(sessionId, 'running');

  // Add user message
  const userMessage = agentStore.addMessage(sessionId, {
    type: 'user',
    content: prompt,
  });
  onMessage?.(userMessage);

  const startTime = Date.now();

  try {
    // Ensure output directory exists
    const outputDir = config.outputDir || path.join(process.cwd(), 'agent-outputs', sessionId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const queryOptions: Parameters<typeof query>[0] = {
      prompt,
      options: {
        allowedTools: config.allowedTools,
        permissionMode: config.permissionMode,
        maxTurns: config.maxTurns,
        cwd: config.cwd || outputDir,
      },
    };

    if (config.systemPrompt) {
      queryOptions.options!.systemPrompt = config.systemPrompt;
    }

    // Add MCP servers if configured
    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      queryOptions.options!.mcpServers = config.mcpServers;
    }

    // Add Replicate MCP server if enabled
    if (config.enableReplicate && process.env.REPLICATE_API_TOKEN) {
      queryOptions.options!.mcpServers = {
        ...queryOptions.options!.mcpServers,
        replicate: {
          command: 'npx',
          args: ['-y', '@anthropic-ai/replicate-mcp'],
          env: {
            REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
          },
        },
      };
    }

    for await (const message of query(queryOptions)) {
      const agentMessage = processSDKMessage(message, sessionId, outputDir, onMessage);

      // Capture session ID from init message
      if (message.type === 'system' && 'subtype' in message && message.subtype === 'init') {
        agentStore.setSessionId(sessionId, message.session_id);
      }

      // Handle result message
      if (message.type === 'result') {
        const result = createResult(message, startTime);
        agentStore.setSessionResult(sessionId, result);
        return result;
      }
    }

    // Should not reach here normally
    const fallbackResult: AgentResult = {
      success: false,
      error: 'Agent completed without result message',
      durationMs: Date.now() - startTime,
      totalCostUsd: 0,
      numTurns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    agentStore.setSessionResult(sessionId, fallbackResult);
    return fallbackResult;

  } catch (error) {
    const errorResult: AgentResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      totalCostUsd: 0,
      numTurns: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    agentStore.setSessionResult(sessionId, errorResult);
    agentStore.updateSessionStatus(sessionId, 'error');
    return errorResult;
  }
}

function getFileType(filename: string): OutputFileType {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'text';
    case '.md':
    case '.markdown':
      return 'markdown';
    case '.json':
      return 'json';
    case '.csv':
    case '.xls':
    case '.xlsx':
      return 'csv';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.webp':
    case '.svg':
      return 'image';
    case '.pdf':
      return 'pdf';
    default:
      return 'other';
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function trackFileOutput(sessionId: string, filePath: string, outputDir: string): void {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(outputDir, filePath);

    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      const filename = path.basename(absolutePath);
      const fileType = getFileType(filename);

      // Read content for text files (up to 100KB)
      let content: string | undefined;
      if (['text', 'markdown', 'json', 'csv'].includes(fileType) && stats.size < 100 * 1024) {
        content = fs.readFileSync(absolutePath, 'utf-8');
      }

      agentStore.addOutputFile(sessionId, {
        filename,
        path: absolutePath,
        type: fileType,
        mimeType: getMimeType(filename),
        size: stats.size,
        content,
      });
    }
  } catch {
    // Ignore file tracking errors
  }
}

function processSDKMessage(
  message: Awaited<ReturnType<typeof query> extends AsyncGenerator<infer T> ? T : never>,
  sessionId: string,
  outputDir: string,
  onMessage?: MessageCallback
): AgentMessage | null {
  let agentMessage: Omit<AgentMessage, 'id' | 'timestamp'> | null = null;

  switch (message.type) {
    case 'assistant': {
      // Process assistant message content
      const content = message.message.content;
      let textContent = '';

      for (const block of content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          // Track file writes
          if (block.name === 'Write' && block.input && typeof block.input === 'object') {
            const input = block.input as { file_path?: string };
            if (input.file_path) {
              // Track after a short delay to ensure file is written
              setTimeout(() => trackFileOutput(sessionId, input.file_path!, outputDir), 100);
            }
          }

          // Add tool use message
          const toolMessage = agentStore.addMessage(sessionId, {
            type: 'tool_use',
            content: `Using tool: ${block.name}`,
            toolName: block.name,
            toolInput: block.input,
            parentToolUseId: message.parent_tool_use_id,
          });
          onMessage?.(toolMessage);
        }
      }

      if (textContent) {
        agentMessage = {
          type: 'assistant',
          content: textContent,
          parentToolUseId: message.parent_tool_use_id,
        };
      }
      break;
    }

    case 'user': {
      // Tool results come as user messages
      const content = message.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolResultContent = Array.isArray(block.content)
              ? block.content.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '').join('\n')
              : typeof block.content === 'string' ? block.content : JSON.stringify(block.content);

            // Check for image URLs in tool results (from Replicate)
            if (typeof block.content === 'string' && block.content.match(/https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i)) {
              const imageUrl = block.content.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|gif|webp)/i)?.[0];
              if (imageUrl) {
                agentStore.addOutputFile(sessionId, {
                  filename: `generated-image-${Date.now()}.png`,
                  path: imageUrl,
                  type: 'image',
                  mimeType: 'image/png',
                  size: 0,
                  url: imageUrl,
                });
              }
            }

            const toolResultMessage = agentStore.addMessage(sessionId, {
              type: 'tool_result',
              content: toolResultContent.substring(0, 500) + (toolResultContent.length > 500 ? '...' : ''),
              toolResult: block.content,
              parentToolUseId: message.parent_tool_use_id,
            });
            onMessage?.(toolResultMessage);
          }
        }
      }
      break;
    }

    case 'system': {
      agentMessage = {
        type: 'system',
        content: 'subtype' in message ? `System: ${message.subtype}` : 'System message',
      };
      break;
    }

    case 'result': {
      let resultContent: string;
      if (message.subtype === 'success' && 'result' in message) {
        resultContent = String(message.result);
      } else if ('errors' in message && Array.isArray(message.errors)) {
        resultContent = `Error: ${message.errors.join(', ')}`;
      } else {
        resultContent = `Error: ${String(message.subtype)}`;
      }
      agentMessage = {
        type: 'result',
        content: resultContent,
      };
      break;
    }
  }

  if (agentMessage) {
    const fullMessage = agentStore.addMessage(sessionId, agentMessage);
    onMessage?.(fullMessage);
    return fullMessage;
  }

  return null;
}

function createResult(
  message: { type: 'result' } & Record<string, unknown>,
  startTime: number
): AgentResult {
  const isSuccess = message.subtype === 'success';
  const usage = message.usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined;

  return {
    success: isSuccess,
    result: isSuccess && 'result' in message ? String(message.result) : undefined,
    error: !isSuccess && 'errors' in message ? (message.errors as string[]).join(', ') : undefined,
    durationMs: (message.duration_ms as number) || (Date.now() - startTime),
    totalCostUsd: (message.total_cost_usd as number) || 0,
    numTurns: (message.num_turns as number) || 0,
    usage: {
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
      cacheReadInputTokens: usage?.cache_read_input_tokens,
      cacheCreationInputTokens: usage?.cache_creation_input_tokens,
    },
  };
}
