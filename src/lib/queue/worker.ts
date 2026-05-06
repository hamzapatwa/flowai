import { Worker, Queue } from 'bullmq';
import { getRedis } from './jobs';
import { executeWorkflow } from '@/lib/workflow/executor';
import {
  createRun,
  getWorkflow,
  updateRun,
} from '@/lib/db/queries';
import { enqueueWorkflowRun } from './jobs';
import { db } from '@/lib/db';
import { workflows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

console.log('[worker] DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('[worker] REDIS_URL set:', !!process.env.REDIS_URL);

const redis = getRedis();

const diagnosticQueue = new Queue('workflow-execution', { connection: redis });
diagnosticQueue.getJobCounts('waiting', 'active', 'failed', 'delayed').then((counts) => {
  console.log('[worker] Queue counts on startup:', counts);
});

const executionWorker = new Worker(
  'workflow-execution',
  async (job) => {
    console.log(`[worker] Processing run job ${job.id}`, job.data);
    const { runId, workflowId } = job.data as {
      runId: string;
      workflowId: string;
    };
    await executeWorkflow(runId, workflowId);
  },
  { connection: redis, concurrency: 5 }
);

executionWorker.on('active', (job) => {
  console.log(`[worker] Job ${job.id} is now active`);
});

executionWorker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

executionWorker.on('failed', async (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
  if (job?.attemptsMade && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const { runId } = (job.data ?? {}) as { runId?: string };
    if (runId) {
      try {
        await updateRun(runId, {
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
        });
      } catch (e) {
        console.error('[worker] Failed to update run after max retries', e);
      }
    }
  }
});

const scheduleWorker = new Worker(
  'workflow-schedule',
  async (job) => {
    const { workflowId } = job.data as { workflowId: string };
    console.log(`[worker] Schedule fired for workflow ${workflowId}`);
    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);
    const wf = rows[0];
    if (!wf) {
      console.warn(`[worker] Schedule fired for missing workflow ${workflowId}`);
      return;
    }
    if (!wf.isActive) {
      console.log(`[worker] Skipping inactive workflow ${workflowId}`);
      return;
    }
    // We pull the workflow via getWorkflow (which scopes by user) only for type assurance;
    // since the schedule job already trusts the DB, we can just create the run here.
    const checked = await getWorkflow(workflowId, wf.userId);
    if (!checked) return;
    const run = await createRun({
      workflowId,
      triggerData: { source: 'schedule', firedAt: new Date().toISOString() },
    });
    await enqueueWorkflowRun(run.id, workflowId);
  },
  { connection: redis, concurrency: 5 }
);

scheduleWorker.on('failed', (job, err) => {
  console.error(`[worker] Schedule job ${job?.id} failed:`, err.message);
});

console.log('[worker] AgentFlow worker started (execution + schedule)');

export default executionWorker;
export { scheduleWorker };
