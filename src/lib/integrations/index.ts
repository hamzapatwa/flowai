import type { Integration } from '@/types/integrations';
import type { IntegrationProvider } from '@/types/workflow';
import { WebhookIntegration } from './webhook';
import { HttpIntegration } from './http';
import { SlackIntegration } from './slack';
import { GmailIntegration } from './gmail';

export const INTEGRATIONS: Record<IntegrationProvider, Integration> = {
  webhook: WebhookIntegration,
  http: HttpIntegration,
  slack: SlackIntegration,
  gmail: GmailIntegration,
};

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS[id as IntegrationProvider];
}

export function listIntegrations(): Integration[] {
  return Object.values(INTEGRATIONS);
}
