import Anthropic from '@anthropic-ai/sdk';
import type { ToolDescriptor } from '@/types/tools';

const client = new Anthropic();

export const SummarizeTool: ToolDescriptor = {
  id: 'summarize',
  name: 'Summarize',
  description:
    'Summarize, extract, or otherwise transform a chunk of text using Claude. No external API required.',
  icon: 'AlignLeft',
  requiresOAuth: false,
  toolDefinition: {
    name: 'summarize',
    description:
      'Run a Claude Haiku-style transformation over a body of text. Use this for summarization, extraction, classification, or rewriting. Returns the transformed text in `result`.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The input text to operate on.',
        },
        instruction: {
          type: 'string',
          description:
            'What to do with the text. Examples: "summarize in 2 sentences", "extract a JSON list of dates", "rewrite in plain English". Defaults to a generic 3-bullet summary.',
        },
        max_tokens: {
          type: 'number',
          description: 'Maximum response tokens. Defaults to 1024.',
        },
      },
      required: ['text'],
    },
  },
  async execute(input) {
    const text = String(input.text || '');
    if (!text) throw new Error('summarize requires `text`');
    const instruction =
      String(input.instruction || '') ||
      'Summarize the text in three concise bullet points.';
    const maxTokens = Math.max(64, Math.min(4096, Number(input.max_tokens ?? 1024)));

    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: 'You transform text exactly as instructed. Reply with the transformed text only — no preamble, no apologies, no markdown fences.',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Instruction:\n${instruction}\n\n---\nText:\n${text}`,
        },
      ],
    });

    const textBlock = res.content.find((b) => b.type === 'text');
    const result = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    return { result, length: result.length };
  },
};
