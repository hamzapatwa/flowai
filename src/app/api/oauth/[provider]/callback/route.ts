import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertOAuthToken } from '@/lib/db/queries';
import { getOAuth2Client } from '@/lib/tools/google';

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Params) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const stored = cookieStore.get(`oauth_state_${provider}`)?.value;
  if (!code || !state || !stored) {
    return new NextResponse('Missing code or state', { status: 400 });
  }
  const [userId, expectedState] = stored.split(':');
  if (state !== expectedState) {
    return new NextResponse('State mismatch', { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/oauth/${provider}/callback`;

  try {
    if (provider === 'slack') {
      const body = new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID ?? '',
        client_secret: process.env.SLACK_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
      });
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = (await res.json()) as {
        ok: boolean;
        access_token?: string;
        scope?: string;
        team?: { id: string; name: string };
        authed_user?: { id: string };
        error?: string;
      };
      if (!json.ok || !json.access_token) {
        return new NextResponse(`Slack OAuth failed: ${json.error}`, {
          status: 400,
        });
      }
      await upsertOAuthToken({
        userId,
        provider: 'slack',
        accessToken: json.access_token,
        scope: json.scope ?? null,
        metadata: {
          team: json.team,
          authed_user: json.authed_user,
        },
      });
    } else if (provider === 'gmail') {
      const oauth2 = getOAuth2Client();
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.access_token) {
        return new NextResponse('Google OAuth failed', { status: 400 });
      }

      let email: string | undefined;
      try {
        const profileRes = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        const profile = (await profileRes.json()) as { email?: string };
        email = profile.email;
      } catch {
        /* optional */
      }

      await upsertOAuthToken({
        userId,
        provider: 'gmail',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
        metadata: { email },
      });
    } else if (provider === 'github') {
      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        }
      );
      const json = (await tokenRes.json()) as {
        access_token?: string;
        scope?: string;
        token_type?: string;
        error?: string;
      };
      if (!json.access_token) {
        return new NextResponse(`GitHub OAuth failed: ${json.error ?? ''}`, {
          status: 400,
        });
      }

      let login: string | undefined;
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${json.access_token}`,
            Accept: 'application/vnd.github+json',
          },
        });
        const u = (await userRes.json()) as { login?: string };
        login = u.login;
      } catch {
        /* optional */
      }

      await upsertOAuthToken({
        userId,
        provider: 'github',
        accessToken: json.access_token,
        scope: json.scope ?? null,
        metadata: { login },
      });
    } else if (provider === 'notion') {
      const auth = Buffer.from(
        `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
      ).toString('base64');
      const res = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });
      const json = (await res.json()) as {
        access_token?: string;
        workspace_name?: string;
        workspace_id?: string;
        bot_id?: string;
        owner?: { user?: { name?: string; id?: string } };
        error?: string;
      };
      if (!json.access_token) {
        return new NextResponse(`Notion OAuth failed: ${json.error ?? ''}`, {
          status: 400,
        });
      }
      await upsertOAuthToken({
        userId,
        provider: 'notion',
        accessToken: json.access_token,
        metadata: {
          workspace_name: json.workspace_name,
          workspace_id: json.workspace_id,
          bot_id: json.bot_id,
          owner: json.owner,
        },
      });
    } else {
      return new NextResponse('Unknown provider', { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth error';
    return new NextResponse(msg, { status: 500 });
  }

  const redirect = NextResponse.redirect(`${baseUrl}/integrations?connected=${provider}`);
  redirect.cookies.delete(`oauth_state_${provider}`);
  return redirect;
}
