import { instantFromIso } from '../time/instant';
import type { User } from './user';

/** The privacy terms version members must accept. A code constant: bump it to re-ask everyone. */
export const CURRENT_CONSENT_VERSION = '2026-11-01';

/** Longest version string a client may send or a doc may hold. */
export const CONSENT_VERSION_MAX = 32;

export interface Consent {
  version: string;
  /** UTC ISO string from the Clock. */
  acceptedAt: string;
}

/** True only when the user accepted exactly the current version. */
export function hasCurrentConsent(user: Pick<User, 'consent'>): boolean {
  return user.consent?.version === CURRENT_CONSENT_VERSION;
}

/** A version of 1–32 chars and a UTC ISO `acceptedAt`. Every UserRepo checks this before writing. */
export function isValidConsent(c: Consent): boolean {
  if (typeof c.version !== 'string' || c.version.length < 1) return false;
  if (c.version.length > CONSENT_VERSION_MAX) return false;
  if (typeof c.acceptedAt !== 'string') return false;
  try {
    instantFromIso(c.acceptedAt);
    return true;
  } catch {
    return false;
  }
}
