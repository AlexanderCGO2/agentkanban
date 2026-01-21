import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

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
    const queryOptions: Parameters<typeof query>[0] = {
      prompt,
      options: {
        allowedTools: config.allowedTools,
        permissionMode: config.permissionMode,
        maxTurns: config.maxTurns,
        cwd: config.cwd || process.cwd(),
      },
    };

    if (config.systemPrompt) {
      queryOptions.options!.systemPrompt = config.systemPrompt;
    }

    for await (const message of query(queryOptions)) {
      const agentMessage = processSDKMessage(message, sessionId, onMessage);

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

function processSDKMessage(
  message: Awaited<ReturnType<typeof query> extends AsyncGenerator<infer T> ? T : never>,
  sessionId: string,
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
