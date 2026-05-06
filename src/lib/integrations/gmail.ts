import { google } from 'googleapis';
import type { Integration } from '@/types/integrations';
import { getOAuthToken, upsertOAuthToken } from '@/lib/db/queries';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/gmail/callback`
  );
}

export async function getValidGoogleToken(userId: string): Promise<string> {
  const tok = await getOAuthToken(userId, 'gmail');
  if (!tok) throw new Error('Gmail is not connected');

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  const expiresAt = tok.expiresAt ? new Date(tok.expiresAt).getTime() : 0;

  if (expiresAt > fiveMinutesFromNow) {
    return tok.accessToken;
  }

  if (!tok.refreshToken) return tok.accessToken;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: tok.refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();

  if (!credentials.access_token) throw new Error('Failed to refresh token');

  await upsertOAuthToken({
    userId,
    provider: 'gmail',
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? tok.refreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    scope: tok.scope,
    metadata: (tok.metadata as Record<string, unknown>) ?? {},
  });

  return credentials.access_token;
}

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

export const GmailIntegration: Integration = {
  id: 'gmail',
  name: 'Gmail',
  description: 'Send and read Gmail messages',
  icon: 'Mail',
  requiresOAuth: true,
  oauthProvider: 'gmail',
  triggers: [],
  actions: [
    {
      id: 'send_email',
      name: 'Send Email',
      description: 'Send an email via Gmail',
      configSchema: {
        to: {
          type: 'string',
          label: 'To',
          required: true,
          placeholder: 'recipient@example.com',
        },
        subject: {
          type: 'string',
          label: 'Subject',
          required: true,
        },
        body: {
          type: 'textarea',
          label: 'Body',
          required: true,
        },
      },
      outputSchema: { id: 'string', threadId: 'string' },
    },
    {
      id: 'get_recent_emails',
      name: 'Get Recent Emails',
      description: 'Fetch recent emails matching a query',
      configSchema: {
        query: {
          type: 'string',
          label: 'Search Query',
          required: false,
          placeholder: 'is:unread',
        },
        max_results: {
          type: 'number',
          label: 'Max Results',
          required: false,
          placeholder: '10',
        },
      },
      outputSchema: { emails: 'array', count: 'number' },
    },
  ],
  async execute(action, config, context) {
    const token = await getValidGoogleToken(context.userId);
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });

    if (action === 'send_email') {
      const raw = makeRfc822({
        to: String(config.to || ''),
        subject: String(config.subject || ''),
        body: String(config.body || ''),
      });
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
      return { id: res.data.id ?? '', threadId: res.data.threadId ?? '' };
    }

    if (action === 'get_recent_emails') {
      const max = Number(config.max_results || 10);
      const list = await gmail.users.messages.list({
        userId: 'me',
        q: String(config.query || ''),
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

    throw new Error(`Unknown Gmail action: ${action}`);
  },
};
