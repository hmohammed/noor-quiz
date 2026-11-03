import {
  asUserId,
  CONSENT_VERSION_MAX,
  DomainError,
  identityId,
  instantFromIso,
  isDomainError,
  isValidConsent,
  SUPPORTED_LOCALES,
  ULID_PATTERN,
  USER_SCHEMA_VERSION,
  type Consent,
  type Identity,
  type IdentityKey,
  type ProfilePatch,
  type User,
  type UserId,
  type UserRepo,
} from '@noor/core';
import type {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { z } from 'zod';

const isoString = z.string().refine((s) => {
  try {
    instantFromIso(s);
    return true;
  } catch {
    return false;
  }
});
const userId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as UserId);

// `locale` and `timezone` arrived in T011 and `consent` in T013a, all without a schema
// bump: missing keys read as null.
const UserDoc = z.strictObject({
  id: userId,
  displayName: z.string().nullable(),
  locale: z.enum(SUPPORTED_LOCALES).nullable().default(null),
  timezone: z.string().nullable().default(null),
  consent: z
    .strictObject({ version: z.string().min(1).max(CONSENT_VERSION_MAX), acceptedAt: isoString })
    .nullable()
    .default(null),
  createdAt: isoString,
  updatedAt: isoString,
  schemaVersion: z.literal(USER_SCHEMA_VERSION),
});

const IdentityDoc = z.strictObject({
  id: z.string(),
  provider: z.literal('firebase'),
  subject: z.string(),
  userId,
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: isoString,
  schemaVersion: z.literal(USER_SCHEMA_VERSION),
});

function toUserDoc(u: User): User {
  return {
    id: u.id,
    displayName: u.displayName,
    locale: u.locale,
    timezone: u.timezone,
    consent: u.consent && { version: u.consent.version, acceptedAt: u.consent.acceptedAt },
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    schemaVersion: u.schemaVersion,
  };
}

function toIdentityDoc(i: Identity): Identity {
  return {
    id: i.id,
    provider: i.provider,
    subject: i.subject,
    userId: i.userId,
    email: i.email,
    emailVerified: i.emailVerified,
    createdAt: i.createdAt,
    schemaVersion: i.schemaVersion,
  };
}

// Shape failures carry only a reason, never field values (PII).
const userConverter: FirestoreDataConverter<User> = {
  toFirestore: (u) => toUserDoc(u as User),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = UserDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-user-doc' });
    return parsed.data;
  },
};

const identityConverter: FirestoreDataConverter<Identity> = {
  toFirestore: (i) => toIdentityDoc(i as Identity),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = IdentityDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-identity-doc' });
    return parsed.data;
  },
};

/** Firestore UserRepo over the global `users` and `identities` collections (no tenantId). */
export class FirestoreUserRepo implements UserRepo {
  readonly #db: Firestore;
  readonly #users: CollectionReference<User>;
  readonly #identities: CollectionReference<Identity>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#users = db.collection('users').withConverter(userConverter);
    this.#identities = db.collection('identities').withConverter(identityConverter);
  }

  async getByIdentity(key: IdentityKey): Promise<User | null> {
    const identity = (await this.#identities.doc(identityId(key)).get()).data();
    if (!identity) return null;
    const user = (await this.#users.doc(asUserId(identity.userId)).get()).data();
    if (!user) throw new DomainError('INTERNAL', { reason: 'identity-without-user' });
    return user;
  }

  async createWithIdentity(user: User, identity: Identity): Promise<User> {
    const id = identityId(identity);
    const newUserId = asUserId(user.id);
    if (id !== identity.id || identity.userId !== newUserId) {
      throw new DomainError('VALIDATION', { reason: 'identity-mismatch' });
    }
    const identityRef = this.#identities.doc(id);

    try {
      return await this.#db.runTransaction(async (tx) => {
        const existing = (await tx.get(identityRef)).data();
        if (existing) {
          const linked = (await tx.get(this.#users.doc(asUserId(existing.userId)))).data();
          if (!linked) throw new DomainError('INTERNAL', { reason: 'identity-without-user' });
          return linked;
        }
        // `create`, not `set`: a ULID collision fails instead of overwriting a user.
        tx.create(this.#users.doc(newUserId), user);
        tx.create(identityRef, identity);
        return toUserDoc(user);
      });
    } catch (e) {
      if (isDomainError(e)) throw e;
      // Contention or ALREADY_EXISTS: another call most likely created the identity.
      const winner = await this.getByIdentity(identity);
      if (winner) return winner;
      throw new DomainError('INTERNAL', { reason: 'create-user-failed' });
    }
  }

  async getById(id: UserId): Promise<User | null> {
    return (await this.#users.doc(asUserId(id)).get()).data() ?? null;
  }

  async updateProfile(id: UserId, patch: ProfilePatch, updatedAt: string): Promise<User> {
    const ref = this.#users.doc(asUserId(id));
    // Named keys only, so nothing outside the profile fields can reach the doc.
    const updates: Partial<Pick<User, 'displayName' | 'locale' | 'timezone' | 'updatedAt'>> = {
      updatedAt,
    };
    if (patch.displayName !== undefined) updates.displayName = patch.displayName;
    if (patch.locale !== undefined) updates.locale = patch.locale;
    if (patch.timezone !== undefined) updates.timezone = patch.timezone;

    return this.#db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (!current) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      tx.update(ref, updates);
      return toUserDoc({ ...current, ...updates });
    });
  }

  async recordConsent(id: UserId, consent: Consent, updatedAt: string): Promise<User> {
    const ref = this.#users.doc(asUserId(id));
    if (!isValidConsent(consent))
      throw new DomainError('VALIDATION', { reason: 'invalid-consent' });
    // Named keys only, so nothing else on the consent object can reach the doc.
    const stored: Consent = { version: consent.version, acceptedAt: consent.acceptedAt };

    return this.#db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (!current) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      tx.update(ref, { consent: stored, updatedAt });
      return toUserDoc({ ...current, consent: stored, updatedAt });
    });
  }
}
