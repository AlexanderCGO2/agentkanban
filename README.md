# Craisee Agent Hub

An intelligent AI agent management platform built with Next.js and the Claude Agent SDK. Create, configure, and run autonomous AI agents with specialized roles for design, development, research, and more.

## Features

- **8 Pre-configured Agent Templates**: Design, Intern, Project Manager, Team Assist, Data Analyst, Copywriter, Accountant, and Developer agents
- **Autonomous Execution**: Agents use tools proactively to complete tasks and create output files
- **Real-time Streaming**: Watch agents work with live message updates via Server-Sent Events
- **Persistent Storage**: Optional Neon PostgreSQL database for data persistence
- **Beautiful UI**: Modern, role-specific styling with gradient themes

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Required: Anthropic API Key (for Claude Agent SDK)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional: Neon PostgreSQL Database (for persistence)
# Get your connection string from https://console.neon.tech
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Optional: Replicate API Token (for image generation)
REPLICATE_API_TOKEN=your_replicate_token
```

### 3. Set Up Database (Optional)

If you want persistent storage with Neon PostgreSQL:

1. Create a free account at [Neon](https://console.neon.tech)
2. Create a new project and database
3. Copy the connection string to your `.env.local` as `DATABASE_URL`
4. Initialize the database schema:

```bash
# Start the dev server first
npm run dev

# Then initialize the database (in another terminal)
curl -X POST http://localhost:3000/api/init-db
```

**Note**: Without `DATABASE_URL`, the app uses in-memory storage (data won't persist between restarts).

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Agent Templates

| Agent | Role | Description |
|-------|------|-------------|
| 🎨 Design Agent | UI/UX Design | Creates design specs, wireframes, and component documentation |
| 📚 Intern Agent | Research | Gathers and structures information, creates reports |
| 📋 Project Manager | Planning | Creates project plans, task breakdowns, and status reports |
| 🤝 Team Assist | Operations | Coordinates meetings, creates summaries and reminders |
| 📊 Data Analyst | Analysis | Analyzes data, generates insights and recommendations |
| ✍️ Copywriter | Content | Creates marketing copy, product descriptions, SEO content |
| 💰 Accountant | Finance | Processes financial data, creates reports |
| 💻 Developer | Engineering | Implements features, fixes bugs, writes code |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Create a new agent |
| `/api/agents/[id]` | GET | Get agent by ID |
| `/api/agents/[id]` | PATCH | Update agent |
| `/api/agents/[id]` | DELETE | Delete agent |
| `/api/agents/[id]/stream` | POST | Run agent with streaming |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/[id]` | GET | Get session by ID |
| `/api/sessions/[id]` | DELETE | Delete session |
| `/api/init-db` | GET | Check database status |
| `/api/init-db` | POST | Initialize database schema |

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) with App Router
- **AI**: [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- **Database**: [Neon PostgreSQL](https://neon.tech) (serverless)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Language**: TypeScript

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── agents/    # Agent CRUD + streaming
│   │   ├── sessions/  # Session management
│   │   └── init-db/   # Database initialization
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main page
├── components/
│   ├── AgentCard.tsx     # Agent display card
│   ├── AgentForm.tsx     # Agent creation form
│   ├── AgentRunner.tsx   # Agent execution UI
│   ├── MessageList.tsx   # Chat messages
│   ├── OutputViewer.tsx  # File outputs
│   ├── SessionList.tsx   # Session history
│   └── SessionViewer.tsx # Session details
├── hooks/
│   └── useAgents.ts   # Agent state hook
├── lib/
│   ├── agent-runner.ts    # Agent execution logic
│   ├── agent-store.ts     # Data storage (DB + in-memory)
│   ├── agent-templates.ts # Agent configurations
│   └── db.ts              # Database connection
└── types/
    └── agent.ts       # TypeScript types
```

## License

MIT
