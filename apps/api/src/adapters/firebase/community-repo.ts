import {
  asTenantId,
  asUserId,
  chooseSlug,
  COMMUNITY_SCHEMA_VERSION,
  COMMUNITY_SLUG_SCHEMA_VERSION,
  DomainError,
  instantFromIso,
  isDomainError,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  ROLES,
  slugCandidates,
  ULID_PATTERN,
  validateCreateWithOwner,
  type Community,
  type CommunityRepo,
  type CommunitySlug,
  type CreateWithOwnerInput,
  type Membership,
  type MembershipRepo,
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

const DELETE_BATCH = 400;

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
const slugText = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);

const CommunityDoc = z
  .strictObject({
    id: tenantId,
    tenantId,
    name: z.string().min(1),
    slug: slugText,
    timezone: z.string().min(1).max(64),
    createdBy: userId,
    createdAt: isoString,
    updatedAt: isoString,
    schemaVersion: z.literal(COMMUNITY_SCHEMA_VERSION),
  })
  .refine((doc) => doc.id === doc.tenantId);

const MembershipDoc = z
  .strictObject({
    id: z.string(),
    tenantId,
    userId,
    role: z.enum(ROLES),
    createdAt: isoString,
    updatedAt: isoString,
    schemaVersion: z.literal(MEMBERSHIP_SCHEMA_VERSION),
  })
  .refine((doc) => doc.id === `${doc.userId}_${doc.tenantId}`);

const SlugDoc = z
  .strictObject({
    id: slugText,
    slug: slugText,
    tenantId,
    createdAt: isoString,
    updatedAt: isoString,
    schemaVersion: z.literal(COMMUNITY_SLUG_SCHEMA_VERSION),
  })
  .refine((doc) => doc.id === doc.slug);

function communityData(community: Community): Community {
  return {
    id: community.id,
    tenantId: community.tenantId,
    name: community.name,
    slug: community.slug,
    timezone: community.timezone,
    createdBy: community.createdBy,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    schemaVersion: community.schemaVersion,
  };
}

function membershipData(membership: Membership): Membership {
  return {
    id: membership.id,
    tenantId: membership.tenantId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    schemaVersion: membership.schemaVersion,
  };
}

function slugData(doc: CommunitySlug): CommunitySlug {
  return {
    id: doc.id,
    slug: doc.slug,
    tenantId: doc.tenantId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    schemaVersion: doc.schemaVersion,
  };
}

// Shape failures carry only a reason, never field values.
const communityConverter: FirestoreDataConverter<Community> = {
  toFirestore: (community) => communityData(community as Community),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = CommunityDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-community-doc' });
    return parsed.data;
  },
};

export const membershipConverter: FirestoreDataConverter<Membership> = {
  toFirestore: (membership) => membershipData(membership as Membership),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = MembershipDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-membership-doc' });
    return parsed.data;
  },
};

const slugConverter: FirestoreDataConverter<CommunitySlug> = {
  toFirestore: (doc) => slugData(doc as CommunitySlug),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = SlugDoc.safeParse(snap.data());
    if (!parsed.success)
      throw new DomainError('INTERNAL', { reason: 'corrupt-community-slug-doc' });
    return parsed.data;
  },
};

function isAlreadyExists(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('code' in e)) return false;
  const code = (e as { code?: unknown }).code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** Firestore `communities` and `communitySlugs`. Shares a database with `FirestoreMembershipRepo`. */
