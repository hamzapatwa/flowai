import { NextResponse } from 'next/server';
import { getWorkflowByWebhookId, createRun } from '@/lib/db/queries';
import { enqueueWorkflowRun } from '@/lib/queue/jobs';

type Params = { params: Promise<{ webhookId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { webhookId } = await params;
  const wf = await getWorkflowByWebhookId(webhookId);
  if (!wf) return new NextResponse('Not found', { status: 404 });
  if (!wf.isActive) {
    return new NextResponse('Workflow is not active', { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow non-JSON */
  }

  const headersObj: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headersObj[k] = v;
  });

  const triggerData = {
    body,
    headers: headersObj,
    method: req.method,
  };

  const run = await createRun({ workflowId: wf.id, triggerData });
  try {
    await enqueueWorkflowRun(run.id, wf.id);
  } catch (err) {
    console.error('Failed to enqueue webhook run', err);
  }

  return NextResponse.json({ accepted: true, runId: run.id }, { status: 202 });
}
