import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { nanoid } from 'nanoid';
import type { AgentWorkflowDefinition } from '../src/types/workflow';

const DEMO_USER_ID = 'user_demo_seed';

const newsDigestWorkflow: AgentWorkflowDefinition = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: 'Manual run',
      goal: '',
      toolkit: [],
      config: {},
      position: { x: 250, y: 80 },
    },
    {
      id: 'research',
      type: 'agent',
      name: 'Research',
      goal:
        'Use web_search to find the top 3 AI/tech announcements from the last 24 hours. Return a JSON list of {title, url, snippet}.',
      toolkit: ['web_search'],
      config: {},
      position: { x: 250, y: 240 },
    },
    {
      id: 'digest',
      type: 'agent',
      name: 'Digest',
      goal:
        'Using the research output, write a 3-bullet email digest. Each bullet: title, one-sentence summary, link.',
      toolkit: ['summarize'],
      config: {},
      position: { x: 250, y: 400 },
    },
  ],
  edges: [
    { id: 'edge-trigger-research', source: 'trigger', target: 'research' },
    { id: 'edge-research-digest', source: 'research', target: 'digest' },
  ],
};

const slackWebhookWorkflow: AgentWorkflowDefinition = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: 'Webhook',
      goal: '',
      toolkit: [],
      config: {},
      position: { x: 250, y: 80 },
    },
    {
      id: 'notify',
      type: 'agent',
      name: 'Notify Slack',
      goal:
        'Read the webhook payload (available as the `trigger` upstream output) and post a concise summary to the #engineering channel using the slack tool.',
      toolkit: ['slack', 'summarize'],
      config: {},
      position: { x: 250, y: 240 },
    },
  ],
  edges: [{ id: 'edge-trigger-notify', source: 'trigger', target: 'notify' }],
};

async function main() {
  const { db } = await import('../src/lib/db');
  const { users, workflows } = await import('../src/lib/db/schema');

  console.log('Seeding demo data...');

  await db
    .insert(users)
    .values({
      id: DEMO_USER_ID,
      email: 'demo@agentflow.local',
      name: 'Demo User',
    })
    .onConflictDoNothing();

  const seedWorkflows = [
    {
      name: 'AI news digest',
      description:
        'Find today’s top AI announcements, summarize, return a digest.',
      prompt:
        'Search the web for the top 3 AI announcements today and summarize each in two sentences.',
      definition: newsDigestWorkflow,
      triggerType: 'manual',
      isActive: true,
    },
    {
      name: 'Webhook → Slack notify',
      description:
        'When a webhook fires, summarize the payload and post it to Slack.',
      prompt:
        'When a webhook event arrives, summarize it and post a notification to the #engineering Slack channel.',
      definition: slackWebhookWorkflow,
      triggerType: 'webhook',
      isActive: false,
    },
  ];

  for (const wf of seedWorkflows) {
    await db
      .insert(workflows)
      .values({
        userId: DEMO_USER_ID,
        name: wf.name,
        description: wf.description,
        prompt: wf.prompt,
        definition: wf.definition as unknown as object,
        triggerType: wf.triggerType,
        isActive: wf.isActive,
        webhookId: wf.triggerType === 'webhook' ? nanoid(10) : null,
      })
      .returning();
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