export class FirestoreCommunityRepo implements CommunityRepo {
  readonly #db: Firestore;
  readonly #communities: CollectionReference<Community>;
  readonly #memberships: CollectionReference<Membership>;
  readonly #slugs: CollectionReference<CommunitySlug>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#communities = db.collection('communities').withConverter(communityConverter);
    this.#memberships = db.collection('memberships').withConverter(membershipConverter);
    this.#slugs = db.collection('communitySlugs').withConverter(slugConverter);
  }

  async getById(tenantId: TenantId): Promise<Community | null> {
    const snap = await this.#communities.doc(asTenantId(tenantId)).get();
    return snap.data() ?? null;
  }

  async getByIds(tenantIds: readonly TenantId[]): Promise<Community[]> {
    const seen = new Set<string>();
    const ids: TenantId[] = [];
    for (const raw of tenantIds) {
      const id = asTenantId(raw);
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length === 0) return [];
    const snaps = await Promise.all(ids.map((id) => this.#communities.doc(id).get()));
    return snaps.flatMap((snap) => {
      const community = snap.data();
      return community ? [community] : [];
    });
  }

  async createWithOwner(
    input: CreateWithOwnerInput,
  ): Promise<{ community: Community; membership: Membership }> {
    validateCreateWithOwner(input);
    const { community, membership } = input;
    const candidates = slugCandidates(input.baseSlug, community.tenantId);
    const communityRef = this.#communities.doc(community.tenantId);
    const membershipRef = this.#memberships.doc(membership.id);
    const slugRefs = candidates.map((candidate) => this.#slugs.doc(candidate));

    try {
      return await this.#db.runTransaction(async (tx) => {
        const communitySnap = await tx.get(communityRef);
        const membershipSnap = await tx.get(membershipRef);
        const slugSnaps = [];
        for (const ref of slugRefs) slugSnaps.push(await tx.get(ref));

        if (communitySnap.exists) {
          throw new DomainError('CONFLICT', { reason: 'community-exists' });
        }
        if (membershipSnap.exists) {
          throw new DomainError('CONFLICT', { reason: 'membership-exists' });
        }
        const taken = new Set<string>();
        slugSnaps.forEach((snap, index) => {
          if (!snap.exists) return;
          // `data()` runs the converter. A corrupt slug doc is INTERNAL, not a free name.
          const reserved = snap.data();
          if (!reserved || !SlugDoc.safeParse(reserved).success) {
            throw new DomainError('INTERNAL', { reason: 'corrupt-community-slug-doc' });
          }
          taken.add(candidates[index]!);
        });
        const slug = chooseSlug(input.baseSlug, community.tenantId, taken);
        if (slug === null) throw new DomainError('CONFLICT', { reason: 'slug-exhausted' });

        const storedCommunity = communityData({ ...community, slug });
        const storedMembership = membershipData({ ...membership, role: 'owner' });
        const slugDoc = slugData({
          id: slug,
          slug,
          tenantId: community.tenantId,
          createdAt: community.createdAt,
          updatedAt: community.createdAt,
          schemaVersion: COMMUNITY_SLUG_SCHEMA_VERSION,
        });
        tx.create(communityRef, storedCommunity);
        tx.create(membershipRef, storedMembership);
        tx.create(this.#slugs.doc(slug), slugDoc);
        return { community: storedCommunity, membership: storedMembership };
      });
    } catch (e) {
      if (isDomainError(e)) throw e;
      if (isAlreadyExists(e)) {
        throw new DomainError('CONFLICT', { reason: 'community-create-conflict' });
      }
      throw e;
    }
  }
}

/** Firestore `memberships`. `deleteByUser` uses an unconverted query so a corrupt doc still goes. */
export class FirestoreMembershipRepo implements MembershipRepo {
  readonly #db: Firestore;
  readonly #memberships: CollectionReference<Membership>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#memberships = db.collection('memberships').withConverter(membershipConverter);
  }

  async get(tenantId: TenantId, userId: UserId): Promise<Membership | null> {
    const tid = asTenantId(tenantId);
    const uid = asUserId(userId);
    const membership = (await this.#memberships.doc(membershipId(uid, tid)).get()).data();
    if (!membership || membership.tenantId !== tid || membership.userId !== uid) return null;
    return membership;
  }

  async listByUser(userId: UserId): Promise<Membership[]> {
    const id = asUserId(userId);
    const snap = await this.#memberships.where('userId', '==', id).get();
    return snap.docs.map((doc) => doc.data()).filter((membership) => membership.userId === id);
  }

  async deleteByUser(userId: UserId): Promise<void> {
    const id = asUserId(userId);
    // Unconverted refs: a corrupt doc must not throw INTERNAL and block account deletion.
    const raw = this.#db.collection('memberships');
    for (;;) {
      const deleted = await this.#db.runTransaction(async (tx) => {
        const snap = await tx.get(raw.where('userId', '==', id).limit(DELETE_BATCH));
        for (const doc of snap.docs) tx.delete(doc.ref);
        return snap.size;
      });
      if (deleted === 0) return;
    }
  }
}
