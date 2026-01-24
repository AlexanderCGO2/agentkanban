/**
 * Cloudflare Agent Worker
 *
 * Scalable agent execution with:
 * - Durable Objects for session state persistence
 * - R2 for file storage
 * - Queues for long-running tasks
 * - Extensible tool framework
 */

import type { Env, AgentRequest, AgentError, QueuedTask, SessionConfig } from './types';
export { AgentSession } from './session';

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      // Health check
      if (url.pathname === '/health') {
        return Response.json(
          {
            status: 'ok',
            env: env.ENVIRONMENT,
            hasSandbox: !!env.SANDBOX,
            hasDurableObjects: !!env.AGENT_SESSION,
            hasR2: !!env.FILE_STORAGE,
            hasQueues: !!env.TASK_QUEUE,
            mode: env.SANDBOX ? 'sandbox' : 'direct-api',
          },
          { headers: CORS_HEADERS }
        );
      }

      // === BACKWARD COMPATIBLE ENDPOINTS ===

      // Simple run endpoint (creates ephemeral session)
      if (url.pathname === '/run' && request.method === 'POST') {
        return handleRunAgent(request, env);
      }

      // Simple stream endpoint (creates ephemeral session)
      if (url.pathname === '/stream' && request.method === 'POST') {
        return handleStreamAgent(request, env);
      }

      // === NEW SESSION-BASED ENDPOINTS ===

      // Create a new session
      if (url.pathname === '/sessions' && request.method === 'POST') {
        return handleCreateSession(request, env);
      }

      // Get session state
      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      if (sessionMatch && request.method === 'GET') {
        return handleGetSession(sessionMatch[1], env);
      }

      // Run agent in existing session
      const runMatch = url.pathname.match(/^\/sessions\/([^/]+)\/run$/);
      if (runMatch && request.method === 'POST') {
        return handleSessionRun(runMatch[1], request, env);
      }

      // Stream agent in existing session
      const streamMatch = url.pathname.match(/^\/sessions\/([^/]+)\/stream$/);
      if (streamMatch && request.method === 'POST') {
        return handleSessionStream(streamMatch[1], request, env);
      }

      // List session files
      const filesMatch = url.pathname.match(/^\/sessions\/([^/]+)\/files$/);
      if (filesMatch && request.method === 'GET') {
        return handleSessionFiles(filesMatch[1], env);
      }

      // Get specific file from session
      const fileMatch = url.pathname.match(/^\/sessions\/([^/]+)\/files\/(.+)$/);
      if (fileMatch && request.method === 'GET') {
        return handleGetFile(fileMatch[1], fileMatch[2], env);
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    } catch (error) {
      console.error('Worker error:', error);

      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  },

  // Queue consumer for long-running tasks
  async queue(
    batch: MessageBatch<QueuedTask>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      const task = message.body;

      if (task.type === 'agent_run') {
        try {
          // Get or create Durable Object for session
          const id = env.AGENT_SESSION.idFromString(task.sessionId);
          const stub = env.AGENT_SESSION.get(id);

          // Initialize if needed and run
          await stub.fetch(
            new Request('http://internal/init', {
              method: 'POST',
              body: JSON.stringify(task.config),
            })
          );

          await stub.fetch(
            new Request('http://internal/run', {
              method: 'POST',
              body: JSON.stringify({ prompt: task.prompt }),
            })
          );

          message.ack();
        } catch (error) {
          console.error('Queue task failed:', error);
          message.retry();
        }
      }
    }
  },
};

// === Handler implementations ===

/**
 * Backward compatible: Simple run (creates ephemeral session)
 */
async function handleRunAgent(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as AgentRequest;

  if (!body.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS_HEADERS });
  }

  // Create ephemeral session
  const sessionId = body.sessionId || crypto.randomUUID();
  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  // Initialize session
  await stub.fetch(
    new Request('http://internal/init', {
      method: 'POST',
      body: JSON.stringify({
        systemPrompt: body.systemPrompt,
        allowedTools: body.allowedTools,
        permissionMode: body.permissionMode,
        maxTurns: body.maxTurns,
      }),
    })
  );

  // Run agent
  const response = await stub.fetch(
    new Request('http://internal/run', {
      method: 'POST',
      body: JSON.stringify({ prompt: body.prompt }),
    })
  );

  const result = await response.json();
  return Response.json(result, { headers: CORS_HEADERS });
}

/**
 * Backward compatible: Simple stream (creates ephemeral session)
 */
async function handleStreamAgent(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as AgentRequest;

  if (!body.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS_HEADERS });
  }

  // Create ephemeral session
  const sessionId = body.sessionId || crypto.randomUUID();
  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  // Initialize session
  await stub.fetch(
    new Request('http://internal/init', {
      method: 'POST',
      body: JSON.stringify({
        systemPrompt: body.systemPrompt,
        allowedTools: body.allowedTools,
        permissionMode: body.permissionMode,
        maxTurns: body.maxTurns,
        enableReplicate: body.enableReplicate,
      }),
    })
  );

  // Stream agent
  const response = await stub.fetch(
    new Request('http://internal/stream', {
      method: 'POST',
      body: JSON.stringify({ prompt: body.prompt }),
    })
  );

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Create a new persistent session
 */
async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Partial<AgentRequest>;

  const sessionId = crypto.randomUUID();
  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  const response = await stub.fetch(
    new Request('http://internal/init', {
      method: 'POST',
      body: JSON.stringify({
        systemPrompt: body.systemPrompt,
        allowedTools: body.allowedTools,
        permissionMode: body.permissionMode,
        maxTurns: body.maxTurns,
      }),
    })
  );

  const state = await response.json() as Record<string, unknown>;
  return Response.json({ sessionId, ...state }, { headers: CORS_HEADERS });
}

/**
 * Get session state
 */
async function handleGetSession(sessionId: string, env: Env): Promise<Response> {
  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  const response = await stub.fetch(new Request('http://internal/state'));
  const state = await response.json();

  return Response.json(state, { headers: CORS_HEADERS });
}

/**
 * Run agent in existing session
 */
async function handleSessionRun(sessionId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { prompt: string };

  if (!body.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  const response = await stub.fetch(
    new Request('http://internal/run', {
      method: 'POST',
      body: JSON.stringify({ prompt: body.prompt }),
    })
  );

  const result = await response.json();
  return Response.json(result, { headers: CORS_HEADERS });
}

/**
 * Stream agent in existing session
 */
async function handleSessionStream(sessionId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { prompt: string };

  if (!body.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  const response = await stub.fetch(
    new Request('http://internal/stream', {
      method: 'POST',
      body: JSON.stringify({ prompt: body.prompt }),
    })
  );

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}

/**
 * List session files
 */
async function handleSessionFiles(sessionId: string, env: Env): Promise<Response> {
  const id = env.AGENT_SESSION.idFromName(sessionId);
  const stub = env.AGENT_SESSION.get(id);

  const response = await stub.fetch(new Request('http://internal/files'));
  const files = await response.json();

  return Response.json(files, { headers: CORS_HEADERS });
}

/**
 * Get a specific file from session storage
 */
async function handleGetFile(sessionId: string, filePath: string, env: Env): Promise<Response> {
  const r2Key = `sessions/${sessionId}/files/${filePath}`;

  try {
    const object = await env.FILE_STORAGE.get(r2Key);

    if (!object) {
      return new Response('File not found', { status: 404, headers: CORS_HEADERS });
    }

    // Determine content type from extension
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypes: Record<string, string> = {
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
    const contentType = contentTypes[ext] || 'text/plain';

    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return Response.json(
      { error: 'Failed to fetch file' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
