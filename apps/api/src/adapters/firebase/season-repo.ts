import {
  asSeasonId,
  asTenantId,
  asUserId,
  DomainError,
  instantFromIso,
  isDomainError,
  SEASON_KINDS,
  SEASON_SCHEMA_VERSION,
  ULID_PATTERN,
  type CommunitySeason,
  type SeasonId,
  type SeasonRepo,
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

const isoString = z.string().refine((s) => {
  try {
    instantFromIso(s);
    return true;
  } catch {
    return false;
  }
});

const seasonId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as SeasonId);
const tenantId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as TenantId);
const userId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as UserId);

const SeasonDoc = z.strictObject({
  id: seasonId,
  tenantId,
  name: z.string().min(1),
  kind: z.enum(SEASON_KINDS),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lengthDays: z.number().int().min(1).max(366),
  timezone: z.string().min(1).max(64),
  opensAtLocal: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closesAtLocal: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  createdBy: userId,
  createdAt: isoString,
  updatedAt: isoString,
  schemaVersion: z.literal(SEASON_SCHEMA_VERSION),
});

function seasonData(season: CommunitySeason): CommunitySeason {
  return {
    id: season.id,
    tenantId: season.tenantId,
    name: season.name,
    kind: season.kind,
    startDate: season.startDate,
    lengthDays: season.lengthDays,
    timezone: season.timezone,
    opensAtLocal: season.opensAtLocal,
    closesAtLocal: season.closesAtLocal,
    createdBy: season.createdBy,
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
    schemaVersion: season.schemaVersion,
  };
}

function checked(season: CommunitySeason): CommunitySeason {
  return seasonData({
    ...season,
    id: asSeasonId(season.id),
    tenantId: asTenantId(season.tenantId),
    createdBy: asUserId(season.createdBy),
  });
}

function assertSchemaVersion(season: CommunitySeason): void {
  if (season.schemaVersion !== SEASON_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

const seasonConverter: FirestoreDataConverter<CommunitySeason> = {
  toFirestore: (season) => seasonData(season as CommunitySeason),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = SeasonDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-season-doc' });
    return parsed.data;
  },
};

function isAlreadyExists(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('code' in e)) return false;
  const code = (e as { code?: unknown }).code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** Firestore `seasons`. Firestore types stay in this file. */
export class FirestoreSeasonRepo implements SeasonRepo {
  readonly #db: Firestore;
  readonly #seasons: CollectionReference<CommunitySeason>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#seasons = db.collection('seasons').withConverter(seasonConverter);
  }

  async get(tenantId: TenantId, seasonId: SeasonId): Promise<CommunitySeason | null> {
    const id = asSeasonId(seasonId);
    const tid = asTenantId(tenantId);
    const season = (await this.#seasons.doc(id).get()).data();
    if (!season || season.tenantId !== tid) return null;
    return season;
  }

  async list(tenantId: TenantId): Promise<CommunitySeason[]> {
    const tid = asTenantId(tenantId);
    const snap = await this.#seasons.where('tenantId', '==', tid).get();
    return snap.docs.map((doc) => doc.data()).filter((season) => season.tenantId === tid);
  }

  async create(season: CommunitySeason): Promise<CommunitySeason> {
    const stored = checked(season);
    assertSchemaVersion(stored);
    const ref = this.#seasons.doc(stored.id);
    try {
      await this.#db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new DomainError('CONFLICT', { reason: 'season-exists' });
        tx.create(ref, stored);
      });
    } catch (e) {
      if (isDomainError(e)) throw e;
      if (isAlreadyExists(e)) throw new DomainError('CONFLICT', { reason: 'season-exists' });
      throw e;
    }
    return { ...stored };
  }

  async update(season: CommunitySeason): Promise<CommunitySeason> {
    const next = checked(season);
    assertSchemaVersion(next);
    const ref = this.#seasons.doc(next.id);
    const saved = await this.#db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });
      const current = snap.data();
      if (!current || current.tenantId !== next.tenantId) {
        throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });
      }
      if (current.createdBy !== next.createdBy || current.createdAt !== next.createdAt) {
        throw new DomainError('VALIDATION', { reason: 'immutable-field' });
      }
      const document: CommunitySeason = {
        ...next,
        id: current.id,
        tenantId: current.tenantId,
        createdBy: current.createdBy,
        createdAt: current.createdAt,
        schemaVersion: SEASON_SCHEMA_VERSION,
      };
      tx.set(ref, document);
      return document;
    });
    return { ...saved };
  }
}
