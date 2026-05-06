import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const globalForQueue = globalThis as unknown as {
  redis?: Redis;
  workflowQueue?: Queue;
};

function makeRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not set');
  }
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export function getRedis(): Redis {
  if (!globalForQueue.redis) {
    globalForQueue.redis = makeRedis();
  }
  return globalForQueue.redis;
}

export function getWorkflowQueue(): Queue {
  if (!globalForQueue.workflowQueue) {
    globalForQueue.workflowQueue = new Queue('workflow-execution', {
      connection: getRedis(),
    });
  }
  return globalForQueue.workflowQueue;
}

export async function enqueueWorkflowRun(runId: string, workflowId: string) {
  const queue = getWorkflowQueue();
  const job = await queue.add(
    'execute',
    { runId, workflowId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    }
  );
  console.log(`[queue] Enqueued job ${job.id} for run ${runId}`);
}
