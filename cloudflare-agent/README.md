# Cloudflare Agent Worker

Cloudflare Worker that runs Claude Agent SDK in isolated sandboxes for fast, reliable agent execution.

## Features

- **No cold-start issues** - Uses Cloudflare Sandbox with pre-configured Claude Code template
- **No timeouts** - Long-running agents supported (5+ minutes)
- **Streaming support** - Real-time SSE streaming of agent messages
- **Full tool support** - Read, Write, WebSearch, Bash, and more

## Setup

### 1. Install dependencies

```bash
cd cloudflare-agent
npm install
```

### 2. Configure secrets

```bash
# Set your Anthropic API key
wrangler secret put ANTHROPIC_API_KEY
```

### 3. Local development

Create `.dev.vars` file:
```
ANTHROPIC_API_KEY=sk-ant-xxx
```

Then run:
```bash
npm run dev
```

### 4. Deploy

```bash
npm run deploy
```

## API Endpoints

### POST /run
Run agent and get result when complete.

```bash
curl -X POST https://agentkanban-worker.your-subdomain.workers.dev/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hello world Python script",
    "systemPrompt": "You are a helpful coding assistant",
    "allowedTools": ["Read", "Write"],
    "maxTurns": 10
  }'
```

### POST /stream
Run agent with SSE streaming (real-time updates).

```bash
curl -X POST https://agentkanban-worker.your-subdomain.workers.dev/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Research the weather in NYC",
    "allowedTools": ["WebSearch", "WebFetch"]
  }'
```

### GET /health
Health check endpoint.

```bash
curl https://agentkanban-worker.your-subdomain.workers.dev/health
```

## Integration with Vercel Frontend

Set the `CLOUDFLARE_AGENT_URL` environment variable in your Vercel project:

```
CLOUDFLARE_AGENT_URL=https://agentkanban-worker.your-subdomain.workers.dev
```

The frontend will automatically route agent execution to the Cloudflare Worker.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│   Vercel Frontend   │────▶│  Cloudflare Agent Worker │
│   (Next.js + UI)    │◀────│  (Sandbox + Claude SDK)  │
└─────────────────────┘     └──────────────────────────┘
         │                              │
         │                              ▼
         │                   ┌────────────────────┐
         │                   │  Cloudflare Sandbox │
         │                   │  ┌────────────────┐ │
         │                   │  │  Claude Code   │ │
         │                   │  │  Agent SDK     │ │
         │                   │  │  Full Linux    │ │
         │                   │  └────────────────┘ │
         │                   └────────────────────┘
         │
         ▼
┌─────────────────────┐
│    Neon Database    │
│   (Sessions/State)  │
└─────────────────────┘
```

## Troubleshooting

### "Template not found" error
Make sure your Cloudflare account has Sandbox enabled (Workers Paid plan).

### Timeout errors
Increase the timeout in `wrangler.toml` or contact Cloudflare support for extended limits.

### API key errors
Verify `ANTHROPIC_API_KEY` is set correctly:
```bash
wrangler secret list
```
