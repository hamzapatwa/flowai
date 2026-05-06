import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkflow, listRunsWithSteps } from '@/lib/db/queries';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) return new NextResponse('Not found', { status: 404 });

  const runs = await listRunsWithSteps(id);
  return NextResponse.json({ runs });
}
