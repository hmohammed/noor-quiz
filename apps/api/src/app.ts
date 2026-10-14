import { Hono } from 'hono';
import type { Deps } from '@noor/core';
import { installErrorHandling } from './errors';
import { healthRoutes } from './routes/health';

/** What the HTTP app is built from: ports for use cases and the build version. */
export interface AppRootInput {
  deps: Deps;
  /** Build version reported by `GET /v1/health`. */
  version: string;
}

/**
 * Builds the HTTP app. Knows nothing about Firebase or which adapters are used and
 * has no top-level side effects, so tests drive it with `app.request()` and fakes.
 */
export function createApp(root: AppRootInput): Hono {
  const app = new Hono();
  installErrorHandling(app);
  app.route('/', healthRoutes(root.version));
  return app;
}
