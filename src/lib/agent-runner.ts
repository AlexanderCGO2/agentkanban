import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, AgentMessage, AgentResult } from '@/types/agent';
import { agentStore } from './agent-store';

export type MessageCallback = (message: AgentMessage) => void;

const anthropic = new Anthropic();

/**
 * Constructs the full prompt by combining the agent's base task description
 * with the user's specific request.
 */
function buildFullPrompt(config: AgentConfig, userPrompt: string): string {
  if (config.prompt && config.prompt.trim()) {
    return `## Agent Task
${config.prompt}

## User Request
${userPrompt}

## Instructions
Complete the user request following your agent task guidelines.`;
  }
  
  return userPrompt;
}

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

  try {
    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: fullPrompt }
    ];

    // Make API call
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: config.systemPrompt || 'You are a helpful AI assistant.',
      messages,
    });

    // Track usage
    totalInputTokens = response.usage.input_tokens;
    totalOutputTokens = response.usage.output_tokens;

    // Process response
    let assistantContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantContent += block.text;
      }
    }

    // Add assistant message
    if (assistantContent) {
      const assistantMessage = await agentStore.addMessage(sessionId, {
        type: 'assistant',
        content: assistantContent,
      });
      onMessage?.(assistantMessage);
    }

    // Create result
    const result: AgentResult = {
      success: true,
      result: assistantContent,
      durationMs: Date.now() - startTime,
      totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
      numTurns: 1,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
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
      numTurns: 0,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
    await agentStore.setSessionResult(sessionId, errorResult);
    await agentStore.updateSessionStatus(sessionId, 'error');
    return errorResult;
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Claude Sonnet pricing (approximate)
  const inputCostPer1k = 0.003;
  const outputCostPer1k = 0.015;
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}
