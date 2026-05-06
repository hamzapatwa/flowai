import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { listIntegrations } from '@/lib/integrations';
import { listOAuthTokens } from '@/lib/db/queries';
import { IntegrationsGrid } from '@/components/dashboard/IntegrationsGrid';

export default async function IntegrationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

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

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-[#737373] mt-1">
          Connect the services you want to automate.
        </p>
      </div>
      <IntegrationsGrid
        integrations={integrations}
        connections={connections.map((c) => ({
          provider: c.provider,
          metadata: (c.metadata as Record<string, unknown>) ?? {},
        }))}
      />
    </div>
  );
}
