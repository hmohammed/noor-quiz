import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isDomainError, type DomainErrorCode } from '@noor/core';
import { runScheduleRepoContract } from '@noor/testkit';
import { FirestoreScheduleRepo } from './schedule-repo';

function requireEmulator(env: Record<string, string | undefined>): void {
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run `npm run test:emulator`.');
  }
}

let app: App | undefined;
let db: Firestore;

beforeAll(() => {
  requireEmulator(process.env);
  app = initializeApp({ projectId: 'demo-noor' }, 'schedule-repo-contract');
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clear(): Promise<void> {
  await db.recursiveDelete(db.collection('schedule'));
}

async function count(): Promise<number> {
  const snap = await db.collection('schedule').count().get();
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

runScheduleRepoContract(async () => {
  await clear();
  return { schedules: new FirestoreScheduleRepo(db), count };
});

describe('Firestore schedule repo (emulator only)', () => {
  const SEASON = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

  beforeEach(async () => {
    await clear();
  });

  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('rejects a corrupt schedule doc as INTERNAL with a reason only', async () => {
    const id = `${SEASON}_3`;
    await db.collection('schedule').doc(id).set({ id, schemaVersion: 2, questionId: 'secret' });
    const err = await expectDomainError(
      new FirestoreScheduleRepo(db).get(SEASON as never, SEASON as never, 3),
      'INTERNAL',
    );
    expect((err as { details?: unknown }).details).toEqual({ reason: 'corrupt-schedule-doc' });
    expect(JSON.stringify(err)).not.toContain('secret');
  });
});
