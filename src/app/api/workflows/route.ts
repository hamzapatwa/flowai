import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { listWorkflows, createWorkflow, ensureUser } from '@/lib/db/queries';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const items = await listWorkflows(userId);
  return NextResponse.json({ workflows: items });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (email) {
    await ensureUser({
      id: userId,
      email,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
    });
  }

  const body = await req.json();
  const wf = await createWorkflow({
    userId,
    name: body.name ?? 'Untitled workflow',
    description: body.description ?? '',
    definition: body.definition ?? { nodes: [], edges: [] },
    triggerType: body.triggerType ?? 'manual',
  });

  return NextResponse.json({ workflow: wf });
}
