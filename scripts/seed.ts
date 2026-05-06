import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { nanoid } from 'nanoid';
import type { WorkflowDefinition } from '../src/types/workflow';

const DEMO_USER_ID = 'user_demo_seed';

const slackWorkflow: WorkflowDefinition = {
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      name: 'Webhook',
      integration: 'webhook',
      action: 'receive',
      config: {},
      position: { x: 250, y: 100 },
    },
    {
      id: 'action-slack-1',
      type: 'action',
      name: 'Notify #engineering',
      integration: 'slack',
      action: 'send_message',
      config: {
        channel: '#engineering',
        text: 'New webhook event: {{trigger-1.body}}',
      },
      position: { x: 250, y: 250 },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'trigger-1', target: 'action-slack-1' },
  ],
};

const httpWorkflow: WorkflowDefinition = {
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      name: 'Manual',
      integration: 'webhook',
      action: 'manual',
      config: {},
      position: { x: 250, y: 100 },
    },
    {
      id: 'action-http-1',
      type: 'action',
      name: 'Fetch JSON',
      integration: 'http',
      action: 'get',
      config: { url: 'https://api.github.com/zen' },
      position: { x: 250, y: 250 },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'trigger-1', target: 'action-http-1' },
  ],
};

const gmailWorkflow: WorkflowDefinition = {
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      name: 'Webhook',
      integration: 'webhook',
      action: 'receive',
      config: {},
      position: { x: 250, y: 100 },
    },
    {
      id: 'action-gmail-1',
      type: 'action',
      name: 'Send confirmation',
      integration: 'gmail',
      action: 'send_email',
      config: {
        to: '{{trigger-1.body.email}}',
        subject: 'Thanks for signing up!',
        body: 'Welcome aboard.',
      },
      position: { x: 250, y: 250 },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'trigger-1', target: 'action-gmail-1' },
  ],
};

async function main() {
  const { db } = await import('../src/lib/db');
  const { users, workflows, runs, runSteps } = await import('../src/lib/db/schema');

  console.log('Seeding demo data...');

  await db
    .insert(users)
    .values({
      id: DEMO_USER_ID,
      email: 'demo@flowai.local',
      name: 'Demo User',
    })
    .onConflictDoNothing();

  const seedWorkflows = [
    {
      name: 'GitHub PR → Slack',
      description: 'Notify the team in Slack when a PR is opened.',
      definition: slackWorkflow,
      triggerType: 'webhook',
      isActive: true,
    },
    {
      name: 'Manual GitHub Zen',
      description: 'Fetch a random Zen quote from GitHub.',
      definition: httpWorkflow,
      triggerType: 'manual',
      isActive: true,
    },
    {
      name: 'Signup → Welcome Email',
      description: 'Send a welcome email when someone signs up.',
      definition: gmailWorkflow,
      triggerType: 'webhook',
      isActive: false,
    },
  ];

  for (const wf of seedWorkflows) {
    const inserted = await db
      .insert(workflows)
      .values({
        userId: DEMO_USER_ID,
        name: wf.name,
        description: wf.description,
        definition: wf.definition as unknown as object,
        triggerType: wf.triggerType,
        isActive: wf.isActive,
        webhookId: wf.triggerType === 'webhook' ? nanoid(10) : null,
      })
      .returning();

    const wfId = inserted[0].id;
    const run = await db
      .insert(runs)
      .values({
        workflowId: wfId,
        status: 'success',
        triggerData: { body: { sample: true }, headers: {}, method: 'POST' },
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(Date.now() - 58_000),
      })
      .returning();

    for (const node of wf.definition.nodes) {
      await db.insert(runSteps).values({
        runId: run[0].id,
        nodeId: node.id,
        nodeName: node.name,
        status: 'success',
        input: node.config,
        output: { ok: true, mock: true },
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(Date.now() - 58_000),
      });
    }
  }

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
