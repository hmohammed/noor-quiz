import { z } from 'zod';
import { Ulid } from './me';

/**
 * Difficulty, source kind and review status. Keep these lists in the same order as
 * core's `QUESTION_DIFFICULTIES`, `SOURCE_KINDS` and `REVIEW_STATUSES` (contracts
 * does not import core).
 */
export const QUESTION_DIFFICULTIES = ['beginner', 'intermediate', 'scholar'] as const;
export const QuestionDifficulty = z.enum(QUESTION_DIFFICULTIES);
export type QuestionDifficulty = z.infer<typeof QuestionDifficulty>;

export const SOURCE_KINDS = ['quran', 'hadith', 'book'] as const;
export const SourceKind = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof SourceKind>;

export const REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'rejected'] as const;
export const ReviewStatus = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

function codePoints(value: string): number {
  return Array.from(value).length;
}

/** Trimmed only. Length is Unicode code points, not UTF-16 units. No NFC, no collapsing. */
function trimmedText(min: number, max: number) {
  return z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z.string().refine((value) => {
        const length = codePoints(value);
        return length >= min && length <= max;
      }),
    );
}

const QuestionLocaleBody = z.strictObject({
  title: trimmedText(1, 120),
  prompt: trimmedText(1, 2000),
  choices: z.array(trimmedText(1, 300)).min(2).max(6),
  explanation: trimmedText(0, 2000),
});

const QuestionLocales = z
  .strictObject({
    en: QuestionLocaleBody.optional(),
    sv: QuestionLocaleBody.optional(),
    ar: QuestionLocaleBody.optional(),
    am: QuestionLocaleBody.optional(),
    so: QuestionLocaleBody.optional(),
  })
  .refine((locales) => {
    const counts = Object.values(locales)
      .filter((locale) => locale !== undefined)
      .map((locale) => locale.choices.length);
    return counts.length > 0 && counts.every((count) => count === counts[0]);
  }, 'choices');

const QuestionSource = z.strictObject({
  kind: SourceKind,
  ref: trimmedText(1, 200),
});

const ChoiceIndex = z.strictObject({
  choiceIndex: z.number().int().min(0),
});

function choiceCount(locales: z.infer<typeof QuestionLocales>): number {
  const present = Object.values(locales).find((locale) => locale !== undefined);
  return present?.choices.length ?? 0;
}

function choiceIndexInRange(
  locales: z.infer<typeof QuestionLocales>,
  choiceIndex: number,
): boolean {
  return choiceIndex < choiceCount(locales);
}

/**
 * Body of `POST /v1/t/:tenantId/questions`. Strict: `reviewStatus`, `type`, `tenantId`,
 * `authoredBy`, `id` and `schemaVersion` are rejected. Text is trimmed only.
 */
export const CreateQuestionRequest = z
  .strictObject({
    difficulty: QuestionDifficulty,
    topic: trimmedText(1, 48),
    locales: QuestionLocales,
    answer: ChoiceIndex,
    sources: z.array(QuestionSource).min(1).max(8),
  })
  .refine((body) => choiceIndexInRange(body.locales, body.answer.choiceIndex), 'choiceIndex');
export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequest>;
export type CreateQuestionRequestInput = z.input<typeof CreateQuestionRequest>;

/**
 * Body of `PATCH /v1/t/:tenantId/questions/:questionId`. At least one field, no extras.
 * `choiceIndex` is checked against `locales` only when both are in the patch; the use
 * case checks the merged question.
 */
export const UpdateQuestionRequest = z
  .strictObject({
    difficulty: QuestionDifficulty.optional(),
    topic: trimmedText(1, 48).optional(),
    locales: QuestionLocales.optional(),
    answer: ChoiceIndex.optional(),
    sources: z.array(QuestionSource).min(1).max(8).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'empty patch')
  .refine((body) => {
    if (body.answer === undefined || body.locales === undefined) return true;
    return choiceIndexInRange(body.locales, body.answer.choiceIndex);
  }, 'choiceIndex');
export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequest>;
export type UpdateQuestionRequestInput = z.input<typeof UpdateQuestionRequest>;

/**
 * One question as an editor sees it. Strict, so `schemaVersion` fails validation and
 * never leaves the server. `sources` may be empty so a later import can return a draft
 * that was stored that way. This slice's write path still requires 1–8 sources.
 */
export const Question = z
  .strictObject({
    id: Ulid,
    tenantId: Ulid,
    type: z.literal('mcq'),
    difficulty: QuestionDifficulty,
    topic: trimmedText(1, 48),
    locales: QuestionLocales,
    answer: ChoiceIndex,
    sources: z.array(QuestionSource).max(8),
    reviewStatus: ReviewStatus,
    reviewNotes: trimmedText(0, 2000),
    authoredBy: Ulid,
    createdAt: UtcIso,
    updatedAt: UtcIso,
  })
  .refine(
    (question) => choiceIndexInRange(question.locales, question.answer.choiceIndex),
    'choiceIndex',
  );
export type Question = z.infer<typeof Question>;

/** Body of `GET /v1/t/:tenantId/questions`. */
export const QuestionListResponse = z.strictObject({
  questions: z.array(Question),
});
export type QuestionListResponse = z.infer<typeof QuestionListResponse>;

/**
 * What a member may see. `z.object` strips unknown keys, so `answer` and per-locale
 * `explanation` are removed rather than rejected. Not strict and not loose.
 */
const MemberQuestionLocale = z.object({
  title: z.string(),
  prompt: z.string(),
  choices: z.array(z.string()),
});

const MemberQuestionSource = z.object({
  kind: SourceKind,
  ref: z.string(),
});

export const MemberQuestionView = z.object({
  id: Ulid,
  tenantId: Ulid,
  type: z.literal('mcq'),
  difficulty: QuestionDifficulty,
  topic: z.string(),
  locales: z.object({
    en: MemberQuestionLocale.optional(),
    sv: MemberQuestionLocale.optional(),
    ar: MemberQuestionLocale.optional(),
    am: MemberQuestionLocale.optional(),
    so: MemberQuestionLocale.optional(),
  }),
  sources: z.array(MemberQuestionSource),
});
export type MemberQuestionView = z.infer<typeof MemberQuestionView>;
