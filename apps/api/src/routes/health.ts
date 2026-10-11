import { Hono } from 'hono';
import { HealthResponse } from '@noor/contracts';

/**
 * Public liveness route. No auth, no tenant, no client input, no timestamp:
 * it returns a constant status and the build version only.
 */
export function healthRoutes(version: string): Hono {
  return new Hono().get('/v1/health', (c) =>
    c.json(HealthResponse.parse({ status: 'ok', version }), 200),
  );
}
