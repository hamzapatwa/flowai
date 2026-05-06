import { eq, and, desc } from 'drizzle-orm';
import { db } from './index';
import { workflows, runs, runSteps, oauthTokens, users } from './schema';
import { nanoid } from 'nanoid';
import type { WorkflowDefinition } from '@/types/workflow';

export async function ensureUser(params: {
  id: string;
  email: string;
  name?: string | null;
}) {
  await db
    .insert(users)
    .values({ id: params.id, email: params.email, name: params.name ?? null })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: params.email, name: params.name ?? null },
    });
}

export async function listWorkflows(userId: string) {
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.updatedAt));
}

export async function getWorkflow(id: string, userId: string) {
  const rows = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWorkflowByWebhookId(webhookId: string) {
  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.webhookId, webhookId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createWorkflow(input: {
  userId: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  triggerType: string;
}) {
  const webhookId =
    input.triggerType === 'webhook' ? nanoid(10) : null;
  const rows = await db
    .insert(workflows)
    .values({
      userId: input.userId,
      name: input.name,
      description: input.description,
      definition: input.definition as unknown as object,
      triggerType: input.triggerType,
      webhookId,
    })
    .returning();
  return rows[0];
}

export async function updateWorkflow(
  id: string,
  userId: string,
  patch: Partial<{
    name: string;
    description: string;
    definition: WorkflowDefinition;
    isActive: boolean;
    triggerType: string;
  }>
) {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.definition !== undefined) update.definition = patch.definition;
  if (patch.isActive !== undefined) update.isActive = patch.isActive;
  if (patch.triggerType !== undefined) {
    update.triggerType = patch.triggerType;
    if (patch.triggerType === 'webhook') {
      const existing = await getWorkflow(id, userId);
      if (existing && !existing.webhookId) update.webhookId = nanoid(10);
    }
  }
  const rows = await db
    .update(workflows)
    .set(update)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteWorkflow(id: string, userId: string) {
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));
}

export async function createRun(input: {
  workflowId: string;
  triggerData?: Record<string, unknown>;
}) {
  const rows = await db
    .insert(runs)
    .values({
      workflowId: input.workflowId,
      triggerData: input.triggerData ?? {},
      status: 'pending',
    })
    .returning();
  return rows[0];
}

export async function listRuns(workflowId: string) {
  return db
    .select()
    .from(runs)
    .where(eq(runs.workflowId, workflowId))
    .orderBy(desc(runs.createdAt))
    .limit(50);
}

export async function listRunsWithSteps(workflowId: string) {
  const allRuns = await listRuns(workflowId);
  const result = await Promise.all(
    allRuns.map(async (run) => {
      const steps = await db
        .select()
        .from(runSteps)
        .where(eq(runSteps.runId, run.id));
      return { ...run, steps };
    })
  );
  return result;
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: string;
    startedAt: Date;
    completedAt: Date;
    error: string;
  }>
) {
  const rows = await db
    .update(runs)
    .set(patch)
    .where(eq(runs.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function getRun(id: string) {
  const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createRunStep(input: {
  runId: string;
  nodeId: string;
  nodeName: string;
  input?: Record<string, unknown>;
}) {
  const rows = await db
    .insert(runSteps)
    .values({
      runId: input.runId,
      nodeId: input.nodeId,
      nodeName: input.nodeName,
      input: input.input ?? {},
      status: 'running',
      startedAt: new Date(),
    })
    .returning();
  return rows[0];
}

export async function updateRunStep(
  id: string,
  patch: Partial<{
    status: string;
    output: Record<string, unknown>;
    error: string;
    completedAt: Date;
  }>
) {
  await db.update(runSteps).set(patch).where(eq(runSteps.id, id));
}

export async function getOAuthToken(userId: string, provider: string) {
  const rows = await db
    .select()
    .from(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertOAuthToken(input: {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db
    .insert(oauthTokens)
    .values({
      userId: input.userId,
      provider: input.provider,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      scope: input.scope ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.provider],
      set: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        expiresAt: input.expiresAt ?? null,
        scope: input.scope ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      },
    });
}

export async function deleteOAuthToken(userId: string, provider: string) {
  await db
    .delete(oauthTokens)
    .where(
      and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider))
    );
}

export async function listOAuthTokens(userId: string) {
  return db
    .select({
      id: oauthTokens.id,
      provider: oauthTokens.provider,
      scope: oauthTokens.scope,
      metadata: oauthTokens.metadata,
      createdAt: oauthTokens.createdAt,
    })
    .from(oauthTokens)
    .where(eq(oauthTokens.userId, userId));
}
