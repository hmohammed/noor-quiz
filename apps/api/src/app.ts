import { Hono } from 'hono';
import { healthRoutes } from './routes/health';

export interface AppOptions {
  /** Build version reported by `GET /v1/health`. */
  version: string;
}

/**
 * Builds the HTTP app. Knows nothing about Firebase and has no top-level side
 * effects, so tests drive it with `app.request()` and any Node host can serve it.
 */
export function createApp(opts: AppOptions): Hono {
  const app = new Hono();
  app.route('/', healthRoutes(opts.version));
  return app;
}
