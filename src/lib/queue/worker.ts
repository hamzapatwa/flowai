import { Worker, Queue } from 'bullmq';
import { getRedis } from './jobs';
import { executeWorkflow } from '@/lib/workflow/executor';
import { updateRun } from '@/lib/db/queries';

console.log('[worker] DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('[worker] REDIS_URL set:', !!process.env.REDIS_URL);
console.log('[worker] REDIS_URL value:', process.env.REDIS_URL);

const redis = getRedis();

// Log queue stats on startup
const diagnosticQueue = new Queue('workflow-execution', { connection: redis });
diagnosticQueue.getJobCounts('waiting', 'active', 'failed', 'delayed').then((counts) => {
  console.log('[worker] Queue counts on startup:', counts);
});

const worker = new Worker(
  'workflow-execution',
  async (job) => {
    console.log(`[worker] Processing job ${job.id}`, job.data);
    const { runId, workflowId } = job.data as {
      runId: string;
      workflowId: string;
    };
    await executeWorkflow(runId, workflowId);
  },
  { connection: redis, concurrency: 5 }
);

worker.on('active', (job) => {
  console.log(`[worker] Job ${job.id} is now active`);
});

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
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

console.log('[worker] FlowAI workflow worker started');

export default worker;
