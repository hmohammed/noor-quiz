import { DomainError } from '../errors';
import type { TimeZone } from '../time/zoned';
import { asUserId, ULID_PATTERN, type UserId } from '../users/user';
import type { Role } from './role';
import { isBaseSlug } from './slug';

/** Our own tenant id: a ULID (AGENT.md rule 8). Never a slug and never a client value. */
export type TenantId = string & { readonly __brand: 'TenantId' };

export const COMMUNITY_SCHEMA_VERSION = 1 as const;
export const MEMBERSHIP_SCHEMA_VERSION = 1 as const;
export const COMMUNITY_SLUG_SCHEMA_VERSION = 1 as const;

/** Brands a ULID string as a TenantId, or throws `VALIDATION`. */
export function asTenantId(s: string): TenantId {
  if (typeof s !== 'string' || !ULID_PATTERN.test(s)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-tenant-id' });
  }
  return s as TenantId;
}

/**
 * `memberships/{userId}_{tenantId}`. Both parts are ULIDs, so the id contains one
 * underscore and is safe as a document id.
 */
export function membershipId(userId: UserId, tenantId: TenantId): string {
  return `${asUserId(userId)}_${asTenantId(tenantId)}`;
}

/** `communities/{tenantId}`. The document id is the tenant id. */
export interface Community {
  id: TenantId;
  tenantId: TenantId;
  name: string;
  slug: string;
  timezone: TimeZone;
  createdBy: UserId;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. */
  updatedAt: string;
  schemaVersion: typeof COMMUNITY_SCHEMA_VERSION;
}

/** What `createWithOwner` receives: the community before a slug is chosen. */
export type NewCommunity = Omit<Community, 'slug'>;

/** `memberships/{userId}_{tenantId}`. */
export interface Membership {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  role: Role;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. */
  updatedAt: string;
  schemaVersion: typeof MEMBERSHIP_SCHEMA_VERSION;
}

/**
 * `communitySlugs/{slug}` — a uniqueness lock, not a product collection. Written in
 * the same transaction as the community and the owner membership.
 */
export interface CommunitySlug {
  id: string;
  slug: string;
  tenantId: TenantId;
  /** UTC ISO string from the Clock. Equal to `updatedAt` on create. */
  createdAt: string;
  /** UTC ISO string from the Clock. Equal to `createdAt` on create. */
  updatedAt: string;
  schemaVersion: typeof COMMUNITY_SLUG_SCHEMA_VERSION;
}

/** Arguments of `CommunityRepo.createWithOwner`. The slug is not part of `community`. */
export interface CreateWithOwnerInput {
  community: NewCommunity;
  baseSlug: string;
  membership: Membership;
}

/**
 * Rejects a create that does not describe one new owner of one new tenant. Throws
 * `VALIDATION` and must be called before any write.
 */
export function validateCreateWithOwner(input: CreateWithOwnerInput): void {
  const tenantId = asTenantId(input.community.tenantId);
  const createdBy = asUserId(input.community.createdBy);
  const memberUser = asUserId(input.membership.userId);
  const memberTenant = asTenantId(input.membership.tenantId);
  if (
    asTenantId(input.community.id) !== tenantId ||
    memberTenant !== tenantId ||
    memberUser !== createdBy
  ) {
    throw new DomainError('VALIDATION', { reason: 'community-mismatch' });
  }
  if (input.membership.role !== 'owner') {
    throw new DomainError('VALIDATION', { reason: 'role-not-owner' });
  }
  if (input.membership.id !== membershipId(createdBy, tenantId)) {
    throw new DomainError('VALIDATION', { reason: 'community-mismatch' });
  }
  if (
    input.community.schemaVersion !== COMMUNITY_SCHEMA_VERSION ||
    input.membership.schemaVersion !== MEMBERSHIP_SCHEMA_VERSION
  ) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
  if (!isBaseSlug(input.baseSlug)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-slug' });
  }
}
