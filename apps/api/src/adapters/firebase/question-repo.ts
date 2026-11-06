import {
  asQuestionId,
  asTenantId,
  asUserId,
  copyQuestion,
  DomainError,
  instantFromIso,
  isDomainError,
  QUESTION_DIFFICULTIES,
  QUESTION_SCHEMA_VERSION,
  REVIEW_STATUSES,
  SOURCE_KINDS,
  ULID_PATTERN,
  type Question,
  type QuestionId,
  type QuestionRepo,
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

function codePoints(value: string): number {
  return Array.from(value).length;
}

/** Stored text. Length is Unicode code points. Not trimmed again on read. */
function text(min: number, max: number) {
  return z.string().refine((value) => {
    const length = codePoints(value);
    return length >= min && length <= max;
  });
}

const questionId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as QuestionId);
const tenantId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as TenantId);
const userId = z
  .string()
  .regex(ULID_PATTERN)
  .transform((s) => s as UserId);

const LocaleDoc = z.strictObject({
  title: text(1, 120),
  prompt: text(1, 2000),
  choices: z.array(text(1, 300)).min(2).max(6),
  explanation: text(0, 2000),
});

const QuestionDoc = z
  .strictObject({
    id: questionId,
    tenantId,
    type: z.literal('mcq'),
    difficulty: z.enum(QUESTION_DIFFICULTIES),
    topic: text(1, 48),
    locales: z.strictObject({
      en: LocaleDoc.optional(),
      sv: LocaleDoc.optional(),
      ar: LocaleDoc.optional(),
      am: LocaleDoc.optional(),
      so: LocaleDoc.optional(),
    }),
    answer: z.strictObject({ choiceIndex: z.number().int().min(0) }),
    sources: z.array(z.strictObject({ kind: z.enum(SOURCE_KINDS), ref: text(1, 200) })).max(8),
    reviewStatus: z.enum(REVIEW_STATUSES),
    reviewNotes: text(0, 2000),
    authoredBy: userId,
    reviewedBy: userId.nullable().optional(),
    reviewedAt: isoString.nullable().optional(),
    createdAt: isoString,
    updatedAt: isoString,
    schemaVersion: z.literal(QUESTION_SCHEMA_VERSION),
  })
  .refine((doc) => {
    const present = Object.values(doc.locales).filter((locale) => locale !== undefined);
    const first = present[0];
    if (!first) return false;
    const count = first.choices.length;
    return (
      present.every((locale) => locale.choices.length === count) && doc.answer.choiceIndex < count
    );
  }, 'question')
  .transform((doc) => ({
    ...doc,
    reviewedBy: doc.reviewedBy ?? null,
    reviewedAt: doc.reviewedAt ?? null,
  }));

function checked(question: Question): Question {
  return copyQuestion({
    ...question,
    id: asQuestionId(question.id),
    tenantId: asTenantId(question.tenantId),
    authoredBy: asUserId(question.authoredBy),
    reviewedBy: question.reviewedBy === null ? null : asUserId(question.reviewedBy),
  });
}

function assertSchemaVersion(question: Question): void {
  if (question.schemaVersion !== QUESTION_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

const questionConverter: FirestoreDataConverter<Question> = {
  toFirestore: (question) => copyQuestion(question as Question),
  fromFirestore: (snap: QueryDocumentSnapshot) => {
    const parsed = QuestionDoc.safeParse(snap.data());
    if (!parsed.success) throw new DomainError('INTERNAL', { reason: 'corrupt-question-doc' });
    return parsed.data;
  },
};

function isAlreadyExists(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('code' in e)) return false;
  const code = (e as { code?: unknown }).code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** Firestore `questions`. Firestore types stay in this file. */
export class FirestoreQuestionRepo implements QuestionRepo {
  readonly #db: Firestore;
  readonly #questions: CollectionReference<Question>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#questions = db.collection('questions').withConverter(questionConverter);
  }

  async get(tenantId: TenantId, questionId: QuestionId): Promise<Question | null> {
    const id = asQuestionId(questionId);
    const tid = asTenantId(tenantId);
    const question = (await this.#questions.doc(id).get()).data();
    if (!question || question.tenantId !== tid) return null;
    return copyQuestion(question);
  }

  async list(tenantId: TenantId): Promise<Question[]> {
    const tid = asTenantId(tenantId);
    const snap = await this.#questions.where('tenantId', '==', tid).get();
    return snap.docs
      .map((doc) => doc.data())
      .filter((question) => question.tenantId === tid)
      .map((question) => copyQuestion(question));
  }

  async create(question: Question): Promise<Question> {
    const stored = checked(question);
    assertSchemaVersion(stored);
    const ref = this.#questions.doc(stored.id);
    try {
      await this.#db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new DomainError('CONFLICT', { reason: 'question-exists' });
        tx.create(ref, stored);
      });
    } catch (e) {
      if (isDomainError(e)) throw e;
      if (isAlreadyExists(e)) throw new DomainError('CONFLICT', { reason: 'question-exists' });
      throw e;
    }
    return copyQuestion(stored);
  }

  async update(question: Question): Promise<Question> {
    const next = checked(question);
    assertSchemaVersion(next);
    const ref = this.#questions.doc(next.id);
    const saved = await this.#db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });
      const current = snap.data();
      if (!current || current.tenantId !== next.tenantId) {
        throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });
      }
      if (
        current.authoredBy !== next.authoredBy ||
        current.createdAt !== next.createdAt ||
        current.type !== next.type
      ) {
        throw new DomainError('VALIDATION', { reason: 'immutable-field' });
      }
      const document = copyQuestion({
        ...next,
        id: current.id,
        tenantId: current.tenantId,
        type: current.type,
        authoredBy: current.authoredBy,
        createdAt: current.createdAt,
        schemaVersion: QUESTION_SCHEMA_VERSION,
      });
      tx.set(ref, document);
      return document;
    });
    return copyQuestion(saved);
  }
}
