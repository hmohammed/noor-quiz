import type { TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Locale } from '../users/profile';
import { SUPPORTED_LOCALES } from '../users/profile';
import { ULID_PATTERN, type UserId } from '../users/user';

/**
 * Difficulty is a label. Keep this list in the same order as `QUESTION_DIFFICULTIES`
 * in `@noor/contracts` (core does not import contracts).
 */
export const QUESTION_DIFFICULTIES = ['beginner', 'intermediate', 'scholar'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

/** Keep this list in the same order as `SOURCE_KINDS` in `@noor/contracts`. */
export const SOURCE_KINDS = ['quran', 'hadith', 'book'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * Stored review status. This slice only writes `draft`. The other three exist so a
 * later task can return them without a new type. Agents must not write `approved`.
 */
export const REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const QUESTION_TYPES = ['mcq'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

const DIFFICULTY_SET: ReadonlySet<string> = new Set(QUESTION_DIFFICULTIES);
const SOURCE_KIND_SET: ReadonlySet<string> = new Set(SOURCE_KINDS);
const REVIEW_STATUS_SET: ReadonlySet<string> = new Set(REVIEW_STATUSES);

export function isQuestionDifficulty(s: unknown): s is QuestionDifficulty {
  return typeof s === 'string' && DIFFICULTY_SET.has(s);
}

export function isSourceKind(s: unknown): s is SourceKind {
  return typeof s === 'string' && SOURCE_KIND_SET.has(s);
}

export function isReviewStatus(s: unknown): s is ReviewStatus {
  return typeof s === 'string' && REVIEW_STATUS_SET.has(s);
}

/** Our own question id: a ULID. Never a client-chosen slug. */
export type QuestionId = string & { readonly __brand: 'QuestionId' };

export const QUESTION_SCHEMA_VERSION = 1 as const;

/** Brands a ULID string as a QuestionId, or throws `VALIDATION`. */
export function asQuestionId(s: string): QuestionId {
  if (typeof s !== 'string' || !ULID_PATTERN.test(s)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-question-id' });
  }
  return s as QuestionId;
}

/** One locale of an `mcq`. `explanation` stays in storage and off the member view. */
export interface QuestionLocale {
  title: string;
  prompt: string;
  choices: string[];
  explanation: string;
}

export type QuestionLocales = Partial<Record<Locale, QuestionLocale>>;

export interface QuestionSource {
  kind: SourceKind;
  ref: string;
}

/**
 * `questions/{questionId}`. `id` equals the document id. `schemaVersion` is 1.
 * `sources` may be empty in storage so a later import can keep a draft; the create
 * and update use cases still require 1–8 sources.
 */
export interface Question {
  id: QuestionId;
  tenantId: TenantId;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  topic: string;
  locales: QuestionLocales;
  answer: { choiceIndex: number };
  sources: QuestionSource[];
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  authoredBy: UserId;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. Equals `createdAt` on create. */
  updatedAt: string;
  schemaVersion: typeof QUESTION_SCHEMA_VERSION;
}

/** A new object, so a caller cannot change the stored question through a returned one. */
export function copyQuestion(question: Question): Question {
  const locales: QuestionLocales = {};
  for (const locale of SUPPORTED_LOCALES) {
    const content = question.locales[locale];
    if (!content) continue;
    locales[locale] = {
      title: content.title,
      prompt: content.prompt,
      choices: [...content.choices],
      explanation: content.explanation,
    };
  }
  return {
    id: question.id,
    tenantId: question.tenantId,
    type: question.type,
    difficulty: question.difficulty,
    topic: question.topic,
    locales,
    answer: { choiceIndex: question.answer.choiceIndex },
    sources: question.sources.map((source) => ({ kind: source.kind, ref: source.ref })),
    reviewStatus: question.reviewStatus,
    reviewNotes: question.reviewNotes,
    authoredBy: question.authoredBy,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    schemaVersion: question.schemaVersion,
  };
}
