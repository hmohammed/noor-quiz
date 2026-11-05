import { describe, expect, it } from 'vitest';
import {
  asQuestionId,
  asTenantId,
  isDomainError,
  QUESTION_SCHEMA_VERSION,
  type DomainErrorCode,
  type Question,
  type QuestionId,
  type QuestionRepo,
  type TenantId,
  type UserId,
} from '@noor/core';

export interface QuestionRepoHarness {
  questions: QuestionRepo;
  count(): Promise<number>;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const AT = '2024-05-06T07:08:09.123Z';
const LATER = '2024-06-01T00:00:00.000Z';

function ulid(n: number): string {
  let rest = n;
  let body = '';
  for (let i = 0; i < 25; i++) {
    body = ALPHABET[rest % 32]! + body;
    rest = Math.floor(rest / 32);
  }
  return `0${body}`;
}

const TENANT_A = ulid(1) as TenantId;
const TENANT_B = ulid(2) as TenantId;
const USER_A = ulid(3) as UserId;
const USER_B = ulid(4) as UserId;

function question(id: number, tenantId: TenantId, overrides: Partial<Question> = {}): Question {
  return {
    id: ulid(id) as QuestionId,
    tenantId,
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
    authoredBy: USER_A,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: QUESTION_SCHEMA_VERSION,
    ...overrides,
  };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode): Promise<void> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

/**
 * Behaviour every question repository must have. Runs against the in-memory repo and
 * against the Firestore repo on the emulator. `makeImpl` must return an empty repo.
 */
export function runQuestionRepoContract(makeImpl: () => Promise<QuestionRepoHarness>): void {
  describe('question repo contract', () => {
    it('creates a question and get reads it back only for that tenant', async () => {
      const { questions, count } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));

      expect(created).toEqual(question(10, TENANT_A));
      expect(await questions.get(TENANT_A, created.id)).toEqual(created);
      expect(await questions.get(TENANT_B, created.id)).toBeNull();
      expect(await count()).toBe(1);
    });

    it('lists only the requested tenant', async () => {
      const { questions } = await makeImpl();
      const first = await questions.create(question(10, TENANT_A, { topic: 'first' }));
      const second = await questions.create(question(11, TENANT_A, { topic: 'second' }));
      const other = await questions.create(question(12, TENANT_B, { topic: 'other' }));

      const listed = await questions.list(TENANT_A);
      expect(listed).toHaveLength(2);
      expect(listed.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
      expect(listed.every((item) => item.tenantId === TENANT_A)).toBe(true);
      expect(await questions.list(TENANT_B)).toEqual([other]);
      expect(await questions.list(ulid(99) as TenantId)).toEqual([]);
    });

    it('updates content fields and keeps id, tenantId, type, authoredBy, createdAt and schemaVersion', async () => {
      const { questions } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));
      const next: Question = {
        ...created,
        difficulty: 'scholar',
        topic: 'prayer',
        locales: {
          en: {
            title: 'Prayer',
            prompt: 'How many daily prayers?',
            choices: ['five', 'three', 'one'],
            explanation: 'The five daily prayers.',
          },
        },
        answer: { choiceIndex: 0 },
        sources: [{ kind: 'hadith', ref: 'Bukhari 527' }],
        reviewNotes: 'wording checked',
        updatedAt: LATER,
      };

      const updated = await questions.update(next);

      expect(updated).toEqual(next);
      expect(updated.id).toBe(created.id);
      expect(updated.tenantId).toBe(created.tenantId);
      expect(updated.type).toBe(created.type);
      expect(updated.reviewStatus).toBe(created.reviewStatus);
      expect(updated.authoredBy).toBe(created.authoredBy);
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.schemaVersion).toBe(created.schemaVersion);
      expect(await questions.get(TENANT_A, created.id)).toEqual(updated);
    });

    it('rejects a second create of the same id with CONFLICT and writes nothing', async () => {
      const { questions, count } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));
      await expectDomainError(
        questions.create(question(10, TENANT_B, { topic: 'taken', authoredBy: USER_B })),
        'CONFLICT',
      );
      expect(await count()).toBe(1);
      expect(await questions.get(TENANT_A, created.id)).toEqual(created);
      expect(await questions.get(TENANT_B, created.id)).toBeNull();
    });

    it('round-trips a draft whose sources are empty', async () => {
      const { questions } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A, { sources: [] }));
      expect(created.sources).toEqual([]);
      expect(await questions.get(TENANT_A, created.id)).toEqual(created);
    });

    it('rejects a non-ULID id, a non-ULID tenantId and a bad schemaVersion with VALIDATION and writes nothing', async () => {
      const { questions, count } = await makeImpl();
      await expectDomainError(
        questions.create(question(10, TENANT_A, { id: 'nope' as QuestionId })),
        'VALIDATION',
      );
      await expectDomainError(
        questions.create(question(10, TENANT_A, { tenantId: 'nope' as TenantId })),
        'VALIDATION',
      );
      await expectDomainError(
        questions.create(question(10, TENANT_A, { schemaVersion: 2 as 1 })),
        'VALIDATION',
      );
      expect(await count()).toBe(0);
    });

    it('rejects an update that changes type, authoredBy, createdAt or schemaVersion with VALIDATION and writes nothing', async () => {
      const { questions } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));

      await expectDomainError(
        questions.update({ ...created, type: 'true_false' as 'mcq' }),
        'VALIDATION',
      );
      await expectDomainError(questions.update({ ...created, authoredBy: USER_B }), 'VALIDATION');
      await expectDomainError(questions.update({ ...created, createdAt: LATER }), 'VALIDATION');
      await expectDomainError(
        questions.update({ ...created, schemaVersion: 2 as 1 }),
        'VALIDATION',
      );
      expect(await questions.get(TENANT_A, created.id)).toEqual(created);
    });

    it('rejects a missing id and a tenant mismatch with NOT_FOUND and writes nothing', async () => {
      const { questions, count } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));

      await expectDomainError(
        questions.update({ ...created, id: asQuestionId(ulid(80)) }),
        'NOT_FOUND',
      );
      await expectDomainError(
        questions.update({ ...created, tenantId: asTenantId(ulid(81)) }),
        'NOT_FOUND',
      );
      expect(await count()).toBe(1);
      expect(await questions.get(TENANT_A, created.id)).toEqual(created);
    });

    it('returns copies, so a caller cannot change the stored question', async () => {
      const { questions } = await makeImpl();
      const created = await questions.create(question(10, TENANT_A));
      created.topic = 'Changed';
      const choices = created.locales.en?.choices;
      if (choices) choices[0] = 'Changed';
      expect((await questions.get(TENANT_A, created.id))?.topic).toBe('fasting');
      expect((await questions.get(TENANT_A, created.id))?.locales.en?.choices[0]).toBe('2:183');
    });
  });
}
