import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkflow, createRun } from '@/lib/db/queries';
import { enqueueWorkflowRun } from '@/lib/queue/jobs';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) return new NextResponse('Not found', { status: 404 });

  let triggerData: Record<string, unknown> = {};
  try {
    triggerData = await req.json();
  } catch {
    /* allow empty body */
  }

  const run = await createRun({ workflowId: id, triggerData });
  try {
    await enqueueWorkflowRun(run.id, id);
  } catch (err) {
    console.error('Failed to enqueue', err);
    return NextResponse.json(
      { error: 'Failed to enqueue run', runId: run.id },
      { status: 500 }
    );
  }
  return NextResponse.json({ runId: run.id });
}
