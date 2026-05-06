import { WebClient } from '@slack/web-api';
import type { ToolDescriptor } from '@/types/tools';

export const SlackTool: ToolDescriptor = {
  id: 'slack',
  name: 'Slack',
  description: 'Post messages to Slack channels or send direct messages to users.',
  icon: 'MessageCircle',
  requiresOAuth: true,
  oauthProvider: 'slack',
  toolDefinition: {
    name: 'slack',
    description:
      'Send a message to a Slack channel or a direct message to a Slack user. Requires the user to have connected Slack via OAuth.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['send_message', 'send_dm'],
          description:
            'send_message posts to a channel; send_dm opens a DM with a user id and posts there.',
        },
        channel: {
          type: 'string',
          description:
            'Channel name like #general or channel id like C0123456789. Required for send_message.',
        },
        user_id: {
          type: 'string',
          description: 'Slack user id like U0123456789. Required for send_dm.',
        },
        text: {
          type: 'string',
          description: 'The message body to send.',
        },
      },
      required: ['action', 'text'],
    },
  },
  async execute(input, ctx) {
    const tok = await ctx.getOAuth('slack');
    if (!tok) {
      throw new Error('Slack is not connected. Connect it in Integrations.');
    }
    const client = new WebClient(tok.accessToken);
    const action = String(input.action || 'send_message');
    const text = String(input.text || '');

    if (action === 'send_message') {
      const channel = String(input.channel || '');
      if (!channel) throw new Error('slack.send_message requires `channel`');
      const res = await client.chat.postMessage({ channel, text });
      return { ok: res.ok ?? false, ts: res.ts ?? '', channel: res.channel ?? '' };
    }

    if (action === 'send_dm') {
      const userId = String(input.user_id || '');
      if (!userId) throw new Error('slack.send_dm requires `user_id`');
      const open = await client.conversations.open({ users: userId });
      const channel = open.channel?.id;
      if (!channel) throw new Error('Could not open DM');
      const res = await client.chat.postMessage({ channel, text });
      return { ok: res.ok ?? false, ts: res.ts ?? '' };
    }

    throw new Error(`Unknown slack action: ${action}`);
  },
};
