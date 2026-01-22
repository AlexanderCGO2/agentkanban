/**
 * REST API for individual canvas operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCanvas, deleteCanvas, saveCanvas } from '@/lib/canvas-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canvas = await getCanvas(id);
  
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
  }
  
  return NextResponse.json({ canvas });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canvas = await getCanvas(id);
  
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
  }
  
  const updates = await request.json();
  const updatedCanvas = {
    ...canvas,
    ...updates,
    id, // Preserve ID
    updatedAt: new Date().toISOString(),
  };
  
  await saveCanvas(updatedCanvas);
  
  return NextResponse.json({ canvas: updatedCanvas });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canvas = await getCanvas(id);
  
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
  }
  
  await deleteCanvas(id);
  
  return NextResponse.json({ success: true });
}
