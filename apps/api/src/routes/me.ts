import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { DomainError, updateProfile } from '@noor/core';
import { MeResponse, UpdateMeRequest } from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireUser } from '../middleware/require-user';

const MAX_BODY_BYTES = 4096;

/** The signed-in user's own profile. Built from named fields, never by spreading a user. */
export function meRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/v1/me', requireUser(), (c) => {
      const { id, displayName, locale, timezone } = c.var.user;
      return c.json(MeResponse.parse({ userId: id, displayName, locale, timezone }), 200);
    })
    .patch(
      '/v1/me',
      bodyLimit({
        maxSize: MAX_BODY_BYTES,
        onError: () => {
          throw new DomainError('VALIDATION', { reason: 'body-too-large' });
        },
      }),
      requireUser(),
      async (c) => {
        const patch = await parseJsonBody(c, UpdateMeRequest);
        // The id comes from the verified token only; the strict body cannot carry one.
        const user = await updateProfile(c.var.deps, { userId: c.var.user.id, ...patch });
        return c.json(
          MeResponse.parse({
            userId: user.id,
            displayName: user.displayName,
            locale: user.locale,
            timezone: user.timezone,
          }),
          200,
        );
      },
    );
}
