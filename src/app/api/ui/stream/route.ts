import { NextRequest } from 'next/server';
import { Output, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import uiBlockSchema from '@/../schema/ui-block.schema.json';
import { UiBlock } from '@/types/ui-block';

export const runtime = 'edge';
export const maxDuration = 60;

const DEFAULT_MODEL = 'gpt-4.1-mini';

function getModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('Missing AI_GATEWAY_API_KEY');
  }

  const baseURL = process.env.AI_GATEWAY_BASE_URL || undefined;
  const modelName = process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;

  const openai = createOpenAI({
    apiKey,
    baseURL,
  });

  return openai(modelName);
}

function encodeSse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const system = typeof body?.system === 'string' ? body.system.trim() : '';

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(encodeSse(payload)));
        };

        try {
          const result = streamText({
            model: getModel(),
            system: system || undefined,
            prompt,
            output: Output.object({
              schema: uiBlockSchema,
            }),
          });

          let lastBlockCount = 0;
          for await (const partial of result.partialOutputStream) {
            const blocks = Array.isArray(partial?.blocks) ? (partial.blocks as UiBlock[]) : [];
            if (blocks.length <= lastBlockCount) continue;
            for (let i = lastBlockCount; i < blocks.length; i += 1) {
              send({ type: 'block', block: blocks[i] });
            }
            lastBlockCount = blocks.length;
          }

          send({ type: 'complete' });
        } catch (error) {
          send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to start UI stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
