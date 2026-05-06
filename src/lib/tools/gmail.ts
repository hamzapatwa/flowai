import { google } from 'googleapis';
import type { ToolDescriptor } from '@/types/tools';
import { getGoogleClient } from './google';

function makeRfc822(args: { to: string; subject: string; body: string; from?: string }) {
  const lines = [
    `To: ${args.to}`,
    args.from ? `From: ${args.from}` : '',
    `Subject: ${args.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    args.body,
  ].filter(Boolean);
  const raw = lines.join('\r\n');
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const GmailTool: ToolDescriptor = {
  id: 'gmail',
  name: 'Gmail',
  description: 'Send emails and search recent messages in the connected Gmail account.',
  icon: 'Mail',
  requiresOAuth: true,
  oauthProvider: 'gmail',
  toolDefinition: {
    name: 'gmail',
    description:
      'Send an email or fetch recent emails matching a Gmail search query. Requires the user to have connected Gmail.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['send_email', 'get_recent_emails'],
          description:
            'send_email composes and sends a plain-text email; get_recent_emails returns the metadata of recent matching messages.',
        },
        to: { type: 'string', description: 'Recipient email (send_email only).' },
        subject: { type: 'string', description: 'Subject line (send_email only).' },
        body: { type: 'string', description: 'Plain-text body (send_email only).' },
        query: {
          type: 'string',
          description:
            'Gmail search query, e.g. "is:unread from:boss@example.com" (get_recent_emails only).',
        },
        max_results: {
          type: 'number',
          description: 'Maximum messages to return for get_recent_emails. Defaults to 10.',
        },
      },
      required: ['action'],
    },
  },
  async execute(input, ctx) {
    const oauth2 = await getGoogleClient(ctx.userId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const action = String(input.action || '');

    if (action === 'send_email') {
      const to = String(input.to || '');
      const subject = String(input.subject || '');
      const body = String(input.body || '');
      if (!to || !subject) {
        throw new Error('gmail.send_email requires `to` and `subject`');
      }
      const raw = makeRfc822({ to, subject, body });
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
      return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
    }

    if (action === 'get_recent_emails') {
      const max = Number(input.max_results || 10);
      const list = await gmail.users.messages.list({
        userId: 'me',
        q: String(input.query || ''),
        maxResults: max,
      });
      const messages = list.data.messages ?? [];
      const emails = await Promise.all(
        messages.map(async (m) => {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: m.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          const headers = detail.data.payload?.headers ?? [];
          const get = (n: string) => headers.find((h) => h.name === n)?.value;
          return {
            id: m.id,
            from: get('From'),
            subject: get('Subject'),
            date: get('Date'),
            snippet: detail.data.snippet,
          };
        })
      );
      return { emails, count: emails.length };
    }

    throw new Error(`Unknown gmail action: ${action}`);
  },
};
