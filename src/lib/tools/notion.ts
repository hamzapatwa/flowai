import type { ToolDescriptor } from '@/types/tools';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function notionFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep as text */
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: unknown }).message)
        : text;
    throw new Error(`Notion API ${res.status}: ${msg}`);
  }
  return body;
}

function paragraphBlock(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

export const NotionTool: ToolDescriptor = {
  id: 'notion',
  name: 'Notion',
  description:
    'Search the connected Notion workspace, create new pages, or append text to existing pages.',
  icon: 'BookOpen',
  requiresOAuth: true,
  oauthProvider: 'notion',
  toolDefinition: {
    name: 'notion',
    description:
      'Read or write content in the connected Notion workspace. Requires the user to have authorized the Notion integration.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'create_page', 'append_to_page'],
        },
        query: {
          type: 'string',
          description: 'Search query for Notion pages/databases (search only).',
        },
        page_size: {
          type: 'number',
          description: 'Search page size, default 10.',
        },
        parent_page_id: {
          type: 'string',
          description: 'Parent page id under which to create the new page (create_page).',
        },
        title: {
          type: 'string',
          description: 'Title of the new page (create_page).',
        },
        body: {
          type: 'string',
          description:
            'Plain-text body that becomes a single paragraph block (create_page or append_to_page).',
        },
        page_id: {
          type: 'string',
          description: 'Existing page id to append to (append_to_page).',
        },
      },
      required: ['action'],
    },
  },
  async execute(input, ctx) {
    const tok = await ctx.getOAuth('notion');
    if (!tok) {
      throw new Error('Notion is not connected. Connect it in Integrations.');
    }
    const action = String(input.action || '');

    if (action === 'search') {
      const data = (await notionFetch(tok.accessToken, '/search', {
        method: 'POST',
        body: JSON.stringify({
          query: String(input.query || ''),
          page_size: Number(input.page_size || 10),
        }),
      })) as { results?: Array<Record<string, unknown>> };
      const results = (data.results ?? []).map((r) => ({
        id: r.id,
        object: r.object,
        url: r.url,
        title:
          (
            (r.properties as
              | Record<string, { title?: Array<{ plain_text?: string }> }>
              | undefined)?.title?.title?.[0]?.plain_text
          ) ?? null,
      }));
      return { count: results.length, results };
    }

    if (action === 'create_page') {
      const parent = String(input.parent_page_id || '');
      const title = String(input.title || '');
      if (!parent || !title) {
        throw new Error(
          'notion.create_page requires `parent_page_id` and `title`'
        );
      }
      const children = input.body
        ? [paragraphBlock(String(input.body))]
        : undefined;
      const data = (await notionFetch(tok.accessToken, '/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { page_id: parent },
          properties: {
            title: {
              title: [{ type: 'text', text: { content: title } }],
            },
          },
          children,
        }),
      })) as Record<string, unknown>;
      return { id: data.id, url: data.url };
    }

    if (action === 'append_to_page') {
      const pageId = String(input.page_id || '');
      const body = String(input.body || '');
      if (!pageId || !body) {
        throw new Error(
          'notion.append_to_page requires `page_id` and `body`'
        );
      }
      const data = (await notionFetch(
        tok.accessToken,
        `/blocks/${pageId}/children`,
        {
          method: 'PATCH',
          body: JSON.stringify({ children: [paragraphBlock(body)] }),
        }
      )) as Record<string, unknown>;
      return { ok: true, results: data.results };
    }

    throw new Error(`Unknown notion action: ${action}`);
  },
};
