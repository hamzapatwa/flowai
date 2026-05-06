import Anthropic from '@anthropic-ai/sdk';
import { listTools } from '@/lib/tools';
import { buildOrchestratorSystem } from './prompts';
import { OrchestratorOutputSchema } from './schema';
import type {
  AgentNode,
  AgentWorkflowDefinition,
  TriggerType,
} from '@/types/workflow';

const client = new Anthropic();

function buildToolCatalog(): string {
  return listTools()
    .map((t) => {
      const auth = t.requiresOAuth ? ` (requires OAuth: ${t.oauthProvider})` : '';
      return `- ${t.id}${auth}: ${t.description}`;
    })
    .join('\n');
}

export interface OrchestratorResult {
  name: string;
  description: string;
  triggerType: TriggerType;
  cron: string | null;
  prompt: string;
  definition: AgentWorkflowDefinition;
}

export async function orchestrate(userPrompt: string): Promise<OrchestratorResult> {
  const toolCatalog = buildToolCatalog();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3000,
    system: [
      {
        type: 'text',
        text: buildOrchestratorSystem(toolCatalog),
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
    throw new Error(
      'Orchestrator returned invalid JSON. Try rephrasing your request.'
    );
  }

  const validation = OrchestratorOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Orchestrator output failed validation: ${validation.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    );
  }

  const out = validation.data;

  const nodes: AgentNode[] = out.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    name: n.name,
    goal: n.type === 'trigger' ? '' : n.goal,
    toolkit: n.type === 'trigger' ? [] : n.toolkit,
    config:
      n.type === 'trigger' && out.triggerType === 'schedule' && out.cron
        ? { cron: out.cron }
        : {},
    position: n.position,
  }));

  return {
    name: out.name,
    description: out.description,
    triggerType: out.triggerType,
    cron: out.cron ?? null,
    prompt: userPrompt,
    definition: {
      nodes,
      edges: out.edges,
    },
  };
}
