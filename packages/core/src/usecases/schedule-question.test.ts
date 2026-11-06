import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { QuestionRepo, ScheduleRepo, SeasonRepo } from '../ports/repos';
import type { Question } from '../questions/question';
import type { CommunitySeason } from '../season/community-season';
import { instantFromIso, type Instant } from '../time/instant';
import { MemoryQuestionRepo } from './memory-question-repo';
import { MemoryScheduleRepo } from './memory-schedule-repo';
import { MemorySeasonRepo } from './memory-season-repo';
import { scheduleQuestion } from './schedule-question';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const SEASON_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const QUESTION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const OTHER_Q = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const AT = '2026-11-06T12:05:00.000Z';

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

function season(overrides: Partial<CommunitySeason> = {}): CommunitySeason {
  return {
    id: SEASON_ID as CommunitySeason['id'],
    tenantId: TENANT as CommunitySeason['tenantId'],
    name: 'Ramadan 1448',
    kind: 'ramadan',
    startDate: '2035-01-01',
    lengthDays: 30,
    timezone: 'Europe/Stockholm',
    opensAtLocal: '08:00',
    closesAtLocal: '21:00',
    createdBy: USER as CommunitySeason['createdBy'],
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 1,
    ...overrides,
  };
}

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: QUESTION_ID as Question['id'],
    tenantId: TENANT as Question['tenantId'],
    type: 'mcq',
    difficulty: 'beginner',
    topic: 'fasting',
    locales: {
      en: {
        title: 'The fast',
        prompt: 'Which verse?',
        choices: ['2:183', '1:1'],
        explanation: 'Al-Baqarah.',
      },
    },
    answer: { choiceIndex: 0 },
    sources: [{ kind: 'quran', ref: '2:183' }],
    reviewStatus: 'approved',
    reviewNotes: 'ok',
    authoredBy: USER as Question['authoredBy'],
    reviewedBy: USER as Question['reviewedBy'],
    reviewedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 1,
    ...overrides,
  };
}

function setup(opts: { season?: CommunitySeason | false; question?: Question | false } = {}) {
  const seasons = new MemorySeasonRepo();
  const questions = new MemoryQuestionRepo();
  const schedules = new MemoryScheduleRepo();
  let puts = 0;
  const scheduleRepo: ScheduleRepo = {
    get: (tenantId, seasonId, dayIndex) => schedules.get(tenantId, seasonId, dayIndex),
    listBySeason: (tenantId, seasonId) => schedules.listBySeason(tenantId, seasonId),
    async put(entry) {
      puts += 1;
      return schedules.put(entry);
    },
  };
  const clock = clockAt(AT);
  return {
    seasons,
    questions,
    schedules,
    clock,
    puts: () => puts,
    async seed() {
      if (opts.season !== false) await seasons.create(opts.season ?? season());
      if (opts.question !== false) await questions.create(opts.question ?? question());
    },
    run: (input: { dayIndex?: number; questionId?: string } = {}) =>
      scheduleQuestion(
        { clock, seasons, questions, schedules: scheduleRepo },
        {
          tenantId: TENANT,
          seasonId: SEASON_ID,
          dayIndex: input.dayIndex ?? 3,
          questionId: input.questionId ?? QUESTION_ID,
          userId: USER,
        },
      ),
  };
}

