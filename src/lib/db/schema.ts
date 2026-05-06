import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflows = pgTable(
  'workflows',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Latest user prompt that produced/regenerated this workflow. */
    prompt: text('prompt'),
    definition: jsonb('definition').notNull().default({}),
    isActive: boolean('is_active').notNull().default(false),
    triggerType: text('trigger_type').notNull().default('manual'),
    /** For schedule triggers, a cron expression like "0 9 * * *". */
    cron: text('cron'),
    webhookId: text('webhook_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    webhookIdx: uniqueIndex('workflows_webhook_id_idx').on(table.webhookId),
  })
);

export const runs = pgTable('runs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  triggerData: jsonb('trigger_data').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const runSteps = pgTable('run_steps', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  nodeName: text('node_name').notNull(),
  /** Plain-English instruction the sub-agent was given. */
  goal: text('goal').notNull().default(''),
  /** ToolId[] this sub-agent was allowed to use. */
  toolkit: jsonb('toolkit').notNull().default([]),
  /** Parent step id for spawned sub-agents (null for top-level DAG nodes). */
  parentStepId: text('parent_step_id'),
  status: text('status').notNull().default('pending'),
  input: jsonb('input').notNull().default({}),
  output: jsonb('output').notNull().default({}),
  /** TranscriptEntry[] — append-only log of what the sub-agent thought/did. */
  transcript: jsonb('transcript').notNull().default([]),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scope: text('scope'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userProviderIdx: uniqueIndex('oauth_user_provider_idx').on(
      table.userId,
      table.provider
    ),
  })
);

export type User = typeof users.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
export type OAuthToken = typeof oauthTokens.$inferSelect;
