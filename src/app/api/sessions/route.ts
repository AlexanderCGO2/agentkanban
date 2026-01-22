import { NextResponse } from 'next/server';
import { agentStore } from '@/lib/agent-store';

export async function GET() {
  try {
    const sessions = await agentStore.getAllSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
