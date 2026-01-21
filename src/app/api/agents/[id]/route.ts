import { NextRequest, NextResponse } from 'next/server';
import { agentStore } from '@/lib/agent-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = agentStore.getAgent(id);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updated = agentStore.updateAgent(id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = agentStore.deleteAgent(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
