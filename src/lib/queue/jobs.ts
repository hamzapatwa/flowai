import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const globalForQueue = globalThis as unknown as {
  redis?: Redis;
  workflowQueue?: Queue;
  scheduleQueue?: Queue;
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

export function getScheduleQueue(): Queue {
  if (!globalForQueue.scheduleQueue) {
    globalForQueue.scheduleQueue = new Queue('workflow-schedule', {
      connection: getRedis(),
    });
  }
  return globalForQueue.scheduleQueue;
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

const scheduleJobName = (workflowId: string) => `schedule:${workflowId}`;

/**
 * Register a recurring scheduled trigger for a workflow. Idempotent:
 * removes any prior repeatable for the same workflow before adding a new one.
 */
export async function upsertScheduledTrigger(
  workflowId: string,
  cron: string
): Promise<void> {
  const queue = getScheduleQueue();
  const repeatables = await queue.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.name === scheduleJobName(workflowId)) {
      await queue.removeRepeatableByKey(r.key);
    }
  }
  await queue.add(
    scheduleJobName(workflowId),
    { workflowId },
    {
      repeat: { pattern: cron },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    }
  );
  console.log(`[queue] Scheduled workflow ${workflowId} with cron "${cron}"`);
}

export async function removeScheduledTrigger(workflowId: string): Promise<void> {
  const queue = getScheduleQueue();
  const repeatables = await queue.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.name === scheduleJobName(workflowId)) {
      await queue.removeRepeatableByKey(r.key);
    }
  }
  console.log(`[queue] Removed schedule for workflow ${workflowId}`);
}
