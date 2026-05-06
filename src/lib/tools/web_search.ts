import type { ToolDescriptor } from '@/types/tools';

interface TavilyResponse {
  answer?: string;
  results?: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
  }>;
}

export const WebSearchTool: ToolDescriptor = {
  id: 'web_search',
  name: 'Web Search',
  description:
    'Search the live web via Tavily. Returns ranked results with titles, URLs, and snippets.',
  icon: 'Search',
  requiresOAuth: false,
  toolDefinition: {
    name: 'web_search',
    description:
      'Search the web for up-to-date information. Returns up to `max_results` ranked results with title, URL, and a content snippet, plus an optional one-paragraph synthesized answer.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language search query.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum results to return (1-10). Defaults to 5.',
        },
      },
      required: ['query'],
    },
  },
  async execute(input) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not set');
    }
    const query = String(input.query || '');
    if (!query) throw new Error('web_search requires `query`');
    const maxResults = Math.max(
      1,
      Math.min(10, Number(input.max_results ?? 5))
    );

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tavily search failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as TavilyResponse;
    const results = (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      score: r.score ?? null,
    }));

    return {
      query,
      answer: data.answer ?? null,
      results,
      count: results.length,
    };
  },
};
