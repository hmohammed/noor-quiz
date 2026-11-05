import {
  asQuestionId,
  asTenantId,
  asUserId,
  copyQuestion,
  DomainError,
  QUESTION_SCHEMA_VERSION,
  type Question,
  type QuestionId,
  type QuestionRepo,
  type TenantId,
} from '@noor/core';

function storedQuestion(question: Question): Question {
  return copyQuestion({
    ...question,
    id: asQuestionId(question.id),
    tenantId: asTenantId(question.tenantId),
    authoredBy: asUserId(question.authoredBy),
  });
}

function assertSchemaVersion(question: Question): void {
  if (question.schemaVersion !== QUESTION_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

/**
 * In-memory `questions`. `update` does not await between the check and the write, so
 * it is atomic on one thread. Returns copies, never stored objects.
 */
export class InMemoryQuestionRepo implements QuestionRepo {
  readonly #byId = new Map<string, Question>();

  /** Test-only. Not part of `QuestionRepo`. */
  count(): number {
    return this.#byId.size;
  }

  async get(tenantId: TenantId, questionId: QuestionId): Promise<Question | null> {
    const id = asQuestionId(questionId);
    const tid = asTenantId(tenantId);
    const question = this.#byId.get(id);
    if (!question || question.tenantId !== tid) return null;
    return copyQuestion(question);
  }

  async list(tenantId: TenantId): Promise<Question[]> {
    const tid = asTenantId(tenantId);
    const found: Question[] = [];
    for (const question of this.#byId.values()) {
      if (question.tenantId === tid) found.push(copyQuestion(question));
    }
    return found;
  }

  async create(question: Question): Promise<Question> {
    const stored = storedQuestion(question);
    assertSchemaVersion(stored);
    if (this.#byId.has(stored.id)) {
      throw new DomainError('CONFLICT', { reason: 'question-exists' });
    }
    this.#byId.set(stored.id, stored);
    return copyQuestion(stored);
  }

  async update(question: Question): Promise<Question> {
    const next = storedQuestion(question);
    assertSchemaVersion(next);
    const current = this.#byId.get(next.id);
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
    const saved = copyQuestion({
      ...next,
      id: current.id,
      tenantId: current.tenantId,
      type: current.type,
      authoredBy: current.authoredBy,
      createdAt: current.createdAt,
      schemaVersion: QUESTION_SCHEMA_VERSION,
    });
    this.#byId.set(saved.id, saved);
    return copyQuestion(saved);
  }
}
