import type { MiddlewareHandler } from 'hono';
import { CURRENT_CONSENT_VERSION, DomainError } from '@noor/core';
import type { AppEnv } from '../app-env';

/**
 * Refuses a user who has not accepted the current privacy terms with `CONSENT_REQUIRED`.
 * Runs after `requireUser()`. Every route from T020 onward uses
 * `requireUser(), requireConsent()`.
 */
export function requireConsent(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const accepted = c.var.user.consentVersion;
    if (accepted !== CURRENT_CONSENT_VERSION) {
      throw new DomainError('CONSENT_REQUIRED', {
        reason: accepted === null ? 'consent-missing' : 'consent-outdated',
      });
    }
    await next();
  };
}
