import { describe, expect, it } from 'vitest';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import { instantFromIso } from '../time/instant';
import { createQuestion } from './create-question';
import { listQuestions } from './list-questions';
import { MemoryQuestionRepo } from './memory-question-repo';

const TENANT_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const TENANT_B = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const EMPTY = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const IDS = [
  '01ARZ3NDEKTSV4RRFFQ69G5FB2',
  '01ARZ3NDEKTSV4RRFFQ69G5FB3',
  '01ARZ3NDEKTSV4RRFFQ69G5FB4',
  '01ARZ3NDEKTSV4RRFFQ69G5FB5',
];

const base = {
  userId: USER,
  difficulty: 'beginner',
  topic: 'fasting',
  locales: {
    en: {
      title: 'The fast',
      prompt: 'Which verse commands fasting?',
      choices: ['2:183', '1:1'],
      explanation: '',
    },
  },
  answer: { choiceIndex: 0 },
  sources: [{ kind: 'quran', ref: '2:183' }],
};

function mutableClock(start: string): { clock: Clock; set(iso: string): void } {
  let current = instantFromIso(start);
  return {
    clock: { now: () => current },
    set(iso: string) {
      current = instantFromIso(iso);
    },
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

describe('listQuestions', () => {
  it('returns only that tenant, newest createdAt then id, and [] when empty', async () => {
    const questions = new MemoryQuestionRepo();
    const time = mutableClock('2026-01-01T00:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), questions };

    const older = await createQuestion(deps, { ...base, tenantId: TENANT_A, topic: 'older' });
    const sameInstant = await createQuestion(deps, {
      ...base,
      tenantId: TENANT_A,
      topic: 'same',
    });
    expect(older.createdAt).toBe(sameInstant.createdAt);
    expect(sameInstant.id > older.id).toBe(true);

    time.set('2026-01-02T00:00:00.000Z');
    const newest = await createQuestion(deps, { ...base, tenantId: TENANT_A, topic: 'newest' });
    await createQuestion(deps, { ...base, tenantId: TENANT_B, topic: 'other' });

    const listed = await listQuestions({ questions }, { tenantId: TENANT_A });
    expect(listed.map((question) => question.id)).toEqual([newest.id, sameInstant.id, older.id]);
    expect(listed.every((question) => question.tenantId === TENANT_A)).toBe(true);
    expect(listed.map((question) => question.topic)).not.toContain('other');
    expect(listed[0]?.answer.choiceIndex).toBe(0);

    expect(await listQuestions({ questions }, { tenantId: EMPTY })).toEqual([]);
    expect(await listQuestions({ questions }, { tenantId: TENANT_B })).toHaveLength(1);
  });
});
