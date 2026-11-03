import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_CONSENT_VERSION,
  getOrCreateUser,
  isDomainError,
  USER_SCHEMA_VERSION,
  type DomainErrorCode,
  type Identity,
  type UserId,
} from '@noor/core';
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

async function addIdentity(identity: Identity): Promise<void> {
  await db.collection('identities').doc(identity.id).set({
    id: identity.id,
    provider: identity.provider,
    subject: identity.subject,
    userId: identity.userId,
    email: identity.email,
    emailVerified: identity.emailVerified,
    createdAt: identity.createdAt,
    schemaVersion: identity.schemaVersion,
  });
}

runUserRepoContract('FirestoreUserRepo (emulator)', async () => {
  await clear();
  return { repo: new FirestoreUserRepo(db), counts, addIdentity };
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
      consent: null,
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
          consent: null,
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
    ['an extra key in consent', { consent: { version: 'v', acceptedAt: AT, extra: 1 } }],
    ['a string consent', { consent: 'yes' }],
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
    const legacy = {
      id: ULID,
      displayName: 'Alice',
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    };
    await db.collection('users').doc(ULID).set(legacy);

    expect(await repo.getById(ULID)).toStrictEqual({
      ...legacy,
      locale: null,
      timezone: null,
      consent: null,
    });

    const later = '2026-02-01T00:00:00.000Z';
    const updated = await repo.updateProfile(ULID, { timezone: 'Africa/Addis_Ababa' }, later);

    expect(updated).toStrictEqual({
      ...legacy,
      locale: null,
      timezone: 'Africa/Addis_Ababa',
      consent: null,
      updatedAt: later,
    });
    expect(await repo.getById(ULID)).toStrictEqual(updated);
    const raw = (await db.collection('users').doc(ULID).get()).data();
    expect(raw).toStrictEqual({ ...legacy, timezone: 'Africa/Addis_Ababa', updatedAt: later });
  });

  it('records consent on a doc written before T013a and adds only consent and updatedAt', async () => {
    const legacy = {
      id: ULID,
      displayName: 'Alice',
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    };
    await db.collection('users').doc(ULID).set(legacy);
    const later = '2026-02-01T00:00:00.000Z';
    const consent = { version: CURRENT_CONSENT_VERSION, acceptedAt: later };

    const result = await repo.recordConsent(ULID, consent, later);

    expect(result).toStrictEqual({
      ...legacy,
      locale: null,
      timezone: null,
      consent,
      updatedAt: later,
    });
    const raw = (await db.collection('users').doc(ULID).get()).data();
    expect(raw).toStrictEqual({ ...legacy, consent, updatedAt: later });
  });

  it('removes an orphan identities doc whose user doc is already gone', async () => {
    await db.collection('identities').doc('firebase_orphan').set({
      id: 'firebase_orphan',
      provider: 'firebase',
      subject: 'orphan',
      userId: ULID,
      email: null,
      emailVerified: false,
      createdAt: AT,
      schemaVersion: USER_SCHEMA_VERSION,
    });

    await expect(repo.deleteUserAndIdentities(ULID)).resolves.toBeUndefined();

    expect((await db.collection('identities').doc('firebase_orphan').get()).exists).toBe(false);
    expect(await counts()).toEqual({ users: 0, identities: 0 });
  });

  it('removes corrupt user and identity docs that the converter would reject', async () => {
    await db.collection('users').doc(ULID).set({ id: ULID, schemaVersion: 2 });
    await db.collection('identities').doc('firebase_corrupt').set({
      userId: ULID,
      schemaVersion: 2,
    });

    await expect(repo.deleteUserAndIdentities(ULID)).resolves.toBeUndefined();

    expect((await db.collection('users').doc(ULID).get()).exists).toBe(false);
    expect((await db.collection('identities').doc('firebase_corrupt').get()).exists).toBe(false);
  });

  it('leaves no raw doc whose id is the user or whose userId field is the user', async () => {
    await repo.createWithIdentity(
      {
        id: ULID,
        displayName: 'Alice',
        locale: null,
        timezone: null,
        consent: null,
        createdAt: AT,
        updatedAt: AT,
        schemaVersion: USER_SCHEMA_VERSION,
      },
      {
        id: 'firebase_uid-alice',
        provider: 'firebase',
        subject: 'uid-alice',
        userId: ULID,
        email: null,
        emailVerified: false,
        createdAt: AT,
        schemaVersion: USER_SCHEMA_VERSION,
      },
    );
    await db.collection('identities').doc(ULID).set({ userId: ULID, schemaVersion: 2 });

    await repo.deleteUserAndIdentities(ULID);

    expect((await db.collection('users').doc(ULID).get()).exists).toBe(false);
    expect((await db.collection('identities').doc(ULID).get()).exists).toBe(false);
    const identities = await db.collection('identities').where('userId', '==', ULID).get();
    const users = await db.collection('users').where('userId', '==', ULID).get();
    expect(identities.empty).toBe(true);
    expect(users.empty).toBe(true);
  });
});
