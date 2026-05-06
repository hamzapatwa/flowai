import type { ToolDescriptor } from '@/types/tools';

const GITHUB_API = 'https://api.github.com';

async function ghFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
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
    throw new Error(`GitHub API ${res.status}: ${msg}`);
  }
  return body;
}

export const GitHubTool: ToolDescriptor = {
  id: 'github',
  name: 'GitHub',
  description:
    'Read repos and issues, create issues, and search code on GitHub via the REST API.',
  icon: 'Github',
  requiresOAuth: true,
  oauthProvider: 'github',
  toolDefinition: {
    name: 'github',
    description:
      'Interact with GitHub: list/create issues, fetch a repo summary, or search code. Requires the user to have connected GitHub via OAuth.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_issues', 'create_issue', 'get_repo', 'search_code'],
        },
        owner: {
          type: 'string',
          description: 'Repo owner / org (required for repo-scoped actions).',
        },
        repo: {
          type: 'string',
          description: 'Repo name (required for repo-scoped actions).',
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'Issue state filter for list_issues. Defaults to "open".',
        },
        per_page: {
          type: 'number',
          description: 'Page size for list operations. Defaults to 20.',
        },
        title: { type: 'string', description: 'Issue title (create_issue).' },
        body: { type: 'string', description: 'Issue body (create_issue).' },
        labels: {
          type: 'array',
          description: 'Optional issue labels (create_issue).',
          items: { type: 'string' },
        },
        query: {
          type: 'string',
          description:
            'GitHub code search query, e.g. "useState extension:tsx repo:vercel/next.js" (search_code).',
        },
      },
      required: ['action'],
    },
  },
  async execute(input, ctx) {
    const tok = await ctx.getOAuth('github');
    if (!tok) {
      throw new Error('GitHub is not connected. Connect it in Integrations.');
    }
    const action = String(input.action || '');

    if (action === 'list_issues') {
      const owner = String(input.owner || '');
      const repo = String(input.repo || '');
      if (!owner || !repo) {
        throw new Error('github.list_issues requires `owner` and `repo`');
      }
      const state = String(input.state || 'open');
      const perPage = Number(input.per_page || 20);
      const issues = (await ghFetch(
        tok.accessToken,
        `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`
      )) as Array<Record<string, unknown>>;
      return {
        count: issues.length,
        issues: issues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          user: (i.user as { login?: string } | null)?.login,
          url: i.html_url,
          labels: (i.labels as Array<{ name?: string }> | undefined)?.map(
            (l) => l.name
          ),
        })),
      };
    }

    if (action === 'create_issue') {
      const owner = String(input.owner || '');
      const repo = String(input.repo || '');
      const title = String(input.title || '');
      if (!owner || !repo || !title) {
        throw new Error(
          'github.create_issue requires `owner`, `repo`, and `title`'
        );
      }
      const body = await ghFetch(
        tok.accessToken,
        `/repos/${owner}/${repo}/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body: input.body ?? undefined,
            labels: Array.isArray(input.labels) ? input.labels : undefined,
          }),
        }
      );
      const issue = body as Record<string, unknown>;
      return {
        number: issue.number,
        url: issue.html_url,
        title: issue.title,
      };
    }

    if (action === 'get_repo') {
      const owner = String(input.owner || '');
      const repo = String(input.repo || '');
      if (!owner || !repo) {
        throw new Error('github.get_repo requires `owner` and `repo`');
      }
      const data = (await ghFetch(
        tok.accessToken,
        `/repos/${owner}/${repo}`
      )) as Record<string, unknown>;
      return {
        full_name: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        default_branch: data.default_branch,
        url: data.html_url,
        topics: data.topics,
      };
    }

    if (action === 'search_code') {
      const q = String(input.query || '');
      if (!q) throw new Error('github.search_code requires `query`');
      const perPage = Number(input.per_page || 20);
      const data = (await ghFetch(
        tok.accessToken,
        `/search/code?q=${encodeURIComponent(q)}&per_page=${perPage}`
      )) as { items?: Array<Record<string, unknown>>; total_count?: number };
      return {
        total: data.total_count ?? 0,
        items: (data.items ?? []).map((i) => ({
          path: i.path,
          repo: (i.repository as { full_name?: string } | null)?.full_name,
          url: i.html_url,
        })),
      };
    }

    throw new Error(`Unknown github action: ${action}`);
  },
};
