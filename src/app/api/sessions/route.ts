import { NextResponse } from 'next/server';
import { agentStore } from '@/lib/agent-store';

export async function GET() {
  const sessions = agentStore.getAllSessions();
  return NextResponse.json(sessions);
}
