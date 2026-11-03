import {
  asInviteToken,
  asUserId,
  DomainError,
  instantFromIso,
  INVITE_MAX_MAX_USES,
  INVITE_MIN_MAX_USES,
  INVITE_SCHEMA_VERSION,
  inviteUnusable,
  isDomainError,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  ULID_PATTERN,
  validateNewInvite,
  type Invite,
  type InviteRepo,
  type Membership,
  type TenantId,
  type UserId,
} from '@noor/core';
import type {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { membershipConverter } from './community-repo';

const isoString = z.string().refine((s) => {
  try {
    instantFromIso(s);
    return true;
  } catch {
    return false;
  }
});

const tenantId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as TenantId);
const userId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as UserId);

const InviteDoc = z.strictObject({
  id: z
    .string()
    .regex(ULID_PATTERN)
    .transform((s) => asInviteToken(s)),
  tenantId,
  createdBy: userId,
  expiresAt: isoString,
  maxUses: z.number().int().min(INVITE_MIN_MAX_USES).max(INVITE_MAX_MAX_USES),
  uses: z.number().int().min(0),
  createdAt: isoString,
  updatedAt: isoString,
  schemaVersion: z.literal(INVITE_SCHEMA_VERSION),
});

function inviteData(invite: Invite): Invite {
  return {
    id: invite.id,
    tenantId: invite.tenantId,
    createdBy: invite.createdBy,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    schemaVersion: invite.schemaVersion,
  };
}

const inviteConverter: FirestoreDataConverter<Invite> = {
  toFirestore: (invite) => inviteData(invite as Invite),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = InviteDoc.safeParse(snap.data());
    if (!parsed.success || parsed.data.id !== snap.id) {
      throw new DomainError('INTERNAL', { reason: 'corrupt-invite-doc' });
    }
    return parsed.data;
  },
};

function isAlreadyExists(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('code' in e)) return false;
  const code = (e as { code?: unknown }).code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** Firestore `invites`. Membership rows use the shared membership converter. */
export class FirestoreInviteRepo implements InviteRepo {
  readonly #db: Firestore;
  readonly #invites: CollectionReference<Invite>;
  readonly #memberships: CollectionReference<Membership>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#invites = db.collection('invites').withConverter(inviteConverter);
    this.#memberships = db.collection('memberships').withConverter(membershipConverter);
  }

  async create(tenantId: TenantId, invite: Invite): Promise<Invite> {
    validateNewInvite(tenantId, invite);
    const stored = inviteData(invite);
    const ref = this.#invites.doc(stored.id);
    try {
      await this.#db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new DomainError('CONFLICT', { reason: 'invite-exists' });
        tx.create(ref, stored);
      });
    } catch (e) {
      if (isDomainError(e)) throw e;
      if (isAlreadyExists(e)) throw new DomainError('CONFLICT', { reason: 'invite-exists' });
      throw e;
    }
    return stored;
  }

  async getByToken(token: string): Promise<Invite | null> {
    const id = asInviteToken(token);
    const snap = await this.#invites.doc(id).get();
    return snap.data() ?? null;
  }

  async accept(input: { token: string; userId: string; now: string }): Promise<{
    membership: Membership;
    created: boolean;
  }> {
    const token = asInviteToken(input.token);
    const userId = asUserId(input.userId);
    const now = instantFromIso(input.now);
    const inviteRef = this.#invites.doc(token);

    return this.#db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw new DomainError('NOT_FOUND', { reason: 'invite-missing' });
      const invite = inviteSnap.data();
      if (!invite) throw new DomainError('INTERNAL', { reason: 'corrupt-invite-doc' });

      const membershipRef = this.#memberships.doc(membershipId(userId, invite.tenantId));
      const membershipSnap = await tx.get(membershipRef);
      if (membershipSnap.exists) {
        const membership = membershipSnap.data();
        if (
          !membership ||
          membership.userId !== userId ||
          membership.tenantId !== invite.tenantId
        ) {
          throw new DomainError('INTERNAL', { reason: 'corrupt-membership-doc' });
        }
        return { membership, created: false };
      }
      if (inviteUnusable(invite, now)) {
        throw new DomainError('GONE', { reason: 'invite-unusable' });
      }
      const membership: Membership = {
        id: membershipId(userId, invite.tenantId),
        tenantId: invite.tenantId,
        userId,
        role: 'member',
        createdAt: input.now,
        updatedAt: input.now,
        schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
      };
      const updated = inviteData({ ...invite, uses: invite.uses + 1, updatedAt: input.now });
      tx.create(membershipRef, membership);
      tx.set(inviteRef, updated);
      return { membership, created: true };
    });
  }
}
