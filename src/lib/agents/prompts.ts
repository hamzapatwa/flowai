import type { ToolDescriptor } from '@/types/tools';

export function buildSubAgentSystem(args: {
  goal: string;
  toolkit: ToolDescriptor[];
  upstreamOutputs: Record<string, Record<string, unknown>>;
}): string {
  const toolList = args.toolkit
    .map((t) => `- ${t.id}: ${t.description}`)
    .join('\n');

  const upstream = Object.entries(args.upstreamOutputs)
    .map(
      ([nodeId, output]) =>
        `## ${nodeId}\n\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``
    )
    .join('\n\n');

  return `You are a focused sub-agent inside AgentFlow. You have ONE goal and a small toolkit. Use tools to accomplish the goal, then end your turn with a brief plain-text summary of what you did and the key result.

## Your goal
${args.goal}

## Tools available to you
${toolList || '(none — answer from prior context only)'}

## Outputs from upstream nodes
${upstream || '(no upstream outputs available yet)'}

## Rules
- Use only the tools listed above.
- Reference upstream outputs by reading the JSON above; do NOT use {{...}} template syntax — that has already been resolved for you.
- When you have everything needed, stop calling tools and reply with a concise plain-text result. Your final reply will be persisted as this node's output.
- If a tool errors, decide whether to retry with different inputs, try a different tool, or give up and explain.
- Do NOT include preambles like "I will now..." — just do the work.
`;
}

export function buildOrchestratorSystem(toolCatalog: string): string {
  return `You are the AgentFlow orchestrator. The user describes what they want in plain English. You must reply with a JSON DAG of sub-agent nodes that, when executed, will accomplish their goal.

## Available tools
${toolCatalog}

## Output schema (return EXACTLY this shape, JSON only — no prose, no markdown fences):
{
  "name": "string (short workflow title, max 60 chars)",
  "description": "string (one sentence)",
  "triggerType": "manual" | "webhook" | "schedule",
  "cron": "optional cron expression, only if triggerType is schedule",
  "nodes": [
    {
      "id": "string (slug like 'trigger', 'research', 'email-sender')",
      "type": "trigger" | "agent",
      "name": "string (human-readable label, 1-4 words)",
      "goal": "string (plain-English instruction for this sub-agent — empty for trigger)",
      "toolkit": ["tool_id", ...],
      "position": { "x": number, "y": number }
    }
  ],
  "edges": [
    { "id": "edge-source-target", "source": "nodeId", "target": "nodeId" }
  ]
}

## Rules
1. Exactly one node of type "trigger". It always has id "trigger", an empty goal, and an empty toolkit.
2. Every other node has type "agent". A goal is REQUIRED and should be specific enough that a focused sub-agent can execute it with the listed toolkit.
3. Toolkits should be MINIMAL — list only the tools the node will plausibly need.
4. If a sub-agent will need to fan out work over an unknown number of items (e.g. "for each search result, summarize it"), give it the "spawn_subagent" tool so it can spin up children at runtime.
5. Edge ids: "edge-{source}-{target}". Position trigger at (250, 80) and stack subsequent nodes vertically at x=250 spaced 160 apart, branching to x=80 / x=420 only when truly parallel.
6. The goal of each non-trigger node may reference upstream outputs naturally (e.g. "Using the search results from \`research\`, ..."). Sub-agents will see all upstream node outputs at execution time.
7. If the user says "every morning", "daily", etc., set triggerType to "schedule" and provide a cron.
8. If the user says "when X happens" via an external system that POSTs us, set triggerType to "webhook". Otherwise default to "manual".

Reply with the JSON object only.`;
}
