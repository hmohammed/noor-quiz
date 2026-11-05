import { asTenantId } from '../communities/community';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { QuestionRepo } from '../ports/repos';
import {
  assertQuestion,
  normaliseQuestionContent,
  type QuestionContentInput,
} from '../questions/question-fields';
import { asQuestionId, QUESTION_SCHEMA_VERSION, type Question } from '../questions/question';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';

/**
 * Stores an editor's `mcq` as `draft`. `authoredBy` is the membership user id.
 * `tenantId` is the membership tenant, never a body field. Nothing here sets
 * `approved`.
 */
export async function createQuestion(
  deps: { clock: Clock; ids: IdGenerator; questions: QuestionRepo },
  input: QuestionContentInput & { tenantId: string; userId: string },
): Promise<Question> {
  const tenantId = asTenantId(input.tenantId);
  const authoredBy = asUserId(input.userId);
  const content = normaliseQuestionContent(input);
  assertQuestion(content);

  const at = toIso(deps.clock.now());
  const question: Question = {
    id: asQuestionId(deps.ids.newId()),
    tenantId,
    type: 'mcq',
    difficulty: content.difficulty,
    topic: content.topic,
    locales: content.locales,
    answer: content.answer,
    sources: content.sources,
    reviewStatus: 'draft',
    reviewNotes: '',
    authoredBy,
    createdAt: at,
    updatedAt: at,
    schemaVersion: QUESTION_SCHEMA_VERSION,
  };
  return deps.questions.create(question);
}
