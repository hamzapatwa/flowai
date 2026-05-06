import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { getTool } from '@/lib/tools';
import type { ToolDescriptor, ToolContext } from '@/types/tools';
import type { ToolId, TranscriptEntry } from '@/types/workflow';
import { appendTranscript, updateRunStep } from '@/lib/db/queries';
import { publishEvent } from '@/lib/events/bus';
import { buildSubAgentSystem } from './prompts';

const client = new Anthropic();

const DEFAULT_MAX_ITERATIONS = 10;

export interface SubAgentArgs {
  runId: string;
  stepId: string;
  userId: string;
  nodeId: string;
  nodeName: string;
  goal: string;
  toolkit: ToolId[];
  upstreamOutputs: Record<string, Record<string, unknown>>;
  /** Resolves an OAuth token by provider id (or null). */
  getOAuth: ToolContext['getOAuth'];
  /** Provided by the executor to enable spawn_subagent. */
  spawn?: ToolContext['spawn'];
  /** Hard cap on tool-use iterations. Defaults to 10. */
  maxIterations?: number;
}

export interface SubAgentResult {
  output: Record<string, unknown>;
  finalText: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function emit(
  runId: string,
  stepId: string,
  entry: TranscriptEntry
): Promise<void> {
  await appendTranscript(stepId, entry);
  await publishEvent({
    type: 'step_message',
    runId,
    stepId,
    entry,
    at: entry.at,
  });
}

function describeToolDefs(toolkit: ToolDescriptor[]): Tool[] {
  return toolkit.map((t) => ({
    name: t.toolDefinition.name,
    description: t.toolDefinition.description,
    input_schema: t.toolDefinition.input_schema as Tool['input_schema'],
  }));
}

export async function runSubAgent(args: SubAgentArgs): Promise<SubAgentResult> {
  const toolDescriptors: ToolDescriptor[] = args.toolkit
    .map((id) => getTool(id))
    .filter((t): t is ToolDescriptor => Boolean(t));

  const systemPrompt = buildSubAgentSystem({
    goal: args.goal,
    toolkit: toolDescriptors,
    upstreamOutputs: args.upstreamOutputs,
  });

  await emit(args.runId, args.stepId, {
    kind: 'goal',
    text: args.goal,
    at: nowIso(),
  });

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: 'Begin. Use tools as needed, then summarize the result in your final reply.',
    },
  ];

  const ctx: ToolContext = {
    userId: args.userId,
    runId: args.runId,
    stepId: args.stepId,
    stepData: args.upstreamOutputs,
    getOAuth: args.getOAuth,
    spawn: args.spawn,
  };

  const max = args.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  let finalText = '';

  for (let iteration = 0; iteration < max; iteration++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDescriptors.length > 0 ? describeToolDefs(toolDescriptors) : undefined,
      messages,
    });

    const textChunks: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        textChunks.push(block.text);
      }
    }
    if (textChunks.length > 0) {
      const text = textChunks.join('\n').trim();
      await emit(args.runId, args.stepId, {
        kind: 'thought',
        text,
        at: nowIso(),
      });
    }

    if (response.stop_reason !== 'tool_use') {
      finalText = textChunks.join('\n').trim();
      messages.push({ role: 'assistant', content: response.content });
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const tool = toolDescriptors.find(
        (t) => t.toolDefinition.name === block.name
      );

      await emit(args.runId, args.stepId, {
        kind: 'tool_call',
        tool: block.name,
        input: block.input,
        at: nowIso(),
        id: block.id,
      });

      if (!tool) {
        const errMsg = `Unknown tool: ${block.name}`;
        await emit(args.runId, args.stepId, {
          kind: 'tool_result',
          tool: block.name,
          output: errMsg,
          isError: true,
          at: nowIso(),
          id: block.id,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: errMsg,
          is_error: true,
        });
        continue;
      }

      try {
        const output = await tool.execute(
          (block.input ?? {}) as Record<string, unknown>,
          ctx
        );
        await emit(args.runId, args.stepId, {
          kind: 'tool_result',
          tool: block.name,
          output,
          isError: false,
          at: nowIso(),
          id: block.id,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(output),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await emit(args.runId, args.stepId, {
          kind: 'tool_result',
          tool: block.name,
          output: msg,
          isError: true,
          at: nowIso(),
          id: block.id,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: msg,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    finalText = '(sub-agent reached the iteration cap without a final reply)';
  }

  await emit(args.runId, args.stepId, {
    kind: 'final',
    text: finalText,
    at: nowIso(),
  });

  const output = { result: finalText };
  await updateRunStep(args.stepId, {
    status: 'success',
    output,
    completedAt: new Date(),
  });

  return { output, finalText };
}
