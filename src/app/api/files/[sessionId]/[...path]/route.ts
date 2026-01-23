/**
 * File API - Proxies file requests to Cloudflare Worker R2 storage
 */

import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_AGENT_URL || 'https://agentkanban-worker.alexander-53b.workers.dev';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; path: string[] }> }
) {
  const { sessionId, path } = await params;
  const filePath = path.join('/');

  try {
    // Fetch file from Cloudflare Worker
    const response = await fetch(`${CLOUDFLARE_WORKER_URL}/sessions/${sessionId}/files/${filePath}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const content = await response.text();
    const contentType = getContentType(filePath);

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    );
  }
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'csv': 'text/csv',
  };
  return mimeTypes[ext || ''] || 'text/plain';
}
