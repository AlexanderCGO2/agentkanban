/**
 * Sandbox Snapshot Management
 * 
 * Creates and manages a "golden snapshot" with all dependencies pre-installed.
 * Snapshots expire after 7 days, so we refresh them proactively.
 */

import { Sandbox, Snapshot } from '@vercel/sandbox';
import { sql } from './db';

const SNAPSHOT_KEY = 'agent-sandbox-snapshot';
const SNAPSHOT_EXPIRY_DAYS = 6; // Refresh before 7-day expiry

interface SnapshotRecord {
  id: string;
  snapshot_id: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Initialize the snapshots table
 */
export async function initSnapshotTable(): Promise<void> {
  const client = sql();
  await client`
    CREATE TABLE IF NOT EXISTS sandbox_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `;
}

/**
 * Get the current valid snapshot ID, or null if expired/missing
 */
export async function getSnapshotId(): Promise<string | null> {
  try {
    const client = sql();
    const result = await client`
      SELECT snapshot_id, expires_at 
      FROM sandbox_snapshots 
      WHERE id = ${SNAPSHOT_KEY} AND expires_at > NOW()
    ` as SnapshotRecord[];
    
    if (result.length > 0) {
      return result[0].snapshot_id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save a new snapshot ID to the database
 */
export async function saveSnapshotId(snapshotId: string): Promise<void> {
  const client = sql();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SNAPSHOT_EXPIRY_DAYS);
  
  await client`
    INSERT INTO sandbox_snapshots (id, snapshot_id, expires_at)
    VALUES (${SNAPSHOT_KEY}, ${snapshotId}, ${expiresAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET
      snapshot_id = ${snapshotId},
      expires_at = ${expiresAt.toISOString()},
      created_at = NOW()
  `;
}

/**
 * Create a golden snapshot with all dependencies pre-installed
 */
export async function createGoldenSnapshot(): Promise<string> {
  console.log('Creating golden snapshot...');
  
  // Create a fresh sandbox
  const sandbox = await Sandbox.create({
    runtime: 'node22',
    timeout: 600000, // 10 minutes for setup
    resources: { vcpus: 2 },
  });

  try {
    console.log('Installing pnpm...');
    await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '-g', 'pnpm'],
      sudo: true,
    });

    console.log('Installing Claude Code CLI globally...');
    await sandbox.runCommand({
      cmd: 'pnpm',
      args: ['install', '-g', '@anthropic-ai/claude-code'],
      sudo: true,
    });

    console.log('Setting up working directory...');
    await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', '/vercel/sandbox/agent'],
    });

    // Initialize npm project in agent directory
    await sandbox.runCommand({
      cmd: 'pnpm',
      args: ['init'],
      cwd: '/vercel/sandbox/agent',
    });

    console.log('Installing Agent SDK...');
    await sandbox.runCommand({
      cmd: 'pnpm',
      args: ['add', '@anthropic-ai/claude-agent-sdk'],
      cwd: '/vercel/sandbox/agent',
    });

    console.log('Creating snapshot...');
    // Create snapshot - this automatically stops the sandbox
    const snapshot = await sandbox.snapshot();
    
    console.log(`Golden snapshot created: ${snapshot.snapshotId}`);
    
    // Save to database
    await saveSnapshotId(snapshot.snapshotId);
    
    return snapshot.snapshotId;
  } catch (error) {
    // Make sure to stop sandbox on error
    await sandbox.stop().catch(() => {});
    throw error;
  }
}

/**
 * Get or create the golden snapshot
 */
export async function ensureGoldenSnapshot(): Promise<string> {
  // Try to get existing valid snapshot
  let snapshotId = await getSnapshotId();
  
  if (snapshotId) {
    // Verify it still exists on Vercel
    try {
      await Snapshot.get({ snapshotId });
      console.log(`Using existing snapshot: ${snapshotId}`);
      return snapshotId;
    } catch {
      console.log('Snapshot expired or invalid, creating new one...');
    }
  }
  
  // Create new snapshot
  return await createGoldenSnapshot();
}

/**
 * Create a sandbox from the golden snapshot
 */
export async function createSandboxFromSnapshot(snapshotId: string): Promise<Sandbox> {
  return await Sandbox.create({
    source: {
      type: 'snapshot',
      snapshotId,
    },
    timeout: 300000, // 5 minutes initial
    resources: { vcpus: 2 },
  });
}
