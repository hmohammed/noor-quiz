import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  acceptConsent,
  CURRENT_CONSENT_VERSION,
  deleteAccount,
  DomainError,
  updateProfile,
  type User,
} from '@noor/core';
import { AcceptConsentRequest, MeResponse, UpdateMeRequest } from '@noor/contracts';
import type { AppEnv, RequestUser } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireConsent } from '../middleware/require-consent';
import { requireIdentity, requireUser } from '../middleware/require-user';

const MAX_BODY_BYTES = 4096;

/** Rejects an oversized body with `VALIDATION` before the token is verified. */
function limitBody() {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new DomainError('VALIDATION', { reason: 'body-too-large' });
    },
  });
}

/** Built from named fields, never by spreading a user, so `acceptedAt` and provider data stay server-side. */
function meBody({ id, displayName, locale, timezone, consentVersion }: RequestUser): MeResponse {
  return MeResponse.parse({
    userId: id,
    displayName,
    locale,
    timezone,
    consent: {
      currentVersion: CURRENT_CONSENT_VERSION,
      acceptedVersion: consentVersion,
      required: consentVersion !== CURRENT_CONSENT_VERSION,
    },
  });
}

function requestUserOf(user: User): RequestUser {
  return {
    id: user.id,
    displayName: user.displayName,
    locale: user.locale,
    timezone: user.timezone,
    consentVersion: user.consent?.version ?? null,
  };
}

/** The signed-in user's own profile and consent. */
export function meRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/v1/me', requireUser(), (c) => c.json(meBody(c.var.user), 200))
    .patch('/v1/me', limitBody(), requireUser(), requireConsent(), async (c) => {
      const patch = await parseJsonBody(c, UpdateMeRequest);
      // The id comes from the verified token only; the strict body cannot carry one.
      const user = await updateProfile(c.var.deps, { userId: c.var.user.id, ...patch });
      return c.json(meBody(requestUserOf(user)), 200);
    })
    .post('/v1/me/consent', limitBody(), requireUser(), async (c) => {
      const { version } = await parseJsonBody(c, AcceptConsentRequest);
      const user = await acceptConsent(c.var.deps, { userId: c.var.user.id, version });
      return c.json(meBody(requestUserOf(user)), 200);
    })
    .delete('/v1/me', requireIdentity(), async (c) => {
      await deleteAccount(c.var.deps, { identity: c.var.identity });
      return c.body(null, 204);
    });
}
