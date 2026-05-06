import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import {
  getWorkflow,
  listOAuthTokens,
  getLatestRunForWorkflow,
} from '@/lib/db/queries';
import { listTools } from '@/lib/tools';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import type { AgentWorkflowDefinition, ToolId } from '@/types/workflow';

type Params = { params: Promise<{ id: string }> };

export default async function WorkflowEditorPage({ params }: Params) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) notFound();

  const definition = (wf.definition as unknown as AgentWorkflowDefinition) ?? {
    nodes: [],
    edges: [],
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const webhookUrl =
    wf.triggerType === 'webhook' && wf.webhookId
      ? `${baseUrl}/api/webhooks/trigger/${wf.webhookId}`
      : undefined;

  const tools = listTools().map((t) => ({
    id: t.id as ToolId,
    name: t.name,
    description: t.description,
    requiresOAuth: t.requiresOAuth,
    oauthProvider: t.oauthProvider,
  }));

  const tokens = await listOAuthTokens(userId);
  const connectedProviders = tokens.map((t) => t.provider);

  const latestRun = await getLatestRunForWorkflow(id);
  const initialRunId =
    latestRun && (latestRun.status === 'pending' || latestRun.status === 'running')
      ? latestRun.id
      : null;

  return (
    <WorkflowEditor
      workflowId={wf.id}
      initialName={wf.name}
      initialDefinition={definition}
      initialActive={wf.isActive}
      initialTriggerType={wf.triggerType}
      webhookUrl={webhookUrl}
      tools={tools}
      connectedProviders={connectedProviders}
      initialRunId={initialRunId}
    />
  );
}
