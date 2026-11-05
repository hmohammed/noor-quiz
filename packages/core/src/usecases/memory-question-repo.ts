import { asTenantId, type TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { QuestionRepo } from '../ports/repos';
import {
  asQuestionId,
  copyQuestion,
  QUESTION_SCHEMA_VERSION,
  type Question,
  type QuestionId,
} from '../questions/question';
import { asUserId } from '../users/user';

/**
 * In-memory `QuestionRepo` for use-case tests. Core cannot import testkit (testkit
 * depends on core). The shared fake that routes use lives in `@noor/testkit`.
 */
export class MemoryQuestionRepo implements QuestionRepo {
  readonly #items: Question[] = [];

  all(): Question[] {
    return this.#items.map((question) => copyQuestion(question));
  }

  async get(tenantId: TenantId, questionId: QuestionId): Promise<Question | null> {
    const id = asQuestionId(questionId);
    const tid = asTenantId(tenantId);
    const found = this.#items.find((question) => question.id === id && question.tenantId === tid);
    return found ? copyQuestion(found) : null;
  }

  async list(tenantId: TenantId): Promise<Question[]> {
    const tid = asTenantId(tenantId);
    return this.#items
      .filter((question) => question.tenantId === tid)
      .map((question) => copyQuestion(question));
  }

  async create(question: Question): Promise<Question> {
    const stored = copyQuestion({
      ...question,
      id: asQuestionId(question.id),
      tenantId: asTenantId(question.tenantId),
      authoredBy: asUserId(question.authoredBy),
    });
    if (stored.schemaVersion !== QUESTION_SCHEMA_VERSION) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
    }
    if (this.#items.some((item) => item.id === stored.id)) {
      throw new DomainError('CONFLICT', { reason: 'question-exists' });
    }
    this.#items.push(stored);
    return copyQuestion(stored);
  }

  async update(question: Question): Promise<Question> {
    const next = copyQuestion({
      ...question,
      id: asQuestionId(question.id),
      tenantId: asTenantId(question.tenantId),
      authoredBy: asUserId(question.authoredBy),
    });
    if (next.schemaVersion !== QUESTION_SCHEMA_VERSION) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
    }
    const index = this.#items.findIndex(
      (item) => item.id === next.id && item.tenantId === next.tenantId,
    );
    const stored = index < 0 ? undefined : this.#items[index];
    if (!stored) throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });
    if (
      stored.authoredBy !== next.authoredBy ||
      stored.createdAt !== next.createdAt ||
      stored.type !== next.type
    ) {
      throw new DomainError('VALIDATION', { reason: 'immutable-field' });
    }
    const saved = copyQuestion({
      ...next,
      id: stored.id,
      tenantId: stored.tenantId,
      type: stored.type,
      authoredBy: stored.authoredBy,
      createdAt: stored.createdAt,
      schemaVersion: QUESTION_SCHEMA_VERSION,
    });
    this.#items[index] = saved;
    return copyQuestion(saved);
  }
}
