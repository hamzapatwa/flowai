import type { ToolId } from './workflow';

/** JSON Schema fragment understood by the Anthropic Messages API as `input_schema`. */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/** Per-tool execution context passed to `execute()`. */
export interface ToolContext {
  userId: string;
  runId: string;
  /** The current sub-agent step row id (used as parentStepId by spawn_subagent). */
  stepId: string;
  /** Output blobs keyed by node id for {{nodeId.field}} interpolation in agent goals. */
  stepData: Record<string, Record<string, unknown>>;
  /** Cached OAuth tokens for the current user, keyed by provider. */
  oauthToken?: string;
  oauthMetadata?: Record<string, unknown>;
  /** Hooks the registry uses to resolve provider-specific OAuth on demand. */
  getOAuth: (
    provider: string
  ) => Promise<{ accessToken: string; metadata: Record<string, unknown> } | null>;
  /** Reserved for spawn_subagent — wired in src/lib/workflow/executor.ts. */
  spawn?: (args: {
    goal: string;
    toolkit: ToolId[];
    name?: string;
  }) => Promise<{ output: Record<string, unknown>; stepId: string }>;
}

export interface ToolDescriptor {
  id: ToolId;
  /** Human label shown in the UI. */
  name: string;
  /** One-sentence description used in UI cards and in the orchestrator prompt. */
  description: string;
  /** lucide-react icon name used by the UI. */
  icon: string;
  /** OAuth provider id (matches the `oauth_tokens.provider` column). */
  oauthProvider?: string;
  requiresOAuth: boolean;
  /** Anthropic Messages API tool definition exposed to the sub-agent. */
  toolDefinition: {
    name: string;
    description: string;
    input_schema: ToolInputSchema;
  };
  execute(
    input: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<Record<string, unknown>>;
}
