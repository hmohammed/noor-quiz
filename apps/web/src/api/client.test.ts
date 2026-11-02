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

const ULID = '01J9Z8X7W6V5T4S3R2Q1P0NMKH';
const me = (overrides: Record<string, unknown> = {}) => ({
  userId: ULID,
  displayName: null,
  locale: null,
  timezone: null,
  ...overrides,
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

  it('sends no Authorization header and no body', async () => {
    const fetch = fakeFetch(json({ status: 'ok', version: '1' }));
    await createApiClient({ fetch }).getHealth();
    const init = fetch.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('content-type')).toBe(false);
    expect(headers.get('accept')).toBe('application/json');
    expect(init?.body).toBeUndefined();
  });
});

describe('apiClient.getMe', () => {
  it('calls GET {baseUrl}/v1/me with the bearer token and returns the parsed body', async () => {
    const fetch = fakeFetch(json(me({ displayName: 'Amina' })));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.getMe({ idToken: 'tok.en.value' })).resolves.toEqual(
      me({ displayName: 'Amina' }),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/me');
    expect(init?.method ?? 'GET').toBe('GET');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(headers.get('accept')).toBe('application/json');
  });

  it('returns displayName: null as is', async () => {
    const client = createApiClient({ fetch: fakeFetch(json(me())) });
    await expect(client.getMe({ idToken: 't' })).resolves.toEqual(me());
  });

  it('passes the abort signal through', async () => {
    const fetch = fakeFetch(json(me()));
    const controller = new AbortController();
    await createApiClient({ fetch }).getMe({ idToken: 't', signal: controller.signal });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('throws ApiError with status 401 on a 401 response', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'UNAUTHENTICATED' } }, 401)),
    });
    const err = await client.getMe({ idToken: 't' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  it('throws ApiError when the body has an extra key (strict contract)', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json(me({ displayName: 'Amina', uid: 'firebase-uid' }))),
    });
    await expect(client.getMe({ idToken: 't' })).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when fetch itself rejects', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('network down');
    });
    await expect(createApiClient({ fetch }).getMe({ idToken: 't' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('apiClient.updateMe', () => {
  it('sends PATCH /v1/me with the bearer token and a JSON body and returns the parsed body', async () => {
    const fetch = fakeFetch(json(me({ displayName: 'ሀሰን', timezone: 'Africa/Addis_Ababa' })));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(
      client.updateMe({
        idToken: 'tok.en.value',
        body: { displayName: 'ሀሰን', timezone: 'Africa/Addis_Ababa' },
      }),
    ).resolves.toEqual(me({ displayName: 'ሀሰን', timezone: 'Africa/Addis_Ababa' }));

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/me');
    expect(init?.method).toBe('PATCH');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      displayName: 'ሀሰን',
      timezone: 'Africa/Addis_Ababa',
    });
  });

  it('throws ApiError with status 400 on a 400 response', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'VALIDATION', message: 'Invalid request' } }, 400)),
    });
    const err = await client
      .updateMe({ idToken: 't', body: { displayName: '😀😀' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });

  it('throws ApiError when the body breaks the contract', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json(me({ locale: 'fr' }))),
    });
    await expect(client.updateMe({ idToken: 't', body: { locale: 'en' } })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
