import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  getRun,
  updateRun,
  createRunStep,
  updateRunStep,
  getOAuthToken,
} from '@/lib/db/queries';
import { db } from '@/lib/db';
import { workflows } from '@/lib/db/schema';
import { runSubAgent } from '@/lib/agents/subagent';
import { publishEvent } from '@/lib/events/bus';
import { topologicalSort } from './utils';
import { WorkflowContext } from './context';
import type {
  AgentNode,
  AgentWorkflowDefinition,
  ToolId,
} from '@/types/workflow';
import type { ToolContext } from '@/types/tools';

const MAX_SPAWN_DEPTH = 3;
const MAX_SPAWN_PER_RUN = 10;

export async function executeWorkflow(runId: string, workflowId: string) {
  console.log(`[executor] Starting run ${runId} for workflow ${workflowId}`);

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
  const definition = workflow.definition as unknown as AgentWorkflowDefinition;

  await updateRun(runId, { status: 'running', startedAt: new Date() });
  await publishEvent({
    type: 'run_started',
    runId,
    at: new Date().toISOString(),
  });

  const ctx = new WorkflowContext(
    (run.triggerData as Record<string, unknown>) ?? {}
  );

  let sorted: AgentNode[];
  try {
    sorted = topologicalSort(definition.nodes, definition.edges);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sort failed';
    await failRun(runId, msg);
    throw err;
  }

  // Cached OAuth tokens per provider for this run.
  const tokenCache = new Map<
    string,
    { accessToken: string; metadata: Record<string, unknown> } | null
  >();

  const getOAuth: ToolContext['getOAuth'] = async (provider) => {
    if (tokenCache.has(provider)) return tokenCache.get(provider) ?? null;
    const tok = await getOAuthToken(userId, provider);
    const value = tok
      ? {
          accessToken: tok.accessToken,
          metadata: (tok.metadata as Record<string, unknown>) ?? {},
        }
      : null;
    tokenCache.set(provider, value);
    return value;
  };

  let spawnedCount = 0;

  /**
   * Recursively run a sub-agent, with optional spawn capability.
   * Children created via spawn_subagent themselves get a spawn fn (depth+1).
   */
  const runNode = async (args: {
    node: { id: string; name: string; goal: string; toolkit: ToolId[] };
    parentStepId: string | null;
    depth: number;
    upstreamOutputs: Record<string, Record<string, unknown>>;
  }) => {
    const step = await createRunStep({
      runId,
      nodeId: args.node.id,
      nodeName: args.node.name,
      goal: args.node.goal,
      toolkit: args.node.toolkit,
      parentStepId: args.parentStepId,
      input: { goal: args.node.goal, toolkit: args.node.toolkit },
    });

    if (args.parentStepId) {
      await publishEvent({
        type: 'node_spawned',
        runId,
        parentStepId: args.parentStepId,
        stepId: step.id,
        nodeId: args.node.id,
        nodeName: args.node.name,
        goal: args.node.goal,
        toolkit: args.node.toolkit,
        at: new Date().toISOString(),
      });
    } else {
      await publishEvent({
        type: 'step_started',
        runId,
        stepId: step.id,
        nodeId: args.node.id,
        nodeName: args.node.name,
        goal: args.node.goal,
        toolkit: args.node.toolkit,
        at: new Date().toISOString(),
      });
    }

    const spawn =
      args.depth < MAX_SPAWN_DEPTH
        ? async (childArgs: {
            goal: string;
            toolkit: ToolId[];
            name?: string;
          }) => {
            if (spawnedCount >= MAX_SPAWN_PER_RUN) {
              throw new Error(
                `spawn_subagent: per-run cap of ${MAX_SPAWN_PER_RUN} reached`
              );
            }
            spawnedCount++;
            const childNode = {
              id: `${args.node.id}-spawn-${nanoid(4)}`,
              name: childArgs.name ?? 'sub-agent',
              goal: childArgs.goal,
              toolkit: childArgs.toolkit,
            };
            const result = await runNode({
              node: childNode,
              parentStepId: step.id,
              depth: args.depth + 1,
              upstreamOutputs: args.upstreamOutputs,
            });
            return { output: result.output, stepId: result.stepId };
          }
        : undefined;

    try {
      const { output } = await runSubAgent({
        runId,
        stepId: step.id,
        userId,
        nodeId: args.node.id,
        nodeName: args.node.name,
        goal: args.node.goal,
        toolkit: args.node.toolkit,
        upstreamOutputs: args.upstreamOutputs,
        getOAuth,
        spawn,
      });
      await publishEvent({
        type: 'step_finished',
        runId,
        stepId: step.id,
        status: 'success',
        output,
        at: new Date().toISOString(),
      });
      return { output, stepId: step.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateRunStep(step.id, {
        status: 'failed',
        error: msg,
        completedAt: new Date(),
      });
      await publishEvent({
        type: 'step_finished',
        runId,
        stepId: step.id,
        status: 'failed',
        error: msg,
        at: new Date().toISOString(),
      });
      throw err;
    }
  };

  try {
    for (const node of sorted) {
      if (node.type === 'trigger') {
        ctx.setStepOutput(
          node.id,
          (run.triggerData as Record<string, unknown>) ?? {}
        );
        continue;
      }

      const interpolatedGoal =
        typeof node.goal === 'string'
          ? (ctx.interpolate(node.goal) as string)
          : '';

      const { output } = await runNode({
        node: {
          id: node.id,
          name: node.name,
          goal: interpolatedGoal,
          toolkit: node.toolkit,
        },
        parentStepId: null,
        depth: 0,
        upstreamOutputs: ctx.allStepData(),
      });

      ctx.setStepOutput(node.id, output);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun(runId, msg);
    throw err;
  }

  console.log(`[executor] Run ${runId} completed`);
  await updateRun(runId, { status: 'success', completedAt: new Date() });
  await publishEvent({
    type: 'run_finished',
    runId,
    status: 'success',
    at: new Date().toISOString(),
  });
}

async function failRun(runId: string, error: string) {
  await updateRun(runId, {
    status: 'failed',
    error,
    completedAt: new Date(),
  });
  await publishEvent({
    type: 'run_finished',
    runId,
    status: 'failed',
    error,
    at: new Date().toISOString(),
  });
}
