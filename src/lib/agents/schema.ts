import { z } from 'zod';

const TOOL_IDS = [
  'slack',
  'gmail',
  'http',
  'web_search',
  'summarize',
  'calendar',
  'notion',
  'github',
  'spawn_subagent',
] as const;

export const ToolIdSchema = z.enum(TOOL_IDS);

export const OrchestratorNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'agent']),
  name: z.string().min(1),
  goal: z.string().default(''),
  toolkit: z.array(ToolIdSchema).default([]),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const OrchestratorEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

export const OrchestratorOutputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string(),
  triggerType: z.enum(['manual', 'webhook', 'schedule']),
  cron: z.string().optional().nullable(),
  nodes: z.array(OrchestratorNodeSchema).min(1),
  edges: z.array(OrchestratorEdgeSchema),
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
