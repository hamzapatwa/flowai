import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { listOAuthProviders, listTools } from '@/lib/tools';
import { listOAuthTokens } from '@/lib/db/queries';
import { IntegrationsGrid } from '@/components/dashboard/IntegrationsGrid';

export default async function IntegrationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

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

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-[#737373] mt-1">
          Connect the services your agents can use as tools.
        </p>
      </div>
      <IntegrationsGrid
        providers={providers}
        tools={tools}
        connections={connections.map((c) => ({
          provider: c.provider,
          metadata: (c.metadata as Record<string, unknown>) ?? {},
        }))}
      />
    </div>
  );
}
