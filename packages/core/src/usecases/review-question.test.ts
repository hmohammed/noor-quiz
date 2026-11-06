import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { QuestionRepo } from '../ports/repos';
import type { Question } from '../questions/question';
import { instantFromIso, type Instant } from '../time/instant';
import { MemoryQuestionRepo } from './memory-question-repo';
import { reviewQuestion } from './review-question';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const QUESTION_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const AT = '2026-11-05T09:00:00.000Z';
const LATER = '2026-11-06T12:00:00.000Z';

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

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: QUESTION_ID as Question['id'],
    tenantId: TENANT as Question['tenantId'],
    type: 'mcq',
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
    reviewStatus: 'draft',
    reviewNotes: '',
    authoredBy: USER as Question['authoredBy'],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 1,
    ...overrides,
  };
}

function setup(stored: Question = baseQuestion()) {
  const repo = new MemoryQuestionRepo();
  let updates = 0;
  const questions: QuestionRepo = {
    get: (tenantId, questionId) => repo.get(tenantId, questionId),
    list: (tenantId) => repo.list(tenantId),
    create: (question) => repo.create(question),
    async update(question) {
      updates += 1;
      return repo.update(question);
    },
  };
  const clock = clockAt(LATER);
  return {
    repo,
    clock,
    updates: () => updates,
    seed: () => repo.create(stored),
    run: (input: {
      role: string;
      status: 'in_review' | 'approved' | 'rejected';
      notes?: string;
      userId?: string;
    }) =>
      reviewQuestion(
        { clock, questions },
        {
          tenantId: TENANT,
          questionId: QUESTION_ID,
          userId: input.userId ?? USER,
          role: input.role,
          status: input.status,
          notes: input.notes ?? 'please review',
        },
      ),
  };
}

describe('reviewQuestion', () => {
  it('lets an editor move draft or rejected to in_review and clears audit fields', async () => {
    const { seed, run, clock, updates } = setup(baseQuestion({ reviewStatus: 'draft' }));
    await seed();
    const reviewed = await run({ role: 'editor', status: 'in_review', notes: '  check  ' });
    expect(reviewed.reviewStatus).toBe('in_review');
    expect(reviewed.reviewNotes).toBe('check');
    expect(reviewed.reviewedBy).toBeNull();
    expect(reviewed.reviewedAt).toBeNull();
    expect(reviewed.updatedAt).toBe(LATER);
    expect(clock.reads()).toBe(1);
    expect(updates()).toBe(1);

    const again = setup(
      baseQuestion({
        reviewStatus: 'rejected',
        reviewNotes: 'fix',
        reviewedBy: OTHER as Question['reviewedBy'],
        reviewedAt: AT,
      }),
    );
    await again.seed();
    const resubmitted = await again.run({ role: 'admin', status: 'in_review', notes: '' });
    expect(resubmitted.reviewStatus).toBe('in_review');
    expect(resubmitted.reviewedBy).toBeNull();
    expect(resubmitted.reviewedAt).toBeNull();
  });

  it('is idempotent for in_review → in_review and keeps audit null', async () => {
    const { seed, run } = setup(baseQuestion({ reviewStatus: 'in_review', reviewNotes: 'old' }));
    await seed();
    const reviewed = await run({ role: 'editor', status: 'in_review', notes: 'new notes' });
    expect(reviewed.reviewStatus).toBe('in_review');
    expect(reviewed.reviewNotes).toBe('new notes');
    expect(reviewed.reviewedBy).toBeNull();
    expect(reviewed.reviewedAt).toBeNull();
  });

  it('lets a scholar-reviewer approve or reject from in_review with one clock read', async () => {
    const { seed, run, clock } = setup(baseQuestion({ reviewStatus: 'in_review' }));
    await seed();
    const approved = await run({
      role: 'scholar-reviewer',
      status: 'approved',
      notes: 'ok',
      userId: OTHER,
    });
    expect(approved.reviewStatus).toBe('approved');
    expect(approved.reviewedBy).toBe(OTHER);
    expect(approved.reviewedAt).toBe(LATER);
    expect(approved.updatedAt).toBe(LATER);
    expect(approved.reviewNotes).toBe('ok');
    expect(clock.reads()).toBe(1);

    const rejectSetup = setup(baseQuestion({ reviewStatus: 'in_review' }));
    await rejectSetup.seed();
    const rejected = await rejectSetup.run({
      role: 'scholar-reviewer',
      status: 'rejected',
      notes: 'needs source',
    });
    expect(rejected.reviewStatus).toBe('rejected');
    expect(rejected.reviewedBy).toBe(USER);
    expect(rejected.reviewedAt).toBe(LATER);
  });

  it('throws FORBIDDEN when an editor requests approved or rejected', async () => {
    const { seed, run, updates, repo } = setup(baseQuestion({ reviewStatus: 'in_review' }));
    await seed();
    const before = repo.all()[0];
    for (const status of ['approved', 'rejected'] as const) {
      const error = await run({ role: 'editor', status }).then(
        () => expect.fail('expected FORBIDDEN'),
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('FORBIDDEN');
    }
    expect(updates()).toBe(0);
    expect(repo.all()[0]).toEqual(before);
  });

  it('throws FORBIDDEN when a scholar-reviewer requests in_review', async () => {
    const { seed, run, updates } = setup(baseQuestion({ reviewStatus: 'draft' }));
    await seed();
    const error = await run({ role: 'scholar-reviewer', status: 'in_review' }).then(
      () => expect.fail('expected FORBIDDEN'),
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('FORBIDDEN');
    expect(updates()).toBe(0);
  });

  it('throws CONFLICT for illegal transitions and does not update', async () => {
    const cases: Array<{
      from: Question['reviewStatus'];
      status: 'in_review' | 'approved' | 'rejected';
      role: string;
    }> = [
      { from: 'approved', status: 'in_review', role: 'editor' },
      { from: 'approved', status: 'approved', role: 'admin' },
      { from: 'draft', status: 'approved', role: 'admin' },
      { from: 'draft', status: 'rejected', role: 'owner' },
      { from: 'rejected', status: 'approved', role: 'admin' },
      { from: 'rejected', status: 'rejected', role: 'admin' },
    ];
    for (const { from, status, role } of cases) {
      const { seed, run, updates } = setup(baseQuestion({ reviewStatus: from }));
      await seed();
      const error = await run({ role, status }).then(
        () => expect.fail(`expected CONFLICT for ${from} → ${status}`),
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('CONFLICT');
      expect(updates()).toBe(0);
    }
  });

  it('throws NOT_FOUND for a missing question without calling update', async () => {
    const update = vi.fn();
    const questions: QuestionRepo = {
      get: async () => null,
      list: async () => [],
      create: async (q) => q,
      update,
    };
    const error = await reviewQuestion(
      { clock: clockAt(LATER), questions },
      {
        tenantId: TENANT,
        questionId: QUESTION_ID,
        userId: USER,
        role: 'editor',
        status: 'in_review',
        notes: '',
      },
    ).then(
      () => expect.fail('expected NOT_FOUND'),
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('NOT_FOUND');
    expect(update).not.toHaveBeenCalled();
  });
});
