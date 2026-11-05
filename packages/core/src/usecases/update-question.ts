import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { QuestionRepo } from '../ports/repos';
import {
  assertQuestion,
  contentFromPatch,
  hasQuestionPatch,
  type QuestionPatch,
} from '../questions/question-fields';
import { asQuestionId, QUESTION_SCHEMA_VERSION, type Question } from '../questions/question';
import { toIso } from '../time/instant';

/**
 * Patches editorial fields and runs `assertQuestion` on the merge. Identity fields,
 * `reviewStatus` and `reviewNotes` stay as stored. `updatedAt` is a new clock read.
 * A missing question and another tenant's id are both `NOT_FOUND`.
 */
export async function updateQuestion(
  deps: { clock: Clock; questions: QuestionRepo },
  input: { tenantId: string; questionId: string; patch: QuestionPatch },
): Promise<Question> {
  const tenantId = asTenantId(input.tenantId);
  const questionId = asQuestionId(input.questionId);
  if (!hasQuestionPatch(input.patch)) {
    throw new DomainError('VALIDATION', { reason: 'empty-patch' });
  }

  const now = deps.clock.now();
  const stored = await deps.questions.get(tenantId, questionId);
  if (!stored) throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });

  const content = contentFromPatch(stored, input.patch);
  assertQuestion(content);

  return deps.questions.update({
    id: stored.id,
    tenantId: stored.tenantId,
    type: stored.type,
    difficulty: content.difficulty,
    topic: content.topic,
    locales: content.locales,
    answer: content.answer,
    sources: content.sources,
    reviewStatus: stored.reviewStatus,
    reviewNotes: stored.reviewNotes,
    authoredBy: stored.authoredBy,
    createdAt: stored.createdAt,
    updatedAt: toIso(now),
    schemaVersion: QUESTION_SCHEMA_VERSION,
  });
}
