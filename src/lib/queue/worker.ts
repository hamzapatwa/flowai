import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { Worker } from 'bullmq';
import { getRedis } from './jobs';
import { executeWorkflow } from '@/lib/workflow/executor';
import { updateRun } from '@/lib/db/queries';

const worker = new Worker(
  'workflow-execution',
  async (job) => {
    const { runId, workflowId } = job.data as {
      runId: string;
      workflowId: string;
    };
    await executeWorkflow(runId, workflowId);
  },
  { connection: getRedis(), concurrency: 5 }
);

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
