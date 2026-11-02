import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateUser, isDomainError, type DomainErrorCode, type UserId } from '@noor/core';
import { FakeClock, FakeIdGenerator, runUserRepoContract } from '@noor/testkit';
import { FirestoreUserRepo } from './user-repo';

/** Refuses to run unless the admin SDK is pointed at the emulator, never a real project. */
function requireEmulator(env: Record<string, string | undefined>): void {
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run `npm run test:emulator`.');
  }
}

let app: App | undefined;
let db: Firestore;

beforeAll(() => {
  requireEmulator(process.env);
  app = initializeApp({ projectId: 'demo-noor' }, 'user-repo-contract');
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clear(): Promise<void> {
  await db.recursiveDelete(db.collection('users'));
  await db.recursiveDelete(db.collection('identities'));
}

async function counts(): Promise<{ users: number; identities: number }> {
  const [users, identities] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('identities').count().get(),
  ]);
  return { users: users.data().count, identities: identities.data().count };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode): Promise<void> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

runUserRepoContract('FirestoreUserRepo (emulator)', async () => {
  await clear();
  return { repo: new FirestoreUserRepo(db), counts };
});

describe('FirestoreUserRepo (emulator only)', () => {
  const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
  const AT = '2026-01-01T00:00:00.000Z';
  let repo: FirestoreUserRepo;

  beforeEach(async () => {
    await clear();
    repo = new FirestoreUserRepo(db);
  });

  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('stores exactly the documented doc shapes with ISO string timestamps', async () => {
    const clock = new FakeClock();
    const user = await getOrCreateUser(
      { clock, ids: new FakeIdGenerator(), users: repo },
      {
        provider: 'firebase',
        subject: 'uid-alice',
        email: 'alice@example.com',
        emailVerified: true,
        name: 'Alice',
      },
    );

    const userRaw = (await db.collection('users').doc(user.id).get()).data();
    expect(userRaw).toStrictEqual({
      id: user.id,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    });

    const identityRaw = (await db.collection('identities').doc('firebase_uid-alice').get()).data();
    expect(identityRaw).toStrictEqual({
      id: 'firebase_uid-alice',
      provider: 'firebase',
      subject: 'uid-alice',
      userId: user.id,
      email: 'alice@example.com',
      emailVerified: true,
      createdAt: AT,
      schemaVersion: 1,
    });
  });

  it('rejects an identity that links to a missing user with INTERNAL and writes no user', async () => {
    await db.collection('identities').doc('firebase_uid-alice').set({
      id: 'firebase_uid-alice',
      provider: 'firebase',
      subject: 'uid-alice',
      userId: ULID,
      email: null,
      emailVerified: false,
      createdAt: AT,
      schemaVersion: 1,
    });

    await expectDomainError(
      repo.getByIdentity({ provider: 'firebase', subject: 'uid-alice' }),
      'INTERNAL',
    );
    const otherId = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
    await expectDomainError(
      repo.createWithIdentity(
        {
          id: otherId,
          displayName: null,
          locale: null,
          timezone: null,
          createdAt: AT,
          updatedAt: AT,
          schemaVersion: 1,
        },
        {
          id: 'firebase_uid-alice',
          provider: 'firebase',
          subject: 'uid-alice',
          userId: otherId,
          email: null,
          emailVerified: false,
          createdAt: AT,
          schemaVersion: 1,
        },
      ),
      'INTERNAL',
    );
    expect(await counts()).toEqual({ users: 0, identities: 1 });
  });

  it.each([
    ['schemaVersion 2', { schemaVersion: 2 }],
    ['a missing createdAt', { createdAt: undefined }],
  ])('rejects a users doc with %s as INTERNAL', async (_label, patch) => {
    const doc: Record<string, unknown> = {
      id: ULID,
      displayName: 'Alice',
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
      ...patch,
    };
    for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
    await db.collection('users').doc(ULID).set(doc);

    await expectDomainError(repo.getById(ULID), 'INTERNAL');
  });

  it('reads a users doc written before T011 (no locale/timezone) as null and can update it', async () => {
    const legacy = { id: ULID, displayName: 'Alice', createdAt: AT, updatedAt: AT, schemaVersion: 1 };
    await db.collection('users').doc(ULID).set(legacy);

    expect(await repo.getById(ULID)).toStrictEqual({ ...legacy, locale: null, timezone: null });

    const later = '2026-02-01T00:00:00.000Z';
    const updated = await repo.updateProfile(ULID, { timezone: 'Africa/Addis_Ababa' }, later);

    expect(updated).toStrictEqual({
      ...legacy,
      locale: null,
      timezone: 'Africa/Addis_Ababa',
      updatedAt: later,
    });
    expect(await repo.getById(ULID)).toStrictEqual(updated);
    const raw = (await db.collection('users').doc(ULID).get()).data();
    expect(raw).toStrictEqual({ ...legacy, timezone: 'Africa/Addis_Ababa', updatedAt: later });
  });
});
