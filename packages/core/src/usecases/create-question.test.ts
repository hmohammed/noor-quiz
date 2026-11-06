import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { QuestionRepo } from '../ports/repos';
import { instantFromIso, type Instant } from '../time/instant';
import { createQuestion } from './create-question';
import { MemoryQuestionRepo } from './memory-question-repo';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const QUESTION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const AT = '2026-11-05T09:00:00.000Z';

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

function clockAt(iso: string): Clock & { reads(): number } {
  const now = instantFromIso(iso);
  let reads = 0;
  return {
    now(): Instant {
      reads += 1;
      return now;
    },
    reads: () => reads,
  };
}

function ids(values: string[]): IdGenerator & { reads(): number } {
  let index = 0;
  return {
    newId() {
      const id = values[index];
      index += 1;
      if (id === undefined) throw new Error('no more ids');
      return id;
    },
    reads: () => index,
  };
}

function setup() {
  const repo = new MemoryQuestionRepo();
  let creates = 0;
  const questions: QuestionRepo = {
    get: (tenantId, questionId) => repo.get(tenantId, questionId),
    list: (tenantId) => repo.list(tenantId),
    async create(question) {
      creates += 1;
      return repo.create(question);
    },
    update: (question) => repo.update(question),
  };
  const clock = clockAt(AT);
  const idSource = ids([QUESTION_ID]);
  return {
    repo,
    clock,
    creates: () => creates,
    run: (input: typeof INPUT = INPUT) =>
      createQuestion({ clock, ids: idSource, questions }, input),
    idReads: () => idSource.reads(),
  };
}

async function expectValidation(
  run: Promise<unknown>,
  creates: () => number,
  repo: MemoryQuestionRepo,
): Promise<void> {
  const error = await run.then(
    () => expect.fail('expected VALIDATION'),
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe('VALIDATION');
  expect(creates()).toBe(0);
  expect(repo.all()).toEqual([]);
}

describe('createQuestion', () => {
  it('stores a draft mcq with the caller as author and one clock read', async () => {
    const { repo, clock, creates, run } = setup();
    const question = await run();
    expect(question.type).toBe('mcq');
    expect(question.reviewStatus).toBe('draft');
    expect(question.reviewNotes).toBe('');
    expect(question.reviewedBy).toBeNull();
    expect(question.reviewedAt).toBeNull();
    expect(question.authoredBy).toBe(USER);
    expect(question.tenantId).toBe(TENANT);
    expect(question.id).toBe(QUESTION_ID);
    expect(question.schemaVersion).toBe(1);
    expect(question.createdAt).toBe(AT);
    expect(question.updatedAt).toBe(AT);
    expect(question.answer.choiceIndex).toBe(0);
    expect(clock.reads()).toBe(1);
    expect(creates()).toBe(1);
    expect(repo.all()).toEqual([question]);
  });

  it('trims text, keeps inner spaces, and does not NFC-normalise', async () => {
    const decomposed = 'a\u0301';
    const { run } = setup();
    const question = await run({
      ...INPUT,
      topic: '  fasting  day  ',
      locales: {
        en: {
          ...INPUT.locales.en,
          prompt: `  ${decomposed}  verse  `,
        },
      },
    });
    expect(question.topic).toBe('fasting  day');
    expect(question.locales.en?.prompt).toBe(`${decomposed}  verse`);
    expect(question.locales.en?.prompt.normalize('NFC')).not.toBe(question.locales.en?.prompt);
  });

  it.each([
    ['one choice', { locales: { en: { ...INPUT.locales.en, choices: ['only'] } } }],
    ['no choices', { locales: { en: { ...INPUT.locales.en, choices: [] } } }],
  ])('throws VALIDATION for %s and does not call questions.create', async (_label, patch) => {
    const { repo, creates, run } = setup();
    await expectValidation(run({ ...INPUT, ...patch }), creates, repo);
  });

  it.each([
    ['a missing choiceIndex', { answer: {} as { choiceIndex: number } }],
    ['a fractional choiceIndex', { answer: { choiceIndex: 1.5 } }],
    ['a negative choiceIndex', { answer: { choiceIndex: -1 } }],
    ['a choiceIndex past the end', { answer: { choiceIndex: 2 } }],
  ])('throws VALIDATION for %s and does not call questions.create', async (_label, patch) => {
    const { repo, creates, run } = setup();
    await expectValidation(run({ ...INPUT, ...patch }), creates, repo);
  });

  it('throws VALIDATION for empty sources and does not call questions.create', async () => {
    const { repo, creates, run, idReads, clock } = setup();
    await expectValidation(run({ ...INPUT, sources: [] }), creates, repo);
    expect(idReads()).toBe(0);
    expect(clock.reads()).toBe(0);
  });
});
