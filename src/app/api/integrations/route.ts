import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listOAuthProviders, listTools } from '@/lib/tools';
import { listOAuthTokens, deleteOAuthToken } from '@/lib/db/queries';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const providers = listOAuthProviders();
  const tools = listTools().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    requiresOAuth: t.requiresOAuth,
    oauthProvider: t.oauthProvider,
  }));
  const connections = await listOAuthTokens(userId);

  return NextResponse.json({ providers, tools, connections });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { provider } = await req.json();
  if (!provider) return new NextResponse('Missing provider', { status: 400 });
  await deleteOAuthToken(userId, provider);
  return NextResponse.json({ ok: true });
}
