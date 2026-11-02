import { Hono } from 'hono';
import { MeResponse } from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { requireUser } from '../middleware/require-user';

/** The signed-in user's own profile. Built from two named fields, never by spreading a user. */
export function meRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/v1/me', requireUser(), (c) =>
    c.json(MeResponse.parse({ userId: c.var.user.id, displayName: c.var.user.displayName }), 200),
  );
}
