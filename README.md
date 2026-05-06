# AgentFlow

AI-native workflow builder. Describe what you want in plain English; an orchestrator agent plans a DAG of sub-agents and runs it. Each node is its own Claude tool-use loop — `web_search`, `summarize`, `slack`, `gmail`, `http`, `calendar`, `notion`, `github`, and the meta-tool `spawn_subagent`. Live status streams to a React Flow canvas as the run progresses.

Think n8n, but you describe the workflow instead of dragging blocks, and every node is an agent rather than a fixed action.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript**, **Tailwind v4**, custom dark UI
- **React Flow** (`@xyflow/react`) for the visual editor
- **Anthropic Claude Sonnet 4.5** — orchestrator + every sub-agent uses the Messages tool-use API
- **Postgres** + **Drizzle ORM** (Neon, Supabase, or any Postgres)
- **Redis** + **BullMQ** for the run queue, plus Redis Pub/Sub for live SSE updates
- **Clerk** for authentication

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Install dependencies:
   ```
   npm install
   ```
3. Push the schema to your database:
   ```
   npm run db:push
   ```
4. Run the Next.js dev server **and** the BullMQ worker (in two terminals):
   ```
   npm run dev
   npm run worker
   ```

## Architecture

- `src/app/(dashboard)/` — authenticated UI (workflows, editor, runs, integrations)
- `src/app/api/` — REST + OAuth + webhook + SSE stream routes
- `src/lib/agents/` — orchestrator (plans the DAG) and sub-agent runtime (per-node Claude tool loop)
- `src/lib/tools/` — tool registry; one file per tool (`slack`, `gmail`, `http`, `web_search`, `summarize`, `calendar`, `github`, `notion`, `spawn`, `webhook`)
- `src/lib/workflow/` — DAG executor with topological sort and dynamic spawning
- `src/lib/events/` — Redis pub/sub event bus for live run status
- `src/lib/queue/` — BullMQ producer (`jobs.ts`) and worker (`worker.ts`)
- `src/lib/db/` — Drizzle schema + queries

## How a run works

1. User types an intent in the New Workflow dialog.
2. The orchestrator agent (Claude) returns a DAG of agent nodes — each with a plain-English `goal` and a `toolkit` of allowed tools.
3. The DAG is queued via BullMQ and executed by the worker. For each node, a sub-agent is spun up: Claude is given the goal plus the chosen toolkit and runs a tool-use loop until it stops.
4. Sub-agents may dynamically spawn child sub-agents via the `spawn_subagent` meta-tool (capped depth + count).
5. Every state change publishes an event to `run:{runId}` on Redis. The editor subscribes via SSE and lights up the canvas live.

## Deploying

- Next.js → Vercel (set all env vars)
- Worker → Railway / Fly / a VPS (`npm run worker`)
- Postgres → Neon / Supabase
- Redis → Upstash or Railway
