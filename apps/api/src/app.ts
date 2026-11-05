import { Hono } from 'hono';
import type { Deps } from '@noor/core';
import type { AppEnv } from './app-env';
import { installErrorHandling } from './errors';
import { communitiesRoutes } from './routes/communities';
import { healthRoutes } from './routes/health';
import { invitesRoutes } from './routes/invites';
import { meRoutes } from './routes/me';
import { membersRoutes } from './routes/members';
import { seasonsRoutes } from './routes/seasons';

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
export function createApp(root: AppRootInput): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  installErrorHandling(app);
  app.use('*', async (c, next) => {
    c.set('deps', root.deps);
    await next();
  });
  app.route('/', healthRoutes(root.version));
  app.route('/', meRoutes());
  app.route('/', communitiesRoutes());
  app.route('/', invitesRoutes());
  app.route('/', membersRoutes());
  app.route('/', seasonsRoutes());
  return app;
}
