import { NextRequest } from 'next/server';
import { agentStore } from '@/lib/agent-store';
import { runAgent } from '@/lib/agent-runner';
import { AgentMessage } from '@/types/agent';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const agent = agentStore.getAgent(id);
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a new session
    const session = agentStore.createSession(id);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendMessage = (message: AgentMessage) => {
          const data = JSON.stringify(message);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // Send initial session info
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session_start', sessionId: session.id })}\n\n`));

        try {
          const result = await runAgent(agent, session.id, prompt, sendMessage);

          // Send final result
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`));
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
    console.error('Error in stream:', error);
    return new Response(JSON.stringify({ error: 'Failed to start stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
