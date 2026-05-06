# FlowAI

AI-native workflow automation. Describe a workflow in plain English; FlowAI generates a visual DAG and runs it on real integrations (Webhook, HTTP, Slack, Gmail).

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript**, **Tailwind v4**, custom dark UI
- **React Flow** (`@xyflow/react`) for the visual editor
- **Postgres** + **Drizzle ORM** (Supabase or any Postgres)
- **Redis** + **BullMQ** for the workflow execution queue
- **Clerk** for authentication
- **Anthropic Claude Sonnet 4.5** for natural-language → workflow generation

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
4. (Optional) Seed demo data:
   ```
   npm run seed
   ```
5. Run the Next.js dev server **and** the BullMQ worker (in two terminals):
   ```
   npm run dev
   npm run worker
   ```

## Architecture

- `src/app/(dashboard)/` — authenticated UI (workflows, editor, runs, integrations)
- `src/app/api/` — REST routes for CRUD + run + OAuth + webhook trigger
- `src/lib/integrations/` — pluggable integration adapters
- `src/lib/workflow/` — DAG executor, topological sort, variable interpolation
- `src/lib/queue/` — BullMQ producer (`jobs.ts`) and worker (`worker.ts`)
- `src/lib/ai/` — Claude prompt + JSON-schema-validated parser

## Deploying

- Next.js → Vercel (set all env vars)
- Worker → Railway / Fly / a VPS (`npm run worker`)
- Postgres → Supabase
- Redis → Upstash or Railway

## Demo

Use the **Load demo** button in the New Workflow dialog to pre-fill a "GitHub PR → Slack" prompt.
