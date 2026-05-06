export type NodeType = 'trigger' | 'action' | 'condition';

export type TriggerType = 'manual' | 'webhook' | 'schedule';

export type IntegrationProvider = 'webhook' | 'http' | 'slack' | 'gmail';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  integration: IntegrationProvider;
  action: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  isActive: boolean;
  triggerType: TriggerType;
  webhookId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
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
