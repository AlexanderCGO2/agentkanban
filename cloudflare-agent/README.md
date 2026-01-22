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

### 2. Cloudflare Authentication

**Option A: Interactive Login (Recommended for first-time setup)**
```bash
npx wrangler login
```

**Option B: API Token (For CI/CD)**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a token with "Edit Cloudflare Workers" permissions
3. Set the environment variable:
```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

### 3. Set Anthropic API Key

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# Enter your Anthropic API key when prompted
```

### 4. Local Development

Create `.dev.vars` file:
```
ANTHROPIC_API_KEY=sk-ant-xxx
```

Then run:
```bash
npm run dev
```

### 5. Deploy

```bash
npm run deploy
```

After deployment, note the URL (e.g., `https://agentkanban-worker.YOUR-SUBDOMAIN.workers.dev`)

### 6. Configure Vercel

Add the Cloudflare Worker URL to your Vercel project:

```bash
vercel env add CLOUDFLARE_AGENT_URL
# Enter: https://agentkanban-worker.YOUR-SUBDOMAIN.workers.dev
```

## API Endpoints

### POST /run
Run agent and get result when complete.

```bash
curl -X POST https://agentkanban-worker.YOUR-SUBDOMAIN.workers.dev/run \
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
curl -X POST https://agentkanban-worker.YOUR-SUBDOMAIN.workers.dev/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Research the weather in NYC",
    "allowedTools": ["WebSearch", "WebFetch"]
  }'
```

### GET /health
Health check endpoint.

```bash
curl https://agentkanban-worker.YOUR-SUBDOMAIN.workers.dev/health
```

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

### "Unexpected fields found in top-level field: sandbox"
Make sure you have a Cloudflare Workers Paid plan with Sandbox enabled.
Contact Cloudflare support to enable Sandbox for your account.

### "Failed to fetch auth token"
Run `npx wrangler login` to authenticate, or set `CLOUDFLARE_API_TOKEN`.

### API key errors
Verify `ANTHROPIC_API_KEY` is set correctly:
```bash
npx wrangler secret list
```

## Requirements

- Cloudflare Workers Paid plan with Sandbox enabled
- Anthropic API key
- Node.js 18+
