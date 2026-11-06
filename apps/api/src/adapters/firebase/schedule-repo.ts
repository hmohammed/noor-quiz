import {
  asQuestionId,
  asSeasonId,
  asTenantId,
  asUserId,
  copyScheduleEntry,
  DomainError,
  instantFromIso,
  SCHEDULE_SCHEMA_VERSION,
  scheduleEntryId,
  ULID_PATTERN,
  type QuestionId,
  type ScheduleEntry,
  type ScheduleRepo,
  type SeasonId,
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
const questionId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as QuestionId);
const userId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as UserId);

const ScheduleDoc = z
  .strictObject({
    id: z.string().min(1),
    tenantId,
    seasonId,
    dayIndex: z.number().int().min(1).max(366),
    questionId,
    scheduledBy: userId,
    scheduledAt: isoString,
    schemaVersion: z.literal(SCHEDULE_SCHEMA_VERSION),
  })
  .refine((doc) => doc.id === `${doc.seasonId}_${doc.dayIndex}`, 'schedule-id');

function checked(entry: ScheduleEntry): ScheduleEntry {
  return copyScheduleEntry({
    ...entry,
    id: scheduleEntryId(asSeasonId(entry.seasonId), entry.dayIndex),
    tenantId: asTenantId(entry.tenantId),
    seasonId: asSeasonId(entry.seasonId),
    questionId: asQuestionId(entry.questionId),
    scheduledBy: asUserId(entry.scheduledBy),
  });
}

function assertSchemaVersion(entry: ScheduleEntry): void {
  if (entry.schemaVersion !== SCHEDULE_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

const scheduleConverter: FirestoreDataConverter<ScheduleEntry> = {
  toFirestore: (entry) => copyScheduleEntry(entry as ScheduleEntry),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = ScheduleDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-schedule-doc' });
    return parsed.data;
  },
};

/** Firestore `schedule`. Firestore types stay in this file. */
export class FirestoreScheduleRepo implements ScheduleRepo {
  readonly #schedule: CollectionReference<ScheduleEntry>;

  constructor(db: Firestore) {
    this.#schedule = db.collection('schedule').withConverter(scheduleConverter);
  }

  async get(
    tenantId: TenantId,
    seasonId: SeasonId,
    dayIndex: number,
  ): Promise<ScheduleEntry | null> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const id = scheduleEntryId(sid, dayIndex);
    const entry = (await this.#schedule.doc(id).get()).data();
    if (!entry || entry.tenantId !== tid) return null;
    return copyScheduleEntry(entry);
  }

  async listBySeason(tenantId: TenantId, seasonId: SeasonId): Promise<ScheduleEntry[]> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const snap = await this.#schedule.where('seasonId', '==', sid).get();
    return snap.docs
      .map((doc) => doc.data())
      .filter((entry) => entry.tenantId === tid && entry.seasonId === sid)
      .map((entry) => copyScheduleEntry(entry));
  }

  async put(entry: ScheduleEntry): Promise<ScheduleEntry> {
    assertSchemaVersion(entry);
    const expectedId = scheduleEntryId(asSeasonId(entry.seasonId), entry.dayIndex);
    if (entry.id !== expectedId) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schedule-id' });
    }
    const stored = checked(entry);
    await this.#schedule.doc(stored.id).set(stored);
    return copyScheduleEntry(stored);
  }
}
