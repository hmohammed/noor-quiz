import { DomainError } from '../errors';

/** Our own user id: a ULID (AGENT.md rule 8). Never a provider uid. */
export type UserId = string & { readonly __brand: 'UserId' };

/** Uppercase Crockford base32, 26 chars, first char ≤ 7 so it fits 128 bits. */
export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** Allowed provider subjects. Keeps them safe to use inside a Firestore doc id. */
export const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const USER_SCHEMA_VERSION = 1 as const;

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 32;

export type IdentityProvider = 'firebase';

/** An identity whose token the API has already verified (T010b's AuthVerifier returns it). */
export interface VerifiedIdentity {
  provider: IdentityProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface IdentityKey {
  provider: IdentityProvider;
  subject: string;
}

export interface User {
  id: UserId;
  displayName: string | null;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. */
  updatedAt: string;
  schemaVersion: typeof USER_SCHEMA_VERSION;
}

/** Links one provider account to one of our users. */
export interface Identity {
  /** `${provider}_${subject}`, see `identityId`. */
  id: string;
  provider: IdentityProvider;
  subject: string;
  userId: UserId;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
  schemaVersion: typeof USER_SCHEMA_VERSION;
}

export function isUlid(s: unknown): s is UserId {
  return typeof s === 'string' && ULID_PATTERN.test(s);
}

/** Brands a ULID string as a UserId, or throws `VALIDATION`. */
export function asUserId(s: string): UserId {
  if (!isUlid(s)) throw new DomainError('VALIDATION', { reason: 'invalid-user-id' });
  return s;
}

/**
 * The deterministic identity doc id. Validates provider and subject first so a
 * crafted subject can never reach a doc path. `details` never carries the subject.
 */
export function identityId(key: IdentityKey): string {
  if (key.provider !== 'firebase') {
    throw new DomainError('UNAUTHENTICATED', { reason: 'invalid-provider' });
  }
  if (typeof key.subject !== 'string' || !SUBJECT_PATTERN.test(key.subject)) {
    throw new DomainError('UNAUTHENTICATED', { reason: 'invalid-subject' });
  }
  return `${key.provider}_${key.subject}`;
}

/**
 * NFC, strip control characters, trim, keep at most 32 code points, trim again.
 * Returns null when fewer than 2 code points remain.
 */
export function normaliseDisplayName(name: string | null): string | null {
  if (name === null) return null;
  const cleaned = name
    .normalize('NFC')
    .replace(/\p{Cc}/gu, '')
    .trim();
  const cut = Array.from(cleaned).slice(0, DISPLAY_NAME_MAX).join('').trimEnd();
  return Array.from(cut).length < DISPLAY_NAME_MIN ? null : cut;
}
