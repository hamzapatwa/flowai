import type { IntegrationProvider } from './workflow';

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'json';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, FieldDefinition>;
  outputSchema: Record<string, string>;
}

export interface TriggerDefinition {
  id: string;
  name: string;
  description: string;
  outputSchema: Record<string, string>;
}

export interface ExecutionContext {
  userId: string;
  runId: string;
  stepData: Record<string, Record<string, unknown>>;
  oauthToken?: string;
  oauthMetadata?: Record<string, unknown>;
}

export interface Integration {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  requiresOAuth: boolean;
  oauthProvider?: string;
  triggers: TriggerDefinition[];
  actions: ActionDefinition[];
  execute(
    action: string,
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>>;
}
