import type { Integration } from '@/types/integrations';

export const WebhookIntegration: Integration = {
  id: 'webhook',
  name: 'Webhook',
  description: 'Trigger workflows via HTTP POST',
  icon: 'Webhook',
  requiresOAuth: false,
  triggers: [
    {
      id: 'receive',
      name: 'Receive Webhook',
      description:
        'Triggers when a POST request is received at the webhook URL',
      outputSchema: { body: 'object', headers: 'object', method: 'string' },
    },
  ],
  actions: [],
  async execute() {
    throw new Error('Webhook has no actions');
  },
};
