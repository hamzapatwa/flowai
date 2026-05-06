import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { runs, workflows } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { subscribeToRun } from '@/lib/events/bus';

type Params = { params: Promise<{ runId: string }> };

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });
  const { runId } = await params;

  const rows = await db
    .select({ runId: runs.id, workflowOwner: workflows.userId })
    .from(runs)
    .innerJoin(workflows, eq(runs.workflowId, workflows.id))
    .where(and(eq(runs.id, runId), eq(workflows.userId, userId)))
    .limit(1);

  if (rows.length === 0) return new Response('Not found', { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => Promise<void>) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      send(JSON.stringify({ type: 'connected', runId, at: new Date().toISOString() }));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          /* stream closed */
        }
      }, 15000);

      unsubscribe = subscribeToRun(runId, (event) => {
        try {
          send(JSON.stringify(event));
          if (event.type === 'run_finished') {
            clearInterval(heartbeat);
            controller.close();
          }
        } catch {
          /* stream already closed */
        }
      });

      const onAbort = () => {
        clearInterval(heartbeat);
        if (unsubscribe) {
          unsubscribe().catch(() => {});
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', onAbort);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe().catch(() => {});
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
