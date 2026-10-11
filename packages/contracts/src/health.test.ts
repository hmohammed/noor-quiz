import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts { status: "ok", version: "0.1.0" }', () => {
    expect(HealthResponse.parse({ status: 'ok', version: '0.1.0' })).toEqual({
      status: 'ok',
      version: '0.1.0',
    });
  });

  it.each([
    ['status "down"', { status: 'down', version: '0.1.0' }],
    ['a missing version', { status: 'ok' }],
    ['an empty version', { status: 'ok', version: '' }],
    ['an extra key', { status: 'ok', version: '1', env: 'x' }],
  ])('rejects %s', (_label, body) => {
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
