import { describe, expect, it } from 'vitest';
import { HealthResponse } from '@noor/contracts';
import { createApp } from '../app';

describe('GET /v1/health', () => {
  const app = createApp({ version: 'test-1' });

  it('returns 200 with a contract-valid JSON body and no auth or tenant', async () => {
    const res = await app.request('/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = HealthResponse.parse(await res.json());
    expect(body.version).toBe('test-1');
  });

  it('ignores a garbage Authorization header (the route is public)', async () => {
    const res = await app.request('/v1/health', { headers: { Authorization: 'Bearer x' } });

    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: 'ok', version: 'test-1' });
  });

  it('returns 404 for POST /v1/health', async () => {
    const res = await app.request('/v1/health', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unversioned GET /health', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(404);
  });
});
