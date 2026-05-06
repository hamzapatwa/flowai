import { WebClient } from '@slack/web-api';
import type { Integration } from '@/types/integrations';

export const SlackIntegration: Integration = {
  id: 'slack',
  name: 'Slack',
  description: 'Send messages and DMs to Slack channels',
  icon: 'MessageCircle',
  requiresOAuth: true,
  oauthProvider: 'slack',
  triggers: [],
  actions: [
    {
      id: 'send_message',
      name: 'Send Message',
      description: 'Post a message to a Slack channel',
      configSchema: {
        channel: {
          type: 'string',
          label: 'Channel',
          required: true,
          placeholder: '#general or C0123456789',
        },
        text: {
          type: 'textarea',
          label: 'Message',
          required: true,
          placeholder: 'Hello, world!',
        },
      },
      outputSchema: { ts: 'string', channel: 'string', ok: 'boolean' },
    },
    {
      id: 'send_dm',
      name: 'Send Direct Message',
      description: 'Send a DM to a user',
      configSchema: {
        user_id: {
          type: 'string',
          label: 'User ID',
          required: true,
          placeholder: 'U0123456789',
        },
        text: {
          type: 'textarea',
          label: 'Message',
          required: true,
        },
      },
      outputSchema: { ts: 'string', ok: 'boolean' },
    },
  ],
  async execute(action, config, context) {
    if (!context.oauthToken) {
      throw new Error('Slack is not connected. Connect it in Integrations.');
    }
    const client = new WebClient(context.oauthToken);

    if (action === 'send_message') {
      const res = await client.chat.postMessage({
        channel: String(config.channel || ''),
        text: String(config.text || ''),
      });
      return {
        ok: res.ok ?? false,
        ts: res.ts ?? '',
        channel: res.channel ?? '',
      };
    }

    if (action === 'send_dm') {
      const open = await client.conversations.open({
        users: String(config.user_id || ''),
      });
      const channel = open.channel?.id;
      if (!channel) throw new Error('Could not open DM');
      const res = await client.chat.postMessage({
        channel,
        text: String(config.text || ''),
      });
      return { ok: res.ok ?? false, ts: res.ts ?? '' };
    }

    throw new Error(`Unknown Slack action: ${action}`);
  },
};
