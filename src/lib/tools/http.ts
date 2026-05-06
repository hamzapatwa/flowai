import type { ToolDescriptor } from '@/types/tools';

async function doRequest(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = String(input.url || '');
  if (!url) throw new Error('http requires `url`');

  const method = String(input.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (input.headers && typeof input.headers === 'object') {
    Object.assign(headers, input.headers as Record<string, string>);
  }

  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE' && input.body !== undefined) {
    body =
      typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* leave as text */
  }

  return {
    status: res.status,
    ok: res.ok,
    body: parsed,
  };
}

export const HttpTool: ToolDescriptor = {
  id: 'http',
  name: 'HTTP Request',
  description: 'Call any HTTP API. Useful for hitting REST endpoints or webhooks.',
  icon: 'Globe',
  requiresOAuth: false,
  toolDefinition: {
    name: 'http',
    description:
      'Make an HTTP request to a URL. Returns the response status, ok flag, and parsed JSON body (falling back to text).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute URL to request.' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method. Defaults to GET.',
        },
        headers: {
          type: 'object',
          description: 'Optional request headers.',
          additionalProperties: { type: 'string' },
        },
        body: {
          description:
            'Optional request body. May be a JSON object/array (will be stringified) or a string. Ignored for GET/DELETE.',
        },
      },
      required: ['url'],
    },
  },
  async execute(input) {
    return doRequest(input);
  },
};
