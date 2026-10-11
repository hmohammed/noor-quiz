import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

function fakeFetch(response: Response) {
  return vi.fn<typeof globalThis.fetch>(async () => response);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('apiClient.getHealth', () => {
  it('calls GET {baseUrl}/v1/health and returns the parsed body', async () => {
    const fetch = fakeFetch(json({ status: 'ok', version: '0.1.0' }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.getHealth()).resolves.toEqual({ status: 'ok', version: '0.1.0' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/health');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('uses a same-origin path when no baseUrl is given', async () => {
    const fetch = fakeFetch(json({ status: 'ok', version: '1' }));
    await createApiClient({ fetch }).getHealth();
    expect(fetch.mock.calls[0]?.[0]).toBe('/v1/health');
  });

  it('throws ApiError with the status on a 500 response', async () => {
    const client = createApiClient({ fetch: fakeFetch(json({ error: 'x' }, 500)) });
    const err = await client.getHealth().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it('throws ApiError when the body is not JSON', async () => {
    const client = createApiClient({
      fetch: fakeFetch(new Response('<html>nope</html>', { status: 200 })),
    });
    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when the body breaks the contract', async () => {
    const client = createApiClient({ fetch: fakeFetch(json({ status: 'ok' })) });
    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when fetch itself rejects', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('network down');
    });
    await expect(createApiClient({ fetch }).getHealth()).rejects.toBeInstanceOf(ApiError);
  });
});
