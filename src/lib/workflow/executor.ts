import {
  getRun,
  updateRun,
  createRunStep,
  updateRunStep,
  getOAuthToken,
} from '@/lib/db/queries';
import { db } from '@/lib/db';
import { workflows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getIntegration } from '@/lib/integrations';
import { WorkflowContext } from './context';
import { topologicalSort } from './utils';
import type { WorkflowDefinition, WorkflowNode } from '@/types/workflow';

export async function executeWorkflow(runId: string, workflowId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const wfRows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);
  const workflow = wfRows[0];
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const userId = workflow.userId;
  const definition = workflow.definition as unknown as WorkflowDefinition;

  await updateRun(runId, { status: 'running', startedAt: new Date() });

  const ctx = new WorkflowContext(
    (run.triggerData as Record<string, unknown>) ?? {}
  );

  let sorted: WorkflowNode[];
  try {
    sorted = topologicalSort(definition.nodes, definition.edges);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sort failed';
    await updateRun(runId, {
      status: 'failed',
      error: msg,
      completedAt: new Date(),
    });
    throw err;
  }

  for (const node of sorted) {
    if (node.type === 'trigger') {
      ctx.setStepOutput(
        node.id,
        (run.triggerData as Record<string, unknown>) ?? {}
      );
      continue;
    }

    const integration = getIntegration(node.integration);
    if (!integration) {
      const err = `Unknown integration: ${node.integration}`;
      await updateRun(runId, {
        status: 'failed',
        error: err,
        completedAt: new Date(),
      });
      throw new Error(err);
    }

    const interpolatedConfig = ctx.interpolate(node.config) as Record<
      string,
      unknown
    >;

    const step = await createRunStep({
      runId,
      nodeId: node.id,
      nodeName: node.name,
      input: interpolatedConfig,
    });

    let oauthToken: string | undefined;
    let oauthMetadata: Record<string, unknown> | undefined;
    if (integration.requiresOAuth && integration.oauthProvider) {
      const tok = await getOAuthToken(userId, integration.oauthProvider);
      if (!tok) {
        const errMsg = `${integration.name} is not connected for this user`;
        await updateRunStep(step.id, {
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
        });
        await updateRun(runId, {
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
        });
        throw new Error(errMsg);
      }
      oauthToken = tok.accessToken;
      oauthMetadata = (tok.metadata as Record<string, unknown>) ?? {};
    }

    try {
      const output = await integration.execute(node.action, interpolatedConfig, {
        userId,
        runId,
        stepData: ctx.allStepData(),
        oauthToken,
        oauthMetadata,
      });
      ctx.setStepOutput(node.id, output);
      await updateRunStep(step.id, {
        status: 'success',
        output,
        completedAt: new Date(),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateRunStep(step.id, {
        status: 'failed',
        error: errMsg,
        completedAt: new Date(),
      });
      await updateRun(runId, {
        status: 'failed',
        error: errMsg,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  await updateRun(runId, { status: 'success', completedAt: new Date() });
}
