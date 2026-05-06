import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { nanoid } from 'nanoid';
import { GMAIL_SCOPES } from '@/lib/tools/google';

const SLACK_SCOPES = ['chat:write', 'channels:read', 'users:read', 'im:write'];
const GITHUB_SCOPES = ['repo', 'read:org', 'user:email'];

type Params = { params: Promise<{ provider: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { provider } = await params;
  const state = nanoid(24);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/oauth/${provider}/callback`;

  let authUrl: string;

  if (provider === 'slack') {
    const clientId = process.env.SLACK_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: SLACK_SCOPES.join(','),
      redirect_uri: redirectUri,
      state,
    });
    authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  } else if (provider === 'gmail') {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_SCOPES.join(' '),
      state,
      allow_signup: 'true',
    });
    authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  } else if (provider === 'notion') {
    const clientId = process.env.NOTION_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });
    authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  } else {
    return new NextResponse('Unknown provider', { status: 400 });
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(`oauth_state_${provider}`, `${userId}:${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
