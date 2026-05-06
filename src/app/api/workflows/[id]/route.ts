import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '@/lib/db/queries';

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
  });
  if (!wf) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ workflow: wf });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  await deleteWorkflow(id, userId);
  return NextResponse.json({ ok: true });
}
