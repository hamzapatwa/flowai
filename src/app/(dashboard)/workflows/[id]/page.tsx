import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { getWorkflow } from '@/lib/db/queries';
import { listIntegrations } from '@/lib/integrations';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import type { WorkflowDefinition } from '@/types/workflow';

type Params = { params: Promise<{ id: string }> };

export default async function WorkflowEditorPage({ params }: Params) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) notFound();

  const definition = (wf.definition as unknown as WorkflowDefinition) ?? {
    nodes: [],
    edges: [],
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const webhookUrl =
    wf.triggerType === 'webhook' && wf.webhookId
      ? `${baseUrl}/api/webhooks/trigger/${wf.webhookId}`
      : undefined;

  const integrations = listIntegrations().map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    actions: i.actions,
    triggers: i.triggers,
  }));

  return (
    <WorkflowEditor
      workflowId={wf.id}
      initialName={wf.name}
      initialDefinition={definition}
      initialActive={wf.isActive}
      initialTriggerType={wf.triggerType}
      webhookUrl={webhookUrl}
      integrations={integrations}
    />
  );
}
