import type { Integration } from '@/types/integrations';

const sharedConfig = {
  url: {
    type: 'string' as const,
    label: 'URL',
    required: true,
    placeholder: 'https://api.example.com/endpoint',
  },
  headers: {
    type: 'json' as const,
    label: 'Headers (JSON)',
    required: false,
    placeholder: '{"Content-Type": "application/json"}',
  },
};

const bodyConfig = {
  body: {
    type: 'json' as const,
    label: 'Body (JSON)',
    required: false,
    placeholder: '{"key": "value"}',
  },
};

async function doRequest(
  method: string,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = String(config.url || '');
  if (!url) throw new Error('URL is required');

  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.headers) {
    try {
      const parsed =
        typeof config.headers === 'string'
          ? JSON.parse(config.headers)
          : config.headers;
      headers = { ...headers, ...parsed };
    } catch {
      throw new Error('Headers must be valid JSON');
    }
  }

  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE' && config.body) {
    try {
      body =
        typeof config.body === 'string'
          ? config.body
          : JSON.stringify(config.body);
    } catch {
      throw new Error('Body must be valid JSON');
    }
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsedBody: unknown = text;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    /* leave as text */
  }

  return {
    status: res.status,
    ok: res.ok,
    body: parsedBody,
  };
}

export const HttpIntegration: Integration = {
  id: 'http',
  name: 'HTTP Request',
  description: 'Make HTTP requests to any URL',
  icon: 'Globe',
  requiresOAuth: false,
  triggers: [],
  actions: [
    {
      id: 'get',
      name: 'GET Request',
      description: 'Make an HTTP GET request',
      configSchema: sharedConfig,
      outputSchema: { status: 'number', body: 'object' },
    },
    {
      id: 'post',
      name: 'POST Request',
      description: 'Make an HTTP POST request',
      configSchema: { ...sharedConfig, ...bodyConfig },
      outputSchema: { status: 'number', body: 'object' },
    },
    {
      id: 'put',
      name: 'PUT Request',
      description: 'Make an HTTP PUT request',
      configSchema: { ...sharedConfig, ...bodyConfig },
      outputSchema: { status: 'number', body: 'object' },
    },
    {
      id: 'delete',
      name: 'DELETE Request',
      description: 'Make an HTTP DELETE request',
      configSchema: sharedConfig,
      outputSchema: { status: 'number', body: 'object' },
    },
  ],
  async execute(action, config) {
    const method = action.toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      throw new Error(`Unknown HTTP action: ${action}`);
    }
    return doRequest(method, config);
  },
};
