import { z } from 'zod';

export const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'action', 'condition']),
  name: z.string(),
  integration: z.enum(['webhook', 'http', 'slack', 'gmail']),
  action: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  condition: z.string().optional(),
});

export const GeneratedWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  triggerType: z.enum(['manual', 'webhook']),
  nodes: z.array(NodeSchema).min(1),
  edges: z.array(EdgeSchema),
});

export type GeneratedWorkflow = z.infer<typeof GeneratedWorkflowSchema>;
