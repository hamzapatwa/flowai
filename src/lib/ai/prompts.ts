export function buildGenerationPrompt(availableIntegrations: string): string {
  return `You are a workflow automation expert. The user will describe a workflow in plain English and you must convert it to a structured JSON workflow definition.

AVAILABLE INTEGRATIONS AND ACTIONS:
${availableIntegrations}

RULES:
1. Every workflow must start with exactly ONE trigger node (type: "trigger")
2. All subsequent nodes must be action nodes (type: "action")
3. Nodes connect sequentially via edges (source -> target). Edge id format: "edge-<source>-<target>"
4. Use realistic positions: trigger at {x: 250, y: 100}, then increment y by 150 per node
5. Node IDs must be unique slugs like "trigger-1", "action-slack-1", "action-gmail-1"
6. Config values can reference previous node outputs using {{nodeId.fieldName}} syntax
7. Only use integrations and actions listed above
8. The "integration" field on a trigger node must match the trigger type:
   - For triggerType "webhook" the trigger node uses integration "webhook" and action "receive"
   - For triggerType "manual" the trigger node uses integration "webhook" and action "manual" (placeholder)
9. The trigger node's config can be empty {}.
10. Choose sensible defaults for action configs based on the user's description.

RESPOND ONLY WITH VALID JSON. No explanation, no markdown fences, no backticks. Just the JSON object matching this schema:
{
  "name": "string (short descriptive workflow name, max 50 chars)",
  "description": "string (one sentence)",
  "triggerType": "manual" | "webhook",
  "nodes": [
    {
      "id": "string",
      "type": "trigger" | "action",
      "name": "string (human-readable label)",
      "integration": "webhook" | "http" | "slack" | "gmail",
      "action": "string (one of the action ids listed above, or 'receive' / 'manual' for triggers)",
      "config": { ... },
      "position": { "x": number, "y": number }
    }
  ],
  "edges": [
    { "id": "string", "source": "nodeId", "target": "nodeId" }
  ]
}`;
}
