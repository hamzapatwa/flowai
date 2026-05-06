export type NodeType = 'trigger' | 'agent';

export type TriggerType = 'manual' | 'webhook' | 'schedule';

export type ToolId =
  | 'slack'
  | 'gmail'
  | 'http'
  | 'web_search'
  | 'summarize'
  | 'calendar'
  | 'notion'
  | 'github'
  | 'spawn_subagent';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export type StepStatus = RunStatus | 'spawned';

export interface AgentNode {
  id: string;
  type: NodeType;
  name: string;
  /** Plain-English instruction handed to the sub-agent at runtime. Empty for trigger nodes. */
  goal: string;
  /** Tool ids the sub-agent is allowed to use. Empty for trigger nodes. */
  toolkit: ToolId[];
  /** Trigger-only: holds e.g. { cron: '0 9 * * *' } for schedule triggers, or {} otherwise. */
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
}

export interface AgentWorkflowDefinition {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

/** Backwards-compatible alias used throughout the app and DB jsonb shape. */
export type WorkflowDefinition = AgentWorkflowDefinition;
export type WorkflowNode = AgentNode;
export type WorkflowEdge = AgentEdge;

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  definition: AgentWorkflowDefinition;
  isActive: boolean;
  triggerType: TriggerType;
  webhookId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A single transcript entry emitted by the sub-agent runtime. */
export type TranscriptEntry =
  | { kind: 'goal'; text: string; at: string }
  | { kind: 'thought'; text: string; at: string }
  | { kind: 'tool_call'; tool: string; input: unknown; at: string; id: string }
  | {
      kind: 'tool_result';
      tool: string;
      output: unknown;
      isError: boolean;
      at: string;
      id: string;
    }
  | { kind: 'final'; text: string; at: string };

export interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  goal: string;
  toolkit: ToolId[];
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  transcript: TranscriptEntry[];
  parentStepId?: string | null;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  triggerData: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  steps: RunStep[];
  createdAt: string;
}
