/**
 * REST API for canvases - Direct access for frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { listCanvases, saveCanvas, type CanvasData, type CanvasType } from '@/lib/canvas-store';

export async function GET() {
  const canvases = await listCanvases();
  return NextResponse.json({ canvases });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; type: CanvasType };
  
  const canvas: CanvasData = {
    id: uuid(),
    name: body.name,
    type: body.type,
    nodes: [],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await saveCanvas(canvas);
  
  return NextResponse.json({ canvas }, { status: 201 });
}
