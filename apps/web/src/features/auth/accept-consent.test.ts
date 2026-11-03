import type { MeResponse } from '@noor/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../../api/client';
import { ConsentOutdatedError, acceptCurrentConsent } from './accept-consent';

const ULID = '01J9Z8X7W6V5T4S3R2Q1P0NMKH';
const meWith = (consent: MeResponse['consent']): MeResponse => ({
  userId: ULID,
  displayName: 'Amina',
  locale: null,
  timezone: null,
  consent,
});
const pending = meWith({ currentVersion: 'v2', acceptedVersion: null, required: true });
const accepted = meWith({ currentVersion: 'v2', acceptedVersion: 'v2', required: false });
const newerTerms = meWith({ currentVersion: 'v3', acceptedVersion: null, required: true });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type Route = Response | Error;

/** A fetch that answers each method + path from a queue and records what was called. */
function routedFetch(routes: Record<string, Route[]>) {
  return vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const next = routes[key]?.shift();
    if (next === undefined) throw new Error(`unexpected call ${key}`);
    if (next instanceof Error) throw next;
    return next;
  });
}

const calls = (fetch: ReturnType<typeof routedFetch>) =>
  fetch.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}`);

describe('acceptCurrentConsent', () => {
  it("posts the server's current version and returns the new me", async () => {
    const fetch = routedFetch({ 'POST /v1/me/consent': [json(accepted)] });
    const client = createApiClient({ fetch });

    await expect(acceptCurrentConsent(client, { idToken: 't', me: pending })).resolves.toEqual(
      accepted,
    );
    expect(calls(fetch)).toEqual(['POST /v1/me/consent']);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ version: 'v2' });
  });

  it('sends whatever currentVersion the server gave, not a fixed one', async () => {
    const fetch = routedFetch({ 'POST /v1/me/consent': [json(accepted)] });
    await acceptCurrentConsent(createApiClient({ fetch }), { idToken: 't', me: newerTerms });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ version: 'v3' });
  });

  it('on 409 reloads /v1/me once and throws ConsentOutdatedError with the fresh me', async () => {
    const fetch = routedFetch({
      'POST /v1/me/consent': [json({ error: { code: 'CONFLICT' } }, 409)],
      'GET /v1/me': [json(newerTerms)],
    });

    const err = await acceptCurrentConsent(createApiClient({ fetch }), {
      idToken: 't',
      me: pending,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConsentOutdatedError);
    expect((err as ConsentOutdatedError).me).toEqual(newerTerms);
    expect(calls(fetch)).toEqual(['POST /v1/me/consent', 'GET /v1/me']);
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('authorization')).toBe('Bearer t');
  });

  it('on 409 with a failing reload throws the ApiError from the GET', async () => {
    const fetch = routedFetch({
      'POST /v1/me/consent': [json({ error: { code: 'CONFLICT' } }, 409)],
      'GET /v1/me': [json({ error: { code: 'INTERNAL' } }, 503)],
    });

    const err = await acceptCurrentConsent(createApiClient({ fetch }), {
      idToken: 't',
      me: pending,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(ConsentOutdatedError);
    expect((err as ApiError).status).toBe(503);
  });

  it.each([
    ['a 500', json({ error: { code: 'INTERNAL' } }, 500)],
    ['a network failure', new TypeError('network down')],
  ])('rethrows %s unchanged, without a reload', async (_label, failure) => {
    const fetch = routedFetch({ 'POST /v1/me/consent': [failure] });

    const err = await acceptCurrentConsent(createApiClient({ fetch }), {
      idToken: 't',
      me: pending,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(ConsentOutdatedError);
    expect(calls(fetch)).toEqual(['POST /v1/me/consent']);
  });

  it('rethrows a non-ApiError from the client as is', async () => {
    const boom = new Error('boom');
    const client = {
      acceptConsent: vi.fn(async () => {
        throw boom;
      }),
      getMe: vi.fn(),
    };
    await expect(acceptCurrentConsent(client, { idToken: 't', me: pending })).rejects.toBe(boom);
    expect(client.getMe).not.toHaveBeenCalled();
  });
});
