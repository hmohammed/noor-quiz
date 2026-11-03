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
  consent: { currentVersion: '2026-11-01', acceptedVersion: null, required: true },
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

  it('throws ApiError when the body has no consent block (strict contract)', async () => {
    const withoutConsent: Record<string, unknown> = me();
    delete withoutConsent.consent;
    const client = createApiClient({ fetch: fakeFetch(json(withoutConsent)) });
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

describe('apiClient.acceptConsent', () => {
  const accepted = () =>
    me({
      consent: { currentVersion: '2026-11-01', acceptedVersion: '2026-11-01', required: false },
    });

  it('sends POST /v1/me/consent with the bearer token and { version } and returns the parsed body', async () => {
    const fetch = fakeFetch(json(accepted()));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(
      client.acceptConsent({ idToken: 'tok.en.value', body: { version: '2026-11-01' } }),
    ).resolves.toEqual(accepted());

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/me/consent');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ version: '2026-11-01' });
  });

  it.each([409, 401])('throws ApiError with status %i on a %i response', async (status) => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'X' } }, status)),
    });
    const err = await client
      .acceptConsent({ idToken: 't', body: { version: '2026-11-01' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(status);
  });

  it('throws ApiError when a 200 body leaks acceptedAt inside consent', async () => {
    const leaked = me({
      consent: {
        currentVersion: '2026-11-01',
        acceptedVersion: '2026-11-01',
        required: false,
        acceptedAt: '2026-11-03T09:00:00.000Z',
      },
    });
    const client = createApiClient({ fetch: fakeFetch(json(leaked)) });
    await expect(
      client.acceptConsent({ idToken: 't', body: { version: '2026-11-01' } }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiClient.deleteMe', () => {
  it('sends DELETE with the bearer token, no body and no content-type, and resolves on 204', async () => {
    const fetch = fakeFetch(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.deleteMe({ idToken: 'tok.en.value' })).resolves.toBeUndefined();

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/me');
    expect(init?.method).toBe('DELETE');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.has('content-type')).toBe(false);
    expect(init?.body).toBeUndefined();
  });

  it.each([401, 500])('throws ApiError with status %s', async (status) => {
    const client = createApiClient({ fetch: fakeFetch(new Response(null, { status })) });
    const err = await client.deleteMe({ idToken: 't' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(status);
  });

  it('throws ApiError when fetch itself rejects', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('network down');
    });
    await expect(createApiClient({ fetch }).deleteMe({ idToken: 't' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('passes the abort signal through', async () => {
    const fetch = fakeFetch(new Response(null, { status: 204 }));
    const controller = new AbortController();
    await createApiClient({ fetch }).deleteMe({ idToken: 't', signal: controller.signal });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

const community = (overrides: Record<string, unknown> = {}) => ({
  tenantId: ULID,
  name: 'Masjid Al-Noor',
  slug: 'masjid-al-noor',
  timezone: 'Europe/Stockholm',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('apiClient.createCommunity', () => {
  it('sends POST /v1/communities with the bearer token and returns the parsed body', async () => {
    const fetch = fakeFetch(json(community()));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(
      client.createCommunity({
        idToken: 'tok.en.value',
        body: { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm' },
      }),
    ).resolves.toEqual(community());

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/communities');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Masjid Al-Noor',
      timezone: 'Europe/Stockholm',
    });
  });

  it('throws ApiError when the body breaks the contract', async () => {
    const client = createApiClient({ fetch: fakeFetch(json(community({ createdBy: ULID }))) });
    await expect(
      client.createCommunity({ idToken: 't', body: { name: 'Masjid Al-Noor', timezone: 'UTC' } }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError with status 400 on a 400 response', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'VALIDATION', message: 'Invalid request' } }, 400)),
    });
    const err = await client
      .createCommunity({ idToken: 't', body: { name: 'A', timezone: 'UTC' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });
});

describe('apiClient.listMyCommunities', () => {
  it('sends GET /v1/me/communities with the bearer token and returns the parsed body', async () => {
    const fetch = fakeFetch(json({ communities: [community()] }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.listMyCommunities({ idToken: 'tok.en.value' })).resolves.toEqual({
      communities: [community()],
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/me/communities');
    expect(init?.method ?? 'GET').toBe('GET');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(init?.body).toBeUndefined();
  });

  it('throws ApiError when a community leaks createdBy', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ communities: [community({ createdBy: ULID })] })),
    });
    await expect(client.listMyCommunities({ idToken: 't' })).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError with status 401 on a 401 response', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'UNAUTHENTICATED' } }, 401)),
    });
    const err = await client.listMyCommunities({ idToken: 't' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });
});

describe('apiClient.createInvite', () => {
  const created = {
    token: ULID,
    expiresAt: '2026-01-08T00:00:00.000Z',
    maxUses: 25,
  };

  it('sends POST /v1/t/:tenantId/invites with the bearer token and {}', async () => {
    const fetch = fakeFetch(json(created, 201));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(
      client.createInvite({ idToken: 'tok.en.value', tenantId: ULID, body: {} }),
    ).resolves.toEqual(created);

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`http://api.test/v1/t/${ULID}/invites`);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(JSON.parse(String(init?.body))).toEqual({});
  });

  it('throws ApiError when the body leaks createdBy', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ ...created, createdBy: ULID }, 201)),
    });
    await expect(
      client.createInvite({ idToken: 't', tenantId: ULID, body: {} }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiClient.previewInvite', () => {
  it('sends GET with no Authorization header', async () => {
    const fetch = fakeFetch(json({ name: 'Masjid Al-Noor' }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.previewInvite({ token: ULID })).resolves.toEqual({
      name: 'Masjid Al-Noor',
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`http://api.test/v1/invites/${ULID}`);
    expect(init?.method ?? 'GET').toBe('GET');
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(init?.body).toBeUndefined();
  });

  it('throws ApiError with status 410 on a 410 response', async () => {
    const client = createApiClient({
      fetch: fakeFetch(json({ error: { code: 'GONE', message: 'Gone' } }, 410)),
    });
    const err = await client.previewInvite({ token: ULID }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(410);
  });
});

describe('apiClient.acceptInvite', () => {
  it('sends POST accept with an empty body and the bearer token', async () => {
    const fetch = fakeFetch(json(community(), 201));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    await expect(client.acceptInvite({ idToken: 'tok.en.value', token: ULID })).resolves.toEqual(
      community(),
    );

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`http://api.test/v1/invites/${ULID}/accept`);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok.en.value');
    expect(JSON.parse(String(init?.body))).toEqual({});
  });
});

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const seasonView = {
  id: ULID,
  tenantId: TENANT,
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2035-01-01',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '08:00',
  closesAtLocal: '21:00',
  state: { phase: 'upcoming' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('apiClient seasons', () => {
  it('lists seasons with the bearer token', async () => {
    const fetch = fakeFetch(json({ seasons: [seasonView] }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    await expect(client.listSeasons({ idToken: 'tok', tenantId: TENANT })).resolves.toEqual({
      seasons: [seasonView],
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(`http://api.test/v1/t/${TENANT}/seasons`);
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer tok');
  });

  it('creates a season with the submitted body', async () => {
    const fetch = fakeFetch(json(seasonView, 201));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    const body = {
      name: 'Ramadan 1448',
      kind: 'ramadan' as const,
      startDate: '2035-01-01',
      lengthDays: 30,
      timezone: 'Europe/Stockholm',
      opensAtLocal: '08:00',
      closesAtLocal: '21:00',
    };
    await expect(client.createSeason({ idToken: 'tok', tenantId: TENANT, body })).resolves.toEqual(
      seasonView,
    );
    expect(fetch.mock.calls[0]?.[0]).toBe(`http://api.test/v1/t/${TENANT}/seasons`);
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual(body);
  });

  it('asks for a Ramadan suggestion and does not send a body', async () => {
    const suggestion = {
      hijriYear: 1448,
      startDate: '2027-02-08',
      lengthDays: 30,
      advisory: true,
    };
    const fetch = fakeFetch(json(suggestion));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    await expect(
      client.suggestRamadanStart({
        idToken: 'tok',
        tenantId: TENANT,
        timezone: 'Europe/Stockholm',
      }),
    ).resolves.toEqual(suggestion);
    const url = String(fetch.mock.calls[0]?.[0]);
    expect(url).toContain(`/v1/t/${TENANT}/seasons/ramadan-suggestion?`);
    expect(url).toContain('timezone=Europe%2FStockholm');
    expect(fetch.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('rejects a suggestion that is not marked advisory', async () => {
    const client = createApiClient({
      fetch: fakeFetch(
        json({ hijriYear: 1448, startDate: '2027-02-08', lengthDays: 30, advisory: false }),
      ),
    });
    await expect(
      client.suggestRamadanStart({ idToken: 't', tenantId: TENANT, timezone: 'UTC' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
