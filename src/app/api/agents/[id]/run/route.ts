import { NextRequest, NextResponse } from 'next/server';
import { agentStore } from '@/lib/agent-store';
import { runAgent } from '@/lib/agent-runner';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const agent = agentStore.getAgent(id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Create a new session
    const session = agentStore.createSession(id);

    // Run the agent (non-streaming for simplicity, streaming handled via SSE endpoint)
    const result = await runAgent(agent, session.id, prompt);

    // Get updated session with all messages
    const updatedSession = agentStore.getSession(session.id);

    return NextResponse.json({
      session: updatedSession,
      result,
    });
  } catch (error) {
    console.error('Error running agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run agent' },
      { status: 500 }
    );
  }
}
