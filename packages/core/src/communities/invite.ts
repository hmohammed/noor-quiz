import { DomainError } from '../errors';
import { instantFromIso, type Instant } from '../time/instant';
import { ULID_PATTERN, asUserId, type UserId } from '../users/user';
import { asTenantId, type TenantId } from './community';

export const INVITE_SCHEMA_VERSION = 1 as const;

/** Default and bounds for `expiresInDays`. A day is 86 400 000 ms, not a local calendar day. */
export const INVITE_DEFAULT_EXPIRES_IN_DAYS = 7;
export const INVITE_MIN_EXPIRES_IN_DAYS = 1;
export const INVITE_MAX_EXPIRES_IN_DAYS = 30;

/** Default and bounds for `maxUses`. */
export const INVITE_DEFAULT_MAX_USES = 25;
export const INVITE_MIN_MAX_USES = 1;
export const INVITE_MAX_MAX_USES = 100;

/** The invite document id. A ULID, unguessable, and the same value as `Invite.id`. */
export type InviteToken = string & { readonly __brand: 'InviteToken' };

/** Brands a ULID string as an invite token, or throws `VALIDATION`. */
export function asInviteToken(s: string): InviteToken {
  if (typeof s !== 'string' || !ULID_PATTERN.test(s)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-invite-token' });
  }
  return s as InviteToken;
}

/**
 * `invites/{token}`. `id` equals the token. Timestamps are UTC ISO strings from the
 * Clock. On create, `uses` is 0 and `createdAt` equals `updatedAt`.
 */
export interface Invite {
  id: InviteToken;
  tenantId: TenantId;
  createdBy: UserId;
  /** UTC ISO string. The invite is unusable when this is at or before now. */
  expiresAt: string;
  maxUses: number;
  uses: number;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. */
  updatedAt: string;
  schemaVersion: typeof INVITE_SCHEMA_VERSION;
}

/**
 * True when the link must not admit a new member: `expiresAt <= now` or
 * `uses >= maxUses`. Expired and used-up are the same condition. Callers map that
 * to `GONE` and do not say which. Does not treat a missing invite as unusable.
 */
export function inviteUnusable(invite: Invite, now: Instant): boolean {
  return instantFromIso(invite.expiresAt) <= now || invite.uses >= invite.maxUses;
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Rejects a create that does not describe one new invite for `tenantId`. Throws
 * `VALIDATION` and must be called before any write. `uses` must be 0. `maxUses` must
 * be an integer from {@link INVITE_MIN_MAX_USES} to {@link INVITE_MAX_MAX_USES}.
 */
export function validateNewInvite(tenantId: string, invite: Invite): void {
  const tenant = asTenantId(tenantId);
  if (tenant !== asTenantId(invite.tenantId)) {
    throw new DomainError('VALIDATION', { reason: 'tenant-mismatch' });
  }
  asInviteToken(invite.id);
  asUserId(invite.createdBy);
  if (typeof invite.uses !== 'number' || invite.uses !== 0) {
    throw new DomainError('VALIDATION', { reason: 'invite-uses-not-zero' });
  }
  if (!isIntInRange(invite.maxUses, INVITE_MIN_MAX_USES, INVITE_MAX_MAX_USES)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-max-uses' });
  }
  if (invite.schemaVersion !== INVITE_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
  instantFromIso(invite.expiresAt);
  const createdAt = instantFromIso(invite.createdAt);
  const updatedAt = instantFromIso(invite.updatedAt);
  if (createdAt !== updatedAt || invite.createdAt !== invite.updatedAt) {
    throw new DomainError('VALIDATION', { reason: 'invite-timestamps' });
  }
}
