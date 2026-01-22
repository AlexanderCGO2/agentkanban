/**
 * Design MCP Server - Next.js API Route
 * Main entry point for MCP protocol
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'design-mcp',
    version: '1.0.0',
    description: 'MCP Server for Design Canvas - Mindmaps, Workflows, and Visual Tools',
    protocol: 'mcp',
    endpoints: {
      mcp: {
        tools: '/api/design-mcp/tools',
        toolsCall: '/api/design-mcp/tools/call',
        resources: '/api/design-mcp/resources',
        resourcesRead: '/api/design-mcp/resources/read',
      },
      rest: {
        canvases: '/api/design-mcp/canvases',
      },
    },
  });
}
