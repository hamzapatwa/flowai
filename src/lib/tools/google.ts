import { google } from 'googleapis';
import { getOAuthToken, upsertOAuthToken } from '@/lib/db/queries';

/**
 * Combined Google scopes covering Gmail and Calendar. We treat "gmail" as the
 * single OAuth provider id in the DB and reuse it for both tools.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const GMAIL_SCOPES = GOOGLE_SCOPES;

export const GOOGLE_PROVIDER = 'gmail';

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/gmail/callback`
  );
}

export async function getValidGoogleToken(userId: string): Promise<string> {
  const tok = await getOAuthToken(userId, GOOGLE_PROVIDER);
  if (!tok) throw new Error('Google account is not connected');

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  const expiresAt = tok.expiresAt ? new Date(tok.expiresAt).getTime() : 0;

  if (expiresAt > fiveMinutesFromNow) {
    return tok.accessToken;
  }

  if (!tok.refreshToken) return tok.accessToken;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: tok.refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();

  if (!credentials.access_token) throw new Error('Failed to refresh Google token');

  await upsertOAuthToken({
    userId,
    provider: GOOGLE_PROVIDER,
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? tok.refreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    scope: tok.scope,
    metadata: (tok.metadata as Record<string, unknown>) ?? {},
  });

  return credentials.access_token;
}

export async function getGoogleClient(userId: string) {
  const token = await getValidGoogleToken(userId);
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ access_token: token });
  return oauth2;
}
