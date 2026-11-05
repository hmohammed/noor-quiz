import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isDomainError, type DomainErrorCode } from '@noor/core';
import { runQuestionRepoContract } from '@noor/testkit';
import { FirestoreQuestionRepo } from './question-repo';

function requireEmulator(env: Record<string, string | undefined>): void {
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run `npm run test:emulator`.');
  }
}

let app: App | undefined;
let db: Firestore;

beforeAll(() => {
  requireEmulator(process.env);
  app = initializeApp({ projectId: 'demo-noor' }, 'question-repo-contract');
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clear(): Promise<void> {
  await db.recursiveDelete(db.collection('questions'));
}

async function count(): Promise<number> {
  const snap = await db.collection('questions').count().get();
  return snap.data().count;
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode): Promise<unknown> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
  return err;
}

runQuestionRepoContract(async () => {
  await clear();
  return { questions: new FirestoreQuestionRepo(db), count };
});

describe('Firestore question repo (emulator only)', () => {
  const QUESTION = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

  beforeEach(async () => {
    await clear();
  });

  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('rejects a corrupt question doc as INTERNAL with a reason only', async () => {
    await db
      .collection('questions')
      .doc(QUESTION)
      .set({ id: QUESTION, schemaVersion: 2, topic: 'secret' });
    const err = await expectDomainError(
      new FirestoreQuestionRepo(db).get(QUESTION as never, QUESTION as never),
      'INTERNAL',
    );
    expect((err as { details?: unknown }).details).toEqual({ reason: 'corrupt-question-doc' });
    expect(JSON.stringify(err)).not.toContain('secret');
  });
});
