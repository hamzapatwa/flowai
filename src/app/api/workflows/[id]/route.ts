import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '@/lib/db/queries';
import {
  upsertScheduledTrigger,
  removeScheduledTrigger,
} from '@/lib/queue/jobs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ workflow: wf });
}

export async function PUT(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  const body = await req.json();
  const wf = await updateWorkflow(id, userId, {
    name: body.name,
    description: body.description,
    definition: body.definition,
    isActive: body.isActive,
    triggerType: body.triggerType,
    cron: body.cron,
  });
  if (!wf) return new NextResponse('Not found', { status: 404 });

  // Sync the BullMQ schedule to match the latest state.
  try {
    if (
      wf.triggerType === 'schedule' &&
      wf.cron &&
      wf.isActive
    ) {
      await upsertScheduledTrigger(id, wf.cron);
    } else {
      await removeScheduledTrigger(id);
    }
  } catch (err) {
    console.error('[api] Failed to sync schedule', err);
  }

  return NextResponse.json({ workflow: wf });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  try {
    await removeScheduledTrigger(id);
  } catch {
    /* ignore */
  }
  await deleteWorkflow(id, userId);
  return NextResponse.json({ ok: true });
}
