import { describe, expect, it } from 'vitest';
import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { QuestionRepo } from '../ports/repos';
import { instantFromIso, toIso, type Instant } from '../time/instant';
import { createQuestion } from './create-question';
import { MemoryQuestionRepo } from './memory-question-repo';
import { updateQuestion } from './update-question';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const IDS = ['01ARZ3NDEKTSV4RRFFQ69G5FB1', '01ARZ3NDEKTSV4RRFFQ69G5FB2'];
const AT = '2026-11-05T09:00:00.000Z';
const LATER = '2026-11-05T10:00:00.000Z';

const INPUT = {
  tenantId: TENANT,
  userId: USER,
  difficulty: 'beginner',
  topic: 'fasting',
  locales: {
    en: {
      title: 'The fast',
      prompt: 'Which verse commands fasting?',
      choices: ['2:183', '1:1'],
      explanation: 'Al-Baqarah.',
    },
  },
  answer: { choiceIndex: 0 },
  sources: [{ kind: 'quran', ref: '2:183' }],
};

function mutableClock(start: string): {
  clock: Clock;
  set(iso: string): void;
  reads(): number;
} {
  let current = instantFromIso(start);
  let reads = 0;
  return {
    clock: {
      now(): Instant {
        reads += 1;
        return current;
      },
    },
    set(iso: string) {
      current = instantFromIso(iso);
    },
    reads: () => reads,
  };
}

function ids(): IdGenerator {
  let index = 0;
  return {
    newId() {
      const id = IDS[index];
      index += 1;
      if (id === undefined) throw new Error('no more ids');
      return id;
    },
  };
}

function counting(repo: MemoryQuestionRepo): { questions: QuestionRepo; updates(): number } {
  let updates = 0;
  return {
    updates: () => updates,
    questions: {
      get: (tenantId, questionId) => repo.get(tenantId, questionId),
      list: (tenantId) => repo.list(tenantId),
      create: (question) => repo.create(question),
      async update(question) {
        updates += 1;
        return repo.update(question);
      },
    },
  };
}

async function expectCode(run: Promise<unknown>, code: string): Promise<void> {
  const error = await run.then(
    () => expect.fail(`expected ${code}`),
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

describe('updateQuestion', () => {
  it('changes one field, keeps identity, and sets updatedAt from the clock', async () => {
    const repo = new MemoryQuestionRepo();
    const time = mutableClock(AT);
    const counted = counting(repo);
    const deps = { clock: time.clock, ids: ids(), questions: counted.questions };
    const created = await createQuestion(deps, INPUT);
    time.set(LATER);
    const readsBefore = time.reads();

    const updated = await updateQuestion(deps, {
      tenantId: TENANT,
      questionId: created.id,
      patch: { topic: '  prayer  ' },
    });

    expect(updated.topic).toBe('prayer');
    expect(updated.id).toBe(created.id);
    expect(updated.tenantId).toBe(created.tenantId);
    expect(updated.type).toBe(created.type);
    expect(updated.reviewStatus).toBe('draft');
    expect(updated.reviewNotes).toBe('');
    expect(updated.authoredBy).toBe(created.authoredBy);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.schemaVersion).toBe(created.schemaVersion);
    expect(updated.updatedAt).toBe(LATER);
    expect(updated.updatedAt).toBe(toIso(instantFromIso(LATER)));
    expect(time.reads()).toBe(readsBefore + 1);
    expect(counted.updates()).toBe(1);
    expect(repo.all()).toEqual([updated]);
  });

  it('throws VALIDATION for an empty patch and does not call questions.update', async () => {
    const repo = new MemoryQuestionRepo();
    const time = mutableClock(AT);
    const counted = counting(repo);
    const deps = { clock: time.clock, ids: ids(), questions: counted.questions };
    const created = await createQuestion(deps, INPUT);
    await expectCode(
      updateQuestion(deps, { tenantId: TENANT, questionId: created.id, patch: {} }),
      'VALIDATION',
    );
    expect(counted.updates()).toBe(0);
    expect(repo.all()[0]?.topic).toBe('fasting');
  });

  it('throws NOT_FOUND for an unknown id and for another tenant, and writes nothing', async () => {
    const repo = new MemoryQuestionRepo();
    const time = mutableClock(AT);
    const counted = counting(repo);
    const deps = { clock: time.clock, ids: ids(), questions: counted.questions };
    const created = await createQuestion(deps, INPUT);
    await expectCode(
      updateQuestion(deps, {
        tenantId: TENANT,
        questionId: IDS[1] ?? '',
        patch: { topic: 'prayer' },
      }),
      'NOT_FOUND',
    );
    await expectCode(
      updateQuestion(deps, {
        tenantId: asTenantId(OTHER),
        questionId: created.id,
        patch: { topic: 'prayer' },
      }),
      'NOT_FOUND',
    );
    expect(counted.updates()).toBe(0);
    expect(repo.all()).toEqual([created]);
  });

  it('throws VALIDATION for a non-ULID id', async () => {
    const repo = new MemoryQuestionRepo();
    const time = mutableClock(AT);
    const counted = counting(repo);
    const deps = { clock: time.clock, ids: ids(), questions: counted.questions };
    await createQuestion(deps, INPUT);
    await expectCode(
      updateQuestion(deps, { tenantId: TENANT, questionId: 'nope', patch: { topic: 'prayer' } }),
      'VALIDATION',
    );
    expect(counted.updates()).toBe(0);
  });

  it('throws VALIDATION for a bad choiceIndex and does not call questions.update', async () => {
    const repo = new MemoryQuestionRepo();
    const time = mutableClock(AT);
    const counted = counting(repo);
    const deps = { clock: time.clock, ids: ids(), questions: counted.questions };
    const created = await createQuestion(deps, INPUT);
    await expectCode(
      updateQuestion(deps, {
        tenantId: TENANT,
        questionId: created.id,
        patch: { answer: { choiceIndex: 2 } },
      }),
      'VALIDATION',
    );
    expect(counted.updates()).toBe(0);
    expect(repo.all()[0]?.answer.choiceIndex).toBe(0);
  });
});