describe('scheduleQuestion', () => {
  it('puts an approved question on a valid day with scheduledBy and clock time', async () => {
    const { seed, run, clock, puts, schedules } = setup();
    await seed();
    const entry = await run({ dayIndex: 3 });
    expect(entry).toMatchObject({
      id: `${SEASON_ID}_3`,
      tenantId: TENANT,
      seasonId: SEASON_ID,
      dayIndex: 3,
      questionId: QUESTION_ID,
      scheduledBy: USER,
      scheduledAt: AT,
      schemaVersion: 1,
    });
    expect(clock.reads()).toBe(1);
    expect(puts()).toBe(1);
    expect(await schedules.get(TENANT as never, SEASON_ID as never, 3)).toEqual(entry);
  });

  it('overwrites the same day and rejects the same question on another day', async () => {
    const { seed, run, schedules, questions } = setup();
    await seed();
    await questions.create(question({ id: OTHER_Q as Question['id'] }));
    const first = await run({ dayIndex: 1, questionId: QUESTION_ID });
    const replaced = await run({ dayIndex: 1, questionId: OTHER_Q });
    expect(replaced.questionId).toBe(OTHER_Q);
    expect(await schedules.get(TENANT as never, SEASON_ID as never, 1)).toEqual(replaced);
    expect(first.dayIndex).toBe(1);

    const error = await run({ dayIndex: 2, questionId: OTHER_Q }).then(
      () => expect.fail('expected CONFLICT'),
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('CONFLICT');
    expect(await schedules.get(TENANT as never, SEASON_ID as never, 1)).toEqual(replaced);
    expect(await schedules.get(TENANT as never, SEASON_ID as never, 2)).toBeNull();
  });

  it.each(['draft', 'in_review', 'rejected'] as const)(
    'throws CONFLICT when the question is %s and writes nothing',
    async (reviewStatus) => {
      const { seed, run, puts, schedules } = setup({
        question: question({ reviewStatus }),
      });
      await seed();
      const error = await run().then(
        () => expect.fail('expected CONFLICT'),
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('CONFLICT');
      expect(puts()).toBe(0);
      expect(schedules.all()).toEqual([]);
    },
  );

  it('throws NOT_FOUND for a missing season or question', async () => {
    const missingSeason = setup({ season: false });
    await missingSeason.seed();
    const seasonError = await missingSeason.run().then(
      () => expect.fail('expected NOT_FOUND'),
      (caught: unknown) => caught,
    );
    expect(seasonError).toBeInstanceOf(DomainError);
    expect((seasonError as DomainError).code).toBe('NOT_FOUND');

    const missingQuestion = setup({ question: false });
    await missingQuestion.seed();
    const questionError = await missingQuestion.run().then(
      () => expect.fail('expected NOT_FOUND'),
      (caught: unknown) => caught,
    );
    expect(questionError).toBeInstanceOf(DomainError);
    expect((questionError as DomainError).code).toBe('NOT_FOUND');
  });

  it('throws VALIDATION for a dayIndex outside 1..lengthDays or a non-integer', async () => {
    const { seed, run, puts } = setup({ season: season({ lengthDays: 10 }) });
    await seed();
    for (const dayIndex of [0, -1, 11, 1.5, Number.NaN]) {
      const error = await run({ dayIndex }).then(
        () => expect.fail(`expected VALIDATION for ${dayIndex}`),
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION');
    }
    expect(puts()).toBe(0);
  });

  it('does not call put when the question is already scheduled elsewhere', async () => {
    const put = vi.fn();
    const seasons: SeasonRepo = {
      get: async () => season(),
      list: async () => [],
      create: async (s) => s,
      update: async (s) => s,
    };
    const questions: QuestionRepo = {
      get: async () => question(),
      list: async () => [],
      create: async (q) => q,
      update: async (q) => q,
    };
    const schedules: ScheduleRepo = {
      get: async () => null,
      listBySeason: async () => [
        {
          id: `${SEASON_ID}_1`,
          tenantId: TENANT as never,
          seasonId: SEASON_ID as never,
          dayIndex: 1,
          questionId: QUESTION_ID as never,
          scheduledBy: USER as never,
          scheduledAt: AT,
          schemaVersion: 1,
        },
      ],
      put,
    };
    const error = await scheduleQuestion(
      { clock: clockAt(AT), seasons, questions, schedules },
      {
        tenantId: TENANT,
        seasonId: SEASON_ID,
        dayIndex: 2,
        questionId: QUESTION_ID,
        userId: USER,
      },
    ).then(
      () => expect.fail('expected CONFLICT'),
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('CONFLICT');
    expect(put).not.toHaveBeenCalled();
  });
});
