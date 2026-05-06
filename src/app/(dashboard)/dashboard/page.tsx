import { auth, currentUser } from '@clerk/nextjs/server';
import { listWorkflows, ensureUser } from '@/lib/db/queries';
import { WorkflowCard } from '@/components/dashboard/WorkflowCard';
import { NewWorkflowDialog } from '@/components/dashboard/NewWorkflowDialog';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (email) {
    await ensureUser({
      id: userId,
      email,
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
    });
  }

  const workflows = await listWorkflows(userId);

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-[#737373] mt-1">
            {workflows.length} agent workflow{workflows.length === 1 ? '' : 's'}
          </p>
        </div>
        <NewWorkflowDialog />
      </div>

      {workflows.length === 0 ? (
        <div className="border border-dashed border-[#1f1f1f] rounded-lg p-16 text-center">
          <h3 className="text-lg font-medium mb-2">No agent workflows yet</h3>
          <p className="text-sm text-[#737373] mb-6">
            Click <span className="text-[#fafafa]">New Workflow</span> and
            describe what you want — agents take it from there.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={{
                id: wf.id,
                name: wf.name,
                description: wf.description,
                isActive: wf.isActive,
                triggerType: wf.triggerType,
                updatedAt: wf.updatedAt.toString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
