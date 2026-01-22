/**
 * Sandbox Snapshot Management API
 * 
 * POST /api/sandbox/snapshot - Create a new golden snapshot
 * GET /api/sandbox/snapshot - Get current snapshot status
 */

import { NextResponse } from 'next/server';
import { 
  createGoldenSnapshot, 
  getSnapshotId, 
  initSnapshotTable 
} from '@/lib/sandbox-snapshot';

// Long timeout for snapshot creation
export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes

export async function POST() {
  try {
    // Ensure table exists
    await initSnapshotTable();
    
    // Create new snapshot
    const snapshotId = await createGoldenSnapshot();
    
    return NextResponse.json({
      success: true,
      snapshotId,
      message: 'Golden snapshot created successfully',
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create snapshot', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await initSnapshotTable();
    const snapshotId = await getSnapshotId();
    
    return NextResponse.json({
      hasSnapshot: !!snapshotId,
      snapshotId: snapshotId || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get snapshot status' },
      { status: 500 }
    );
  }
}
