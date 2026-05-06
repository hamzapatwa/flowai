import type { ToolDescriptor, ToolContext } from '@/types/tools';
import type { ToolId } from '@/types/workflow';

const KNOWN_TOOL_IDS: ToolId[] = [
  'slack',
  'gmail',
  'http',
  'web_search',
  'summarize',
  'calendar',
  'notion',
  'github',
  'spawn_subagent',
];

function isToolId(v: unknown): v is ToolId {
  return typeof v === 'string' && (KNOWN_TOOL_IDS as string[]).includes(v);
}

export const SpawnSubAgentTool: ToolDescriptor = {
  id: 'spawn_subagent',
  name: 'Spawn Sub-Agent',
  description:
    'Meta-tool: spin up a child sub-agent with its own goal and toolkit, run it, and return its output.',
  icon: 'Sparkles',
  requiresOAuth: false,
  toolDefinition: {
    name: 'spawn_subagent',
    description:
      'Delegate a focused sub-task to a child sub-agent. The child runs its own tool-use loop with the toolkit you provide and returns its final output. Use this to fan out work (e.g. "search and summarize each of these 5 topics") or to scope risky tool use to a single isolated agent. Depth and total spawn count are capped.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Short label for the child node (1-5 words). Shown on the canvas.',
        },
        goal: {
          type: 'string',
          description:
            "The child's plain-English instruction. Be specific — the child sees only this and the tools you grant it.",
        },
        toolkit: {
          type: 'array',
          description:
            'Tool ids the child is allowed to call. Pick the minimum needed.',
          items: {
            type: 'string',
            enum: KNOWN_TOOL_IDS,
          },
        },
      },
      required: ['goal', 'toolkit'],
    },
  },
  async execute(input, ctx: ToolContext) {
    if (!ctx.spawn) {
      throw new Error('spawn_subagent is unavailable in this context');
    }
    const goal = String(input.goal || '');
    if (!goal) throw new Error('spawn_subagent requires `goal`');

    const rawToolkit = Array.isArray(input.toolkit) ? input.toolkit : [];
    const toolkit = rawToolkit.filter(isToolId);
    if (toolkit.length === 0) {
      throw new Error('spawn_subagent requires a non-empty `toolkit`');
    }

    const name =
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim()
        : 'sub-agent';

    const { output, stepId } = await ctx.spawn({ goal, toolkit, name });
    return { stepId, ...output };
  },
};
