# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scalable Cloudflare Worker for AI agent execution with:
- **Durable Objects** - Session state persistence across requests
- **R2 Storage** - File workspace for each session
- **Queues** - Long-running task support
- **Tool Framework** - Extensible tool execution (web_search, read_file, write_file, list_files, bash)

## Commands

```bash
# Install dependencies
npm install

# Local development (requires .dev.vars with ANTHROPIC_API_KEY)
npm run dev

# Type check
npx tsc --noEmit

# Deploy to Cloudflare (requires R2 bucket and queue setup first)
npm run deploy

# Generate TypeScript types from wrangler.toml
npm run cf-typegen

# Set production secrets
npx wrangler secret put ANTHROPIC_API_KEY

# Create required resources (one-time setup)
npx wrangler r2 bucket create agentkanban-files
npx wrangler queues create agent-tasks
```

## Architecture

```
src/
├── index.ts      # Main worker entry, routing, queue consumer
├── session.ts    # Durable Object: AgentSession class
├── tools.ts      # Tool definitions and handlers
└── types.ts      # Shared TypeScript interfaces
```

### Request Flow

```
Client → Worker (index.ts) → Durable Object (session.ts) → Anthropic API
                                    ↓
                            Tool Execution (tools.ts)
                                    ↓
                            R2 Storage (files)
```

### API Endpoints

**Backward Compatible:**
- `GET /health` - Health check with capability flags
- `POST /run` - Run agent (creates ephemeral session)
- `POST /stream` - Stream agent via SSE (creates ephemeral session)

**Session-Based:**
- `POST /sessions` - Create persistent session
- `GET /sessions/:id` - Get session state
- `POST /sessions/:id/run` - Run in existing session
- `POST /sessions/:id/stream` - Stream in existing session
- `GET /sessions/:id/files` - List session files

### Key Types

- `Env` - Environment bindings (AGENT_SESSION, FILE_STORAGE, TASK_QUEUE)
- `SessionState` - Persisted session data (messages, files, usage, config)
- `AgentMessage` - SSE message types (assistant, tool_use, tool_result, done, error)
- `ToolName` - Union of CoreToolName, CanvasToolName, ReplicateToolName

### Tools (23 total)

Tools are defined in `src/tools.ts`. Each tool has:
- Definition (name, description, input_schema) for Claude API
- Handler function for execution

**Core Tools (5):**
- `web_search` - Search the web (requires API key)
- `read_file` - Read file from R2 workspace
- `write_file` - Write file to R2 workspace
- `list_files` - List files in workspace
- `bash` - Safe bash command simulation

**Canvas MCP Tools (15):** Proxied to Vercel app `/api/design-mcp/tools/call`
- `canvas_create`, `canvas_delete`, `canvas_list`, `canvas_get`
- `canvas_add_node`, `canvas_update_node`, `canvas_delete_node`
- `canvas_add_connection`, `canvas_delete_connection`
- `canvas_export_svg`, `canvas_export_json`, `canvas_layout_auto`
- `mindmap_create`, `mindmap_add_branch`, `workflow_create`

**Replicate AI Tools (3):** Direct API calls to Replicate
- `replicate_run` - Run AI models (image generation, etc.)
- `replicate_search_models` - Search for models
- `replicate_get_model` - Get model details

To add a new tool:
1. Add to appropriate `*ToolName` type in `types.ts`
2. Add definition to `TOOL_DEFINITIONS` in `tools.ts`
3. Add handler to `TOOL_HANDLERS` in `tools.ts`

## Environment Variables

**Required Secrets:**
- `ANTHROPIC_API_KEY` - Anthropic API calls
- `REPLICATE_API_TOKEN` - Replicate AI model execution
- `CANVAS_MCP_URL` - Vercel app URL for canvas operations

**Variables:**
- `ENVIRONMENT` - Set to "production" by default

For local dev, create `.dev.vars`:
```
ANTHROPIC_API_KEY=sk-ant-xxx
REPLICATE_API_TOKEN=r8_xxx
CANVAS_MCP_URL=https://agentkanban.vercel.app
```

## Bindings

Defined in `wrangler.toml`:
- `AGENT_SESSION` - Durable Object namespace for sessions
- `FILE_STORAGE` - R2 bucket for file storage
- `TASK_QUEUE` - Queue for long-running tasks
- `SANDBOX` - Optional sandbox binding (requires paid plan)
