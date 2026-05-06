import Anthropic from '@anthropic-ai/sdk';
import { buildGenerationPrompt } from './prompts';
import { listIntegrations } from '@/lib/integrations';
import { GeneratedWorkflowSchema } from './schema';
import type { WorkflowDefinition } from '@/types/workflow';

const client = new Anthropic();

function buildIntegrationContext(): string {
  return listIntegrations()
    .map((integration) => {
      const triggers = integration.triggers
        .map((t) => `    - ${t.id}: ${t.description}`)
        .join('\n');
      const actions = integration.actions
        .map((a) => {
          const params = Object.entries(a.configSchema)
            .map(([k, v]) => `${k}${v.required ? '*' : ''}: ${v.type}`)
            .join(', ');
          return `    - ${a.id}: ${a.description} (params: ${params || 'none'})`;
        })
        .join('\n');
      return `${integration.name} (id: ${integration.id})\n  Triggers:\n${triggers || '    (none)'}\n  Actions:\n${actions || '    (none)'}`;
    })
    .join('\n\n');
}

export async function generateWorkflow(userPrompt: string): Promise<{
  name: string;
  description: string;
  triggerType: 'manual' | 'webhook';
  definition: WorkflowDefinition;
}> {
  const integrationContext = buildIntegrationContext();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: buildGenerationPrompt(integrationContext),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  let parsed: unknown;
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON. Please try rephrasing.');
  }

  const validation = GeneratedWorkflowSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Generated workflow failed validation: ${validation.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    );
  }

  const wf = validation.data;
  return {
    name: wf.name,
    description: wf.description,
    triggerType: wf.triggerType,
    definition: {
      nodes: wf.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        integration: n.integration,
        action: n.action,
        config: n.config,
        position: n.position,
      })),
      edges: wf.edges,
    },
  };
}
