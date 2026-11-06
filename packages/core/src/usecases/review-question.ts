import { asTenantId } from '../communities/community';
import { canApproveOrReject, canSubmitForReview, isRole, type Role } from '../communities/role';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { QuestionRepo } from '../ports/repos';
import {
  asQuestionId,
  QUESTION_SCHEMA_VERSION,
  type Question,
  type ReviewStatus,
} from '../questions/question';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';

export type ReviewTargetStatus = Exclude<ReviewStatus, 'draft'>;

function assertRoleForStatus(role: Role, status: ReviewTargetStatus): void {
  if (status === 'in_review') {
    if (!canSubmitForReview(role)) {
      throw new DomainError('FORBIDDEN', { reason: 'cannot-submit-for-review' });
    }
    return;
  }
  if (!canApproveOrReject(role)) {
    throw new DomainError('FORBIDDEN', { reason: 'cannot-approve-or-reject' });
  }
}

function assertTransition(from: ReviewStatus, to: ReviewTargetStatus): void {
  if (to === 'in_review') {
    if (from === 'draft' || from === 'rejected' || from === 'in_review') return;
    throw new DomainError('CONFLICT', { reason: 'illegal-review-transition' });
  }
  if (from === 'in_review') return;
  throw new DomainError('CONFLICT', { reason: 'illegal-review-transition' });
}

/**
 * Moves a question through review. Editors (and above) submit for review; scholar-
 * reviewers, admins and owners approve or reject. Role is checked before transition
 * so a scholar who cannot submit gets FORBIDDEN, not CONFLICT, on `in_review`.
 */
export async function reviewQuestion(
  deps: { clock: Clock; questions: QuestionRepo },
  input: {
    tenantId: string;
    questionId: string;
    userId: string;
    role: string;
    status: ReviewTargetStatus;
    notes: string;
  },
): Promise<Question> {
  const tenantId = asTenantId(input.tenantId);
  const questionId = asQuestionId(input.questionId);
  const actor = asUserId(input.userId);
  if (!isRole(input.role)) {
    throw new DomainError('FORBIDDEN', { reason: 'invalid-role' });
  }
  assertRoleForStatus(input.role, input.status);

  const stored = await deps.questions.get(tenantId, questionId);
  if (!stored) throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });

  assertTransition(stored.reviewStatus, input.status);

  const notes = input.notes.trim();
  if (Array.from(notes).length > 2000) {
    throw new DomainError('VALIDATION', { reason: 'notes-too-long' });
  }

  const at = toIso(deps.clock.now());
  const submitting = input.status === 'in_review';

  return deps.questions.update({
    id: stored.id,
    tenantId: stored.tenantId,
    type: stored.type,
    difficulty: stored.difficulty,
    topic: stored.topic,
    locales: stored.locales,
    answer: stored.answer,
    sources: stored.sources,
    reviewStatus: input.status,
    reviewNotes: notes,
    authoredBy: stored.authoredBy,
    reviewedBy: submitting ? null : actor,
    reviewedAt: submitting ? null : at,
    createdAt: stored.createdAt,
    updatedAt: at,
    schemaVersion: QUESTION_SCHEMA_VERSION,
  });
}
