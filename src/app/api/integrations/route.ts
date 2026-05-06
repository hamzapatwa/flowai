import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listIntegrations } from '@/lib/integrations';
import { listOAuthTokens, deleteOAuthToken } from '@/lib/db/queries';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const integrations = listIntegrations().map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    icon: i.icon,
    requiresOAuth: i.requiresOAuth,
    oauthProvider: i.oauthProvider,
    triggerCount: i.triggers.length,
    actionCount: i.actions.length,
  }));

  const connections = await listOAuthTokens(userId);

  return NextResponse.json({ integrations, connections });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { provider } = await req.json();
  if (!provider) return new NextResponse('Missing provider', { status: 400 });
  await deleteOAuthToken(userId, provider);
  return NextResponse.json({ ok: true });
}
