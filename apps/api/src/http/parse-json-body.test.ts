import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isDomainError } from '@noor/core';
import { parseJsonBody } from './parse-json-body';

const Body = z.strictObject({ name: z.string().min(2) });

function app() {
  const errors: unknown[] = [];
  const hono = new Hono();
  hono.onError((err, c) => {
    errors.push(err);
    return c.json({ code: isDomainError(err) ? err.code : 'OTHER' }, 400);
  });
  hono.post('/', async (c) => c.json(await parseJsonBody(c, Body)));
  const post = (body: string) =>
    hono.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  return { post, errors };
}

describe('parseJsonBody', () => {
  it('returns the parsed body', async () => {
    const { post } = app();
    const res = await post(JSON.stringify({ name: 'Åsa' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Åsa' });
  });

  it.each([
    ['non-JSON', '{nope', 'invalid-json'],
    ['a schema failure', JSON.stringify({ name: 'SECRET-VALUE-x', extra: 1 }), 'invalid-body'],
    ['a JSON array', '[]', 'invalid-body'],
  ])('throws VALIDATION for %s with only a reason in details', async (_l, body, reason) => {
    const { post, errors } = app();
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: 'VALIDATION' });
    const err = errors[0];
    expect(isDomainError(err) && err.details).toEqual({ reason });
    expect(JSON.stringify((err as { details?: unknown }).details)).not.toContain('SECRET');
  });
});
