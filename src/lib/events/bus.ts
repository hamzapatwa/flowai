import { Redis } from 'ioredis';
import type { TranscriptEntry } from '@/types/workflow';

const globalForBus = globalThis as unknown as {
  pubRedis?: Redis;
};

function makeRedis() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set');
  return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
}

/** Shared publisher connection. */
function getPublisher(): Redis {
  if (!globalForBus.pubRedis) {
    globalForBus.pubRedis = makeRedis();
  }
  return globalForBus.pubRedis;
}

export type RunEvent =
  | { type: 'run_started'; runId: string; at: string }
  | {
      type: 'step_started';
      runId: string;
      stepId: string;
      nodeId: string;
      nodeName: string;
      goal: string;
      toolkit: string[];
      parentStepId?: string | null;
      at: string;
    }
  | {
      type: 'step_message';
      runId: string;
      stepId: string;
      entry: TranscriptEntry;
      at: string;
    }
  | {
      type: 'step_finished';
      runId: string;
      stepId: string;
      status: 'success' | 'failed';
      output?: Record<string, unknown>;
      error?: string;
      at: string;
    }
  | {
      type: 'node_spawned';
      runId: string;
      parentStepId: string;
      stepId: string;
      nodeId: string;
      nodeName: string;
      goal: string;
      toolkit: string[];
      at: string;
    }
  | {
      type: 'run_finished';
      runId: string;
      status: 'success' | 'failed';
      error?: string;
      at: string;
    };

const channel = (runId: string) => `agentflow:run:${runId}`;

export async function publishEvent(event: RunEvent): Promise<void> {
  const pub = getPublisher();
  await pub.publish(channel(event.runId), JSON.stringify(event));
}

/**
 * Subscribe to events for a run. Returns an async unsubscribe function.
 * Each subscription opens its own dedicated ioredis connection because the
 * subscribe command takes the connection out of normal command mode.
 */
export function subscribeToRun(
  runId: string,
  handler: (event: RunEvent) => void
): () => Promise<void> {
  const sub = makeRedis();
  const ch = channel(runId);
  sub.subscribe(ch).catch((err) => {
    console.error('[events] subscribe failed', err);
  });
  sub.on('message', (_chan, payload) => {
    try {
      handler(JSON.parse(payload) as RunEvent);
    } catch (err) {
      console.error('[events] failed to parse payload', err);
    }
  });
  return async () => {
    try {
      await sub.unsubscribe(ch);
    } catch {
      /* ignore */
    }
    sub.disconnect();
  };
}
