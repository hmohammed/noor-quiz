import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DOMAIN_ERROR_CODES, DomainError, type DomainErrorCode } from '@noor/core';
import { ErrorResponse } from '@noor/contracts';
import { makeTestDeps } from '@noor/testkit';
import { createApp } from './app';
import { publicMessage, statusForCode, toErrorResponse } from './errors';

/** The real app plus test-only routes. These routes exist only in this file, never in createApp. */
function appWithThrowingRoutes() {
  const app = createApp({ deps: makeTestDeps(), version: 'test-1' });
  app.get('/__test/domain/:code', (c) => {
    throw new DomainError(c.req.param('code') as DomainErrorCode, {
      tenantId: 'tenant-sentinel',
      secret: 'details-secret-sentinel',
    });
  });
  app.get('/__test/crash', () => {
    throw new Error('db password=crash-secret-sentinel');
  });
  return app;
}

describe('API error handling', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('maps every core code (the table is exhaustive)', () => {
    expect(Object.keys(statusForCode).sort()).toEqual([...DOMAIN_ERROR_CODES].sort());
    expect(Object.keys(publicMessage).sort()).toEqual([...DOMAIN_ERROR_CODES].sort());
  });

  it.each(Object.entries(statusForCode) as [DomainErrorCode, number][])(
    'a thrown DomainError(%s) gives status %i and a contract-valid body',
    async (code, status) => {
      const res = await appWithThrowingRoutes().request(`/__test/domain/${code}`);

      expect(res.status).toBe(status);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = ErrorResponse.parse(await res.json());
      expect(body.error).toEqual({ code, message: publicMessage[code] });
    },
  );

  it('never puts DomainError details in the response body', async () => {
    const res = await appWithThrowingRoutes().request('/__test/domain/FORBIDDEN');
    const text = await res.text();

    expect(res.status).toBe(403);
    expect(text).not.toContain('tenant-sentinel');
    expect(text).not.toContain('details-secret-sentinel');
    expect(text).not.toContain('details');
    expect(ErrorResponse.parse(JSON.parse(text))).toEqual({
      error: { code: 'FORBIDDEN', message: 'Not allowed' },
    });
  });

  it('turns an unknown error into a generic 500 without its message or stack', async () => {
    const res = await appWithThrowingRoutes().request('/__test/crash');
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
    expect(text).not.toContain('crash-secret-sentinel');
    expect(text).not.toContain('password');
    expect(text).not.toContain('errors.test');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('gives a contract-valid 404 NOT_FOUND for an unknown path', async () => {
    const res = await appWithThrowingRoutes().request('/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(await res.json())).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  });

  it('does not register the test-only routes in createApp', async () => {
    const res = await createApp({ deps: makeTestDeps(), version: 'test-1' }).request(
      '/__test/crash',
    );
    expect(res.status).toBe(404);
  });
});

describe('toErrorResponse', () => {
  it('treats a DomainError from another module copy by its code', () => {
    const foreign = Object.assign(new Error('x'), { name: 'DomainError', code: 'CONFLICT' });
    expect(toErrorResponse(foreign)).toEqual({
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'Conflict' } },
    });
  });

  it.each([
    ['a string', 'boom'],
    ['null', null],
    ['an unknown code', { name: 'DomainError', code: 'X' }],
  ])('maps %s to INTERNAL', (_label, err) => {
    expect(toErrorResponse(err).status).toBe(500);
    expect(toErrorResponse(err).body.error.code).toBe('INTERNAL');
  });
});
