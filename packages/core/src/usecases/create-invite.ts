import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { InviteRepo, MembershipRepo } from '../ports/repos';
import { addDuration, toIso } from '../time/instant';
import { asUserId } from '../users/user';
import { asTenantId } from '../communities/community';
import {
  asInviteToken,
  INVITE_DEFAULT_EXPIRES_IN_DAYS,
  INVITE_DEFAULT_MAX_USES,
  INVITE_MAX_EXPIRES_IN_DAYS,
  INVITE_MAX_MAX_USES,
  INVITE_MIN_EXPIRES_IN_DAYS,
  INVITE_MIN_MAX_USES,
  INVITE_SCHEMA_VERSION,
  type Invite,
} from '../communities/invite';
import { roleAtLeast } from '../communities/role';
import { DomainError } from '../errors';

const ALLOWED_KEYS = new Set(['tenantId', 'userId', 'expiresInDays', 'maxUses']);

function limitOrDefault(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  reason: string,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new DomainError('VALIDATION', { reason });
  }
  return value;
}

/**
 * Creates an invite for a community the caller administers. `tenantId`, `createdBy`,
 * `uses` and `expiresAt` come from the membership, the id generator and the Clock,
 * never from a client field. `expiresInDays` defaults to 7 (1–30) and `maxUses` to
 * 25 (1–100). One clock read.
 */
export async function createInvite(
  deps: { clock: Clock; ids: IdGenerator; memberships: MembershipRepo; invites: InviteRepo },
  input: {
    tenantId: string;
    userId: string;
    expiresInDays?: number;
    maxUses?: number;
  },
): Promise<Invite> {
  if (typeof input !== 'object' || input === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-input' });
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new DomainError('VALIDATION', { reason: 'forbidden-field' });
  }
  const tenantId = asTenantId(input.tenantId);
  const userId = asUserId(input.userId);
  const expiresInDays = limitOrDefault(
    input.expiresInDays,
    INVITE_DEFAULT_EXPIRES_IN_DAYS,
    INVITE_MIN_EXPIRES_IN_DAYS,
    INVITE_MAX_EXPIRES_IN_DAYS,
    'invalid-expires-in-days',
  );
  const maxUses = limitOrDefault(
    input.maxUses,
    INVITE_DEFAULT_MAX_USES,
    INVITE_MIN_MAX_USES,
    INVITE_MAX_MAX_USES,
    'invalid-max-uses',
  );

  const membership = await deps.memberships.get(tenantId, userId);
  if (!membership || !roleAtLeast(membership.role, 'admin')) {
    throw new DomainError('FORBIDDEN', { reason: 'not-an-admin' });
  }

  const now = deps.clock.now();
  const at = toIso(now);
  const token = asInviteToken(deps.ids.newId());
  return deps.invites.create(tenantId, {
    id: token,
    tenantId,
    createdBy: userId,
    expiresAt: toIso(addDuration(now, { days: expiresInDays })),
    maxUses,
    uses: 0,
    createdAt: at,
    updatedAt: at,
    schemaVersion: INVITE_SCHEMA_VERSION,
  });
}
