import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getWorkflow, listRunsWithSteps } from '@/lib/db/queries';
import { RunLog } from '@/components/dashboard/RunLog';

type Params = { params: Promise<{ id: string }> };

export default async function RunsPage({ params }: Params) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;

  const wf = await getWorkflow(id, userId);
  if (!wf) notFound();

  const runs = await listRunsWithSteps(id);
  const serialized = runs.map((r) => ({
    id: r.id,
    workflowId: r.workflowId,
    status: r.status,
    triggerData: (r.triggerData as Record<string, unknown>) ?? {},
    startedAt: r.startedAt ? r.startedAt.toString() : null,
    completedAt: r.completedAt ? r.completedAt.toString() : null,
    error: r.error ?? null,
    createdAt: r.createdAt.toString(),
    steps: r.steps.map((s) => ({
      id: s.id,
      nodeId: s.nodeId,
      nodeName: s.nodeName,
      status: s.status,
      input: (s.input as Record<string, unknown>) ?? {},
      output: (s.output as Record<string, unknown>) ?? {},
      error: s.error ?? null,
      startedAt: s.startedAt ? s.startedAt.toString() : null,
      completedAt: s.completedAt ? s.completedAt.toString() : null,
    })),
  }));

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        href={`/workflows/${id}`}
        className="text-sm text-[#737373] hover:text-[#fafafa] flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to editor
      </Link>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{wf.name}</h1>
        <p className="text-sm text-[#737373] mt-1">Run history</p>
      </div>
      <RunLog workflowId={id} initialRuns={serialized} />
    </div>
  );
}
