import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Host and port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`.
// Always test the real rules file, never an inlined copy.
const rules = readFileSync(fileURLToPath(new URL('./firestore.rules', import.meta.url)), 'utf8');

const ALICE = 'uid-alice';

// Fixtures only: these do not define the real users / identities schema.
const seeds = {
  users: {
    id: ALICE,
    data: {
      id: ALICE,
      displayName: 'Alice',
      createdAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1,
    },
  },
  identities: {
    id: ALICE,
    data: {
      provider: 'firebase',
      uid: ALICE,
      userId: '01JAAAAAAAAAAAAAAAAAAAAAAA',
      schemaVersion: 1,
    },
  },
  anything: { id: 'x', data: { v: 1 } },
} as const;

type CollectionName = keyof typeof seeds;
const collections = Object.keys(seeds) as CollectionName[];

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Every denied call makes the SDK log PERMISSION_DENIED; that is the expected outcome here.
  setLogLevel('silent');
  testEnv = await initializeTestEnvironment({ projectId: 'demo-noor', firestore: { rules } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const name of collections) {
      await setDoc(doc(db, name, seeds[name].id), seeds[name].data);
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

const clients: Array<[string, () => RulesTestContext]> = [
  ['unauthenticated', () => testEnv.unauthenticatedContext()],
  ['authenticated', () => testEnv.authenticatedContext(ALICE)],
  [
    'authenticated with forged claims',
    () =>
      testEnv.authenticatedContext(ALICE, { platformAdmin: true, tenantId: 'x', role: 'owner' }),
  ],
];

const db = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;

describe('seeded docs exist (denials come from rules, not missing docs)', () => {
  it.each(collections)('%s seed is readable with rules disabled', async (name) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(db(ctx), name, seeds[name].id));
      expect(snap.exists()).toBe(true);
      expect(snap.data()).toEqual(seeds[name].data);
    });
  });
});

describe.each(clients)('%s client', (_label, context) => {
  it.each(collections)('cannot get a doc in %s', async (name) => {
    await assertFails(getDoc(doc(db(context()), name, seeds[name].id)));
  });

  it.each(collections)('cannot list %s', async (name) => {
    await assertFails(getDocs(collection(db(context()), name)));
  });

  it.each(collections)('cannot create a new doc in %s', async (name) => {
    await assertFails(setDoc(doc(db(context()), name, 'new-doc'), { v: 2 }));
  });

  it.each(collections)('cannot overwrite the existing doc in %s', async (name) => {
    await assertFails(setDoc(doc(db(context()), name, seeds[name].id), { v: 2 }));
  });

  it.each(collections)('cannot update the existing doc in %s', async (name) => {
    await assertFails(updateDoc(doc(db(context()), name, seeds[name].id), { v: 2 }));
  });

  it.each(collections)('cannot delete the existing doc in %s', async (name) => {
    await assertFails(deleteDoc(doc(db(context()), name, seeds[name].id)));
  });

  it('cannot addDoc to anything', async () => {
    await assertFails(addDoc(collection(db(context()), 'anything'), { v: 2 }));
  });

  it('cannot commit a batched write', async () => {
    const firestore = db(context());
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'users', ALICE), { displayName: 'Mallory' });
    batch.set(doc(firestore, 'anything', 'y'), { v: 2 });
    await assertFails(batch.commit());
  });

  it('cannot run a transaction', async () => {
    const firestore = db(context());
    await assertFails(
      runTransaction(firestore, async (tx) => {
        tx.set(doc(firestore, 'anything', 'y'), { v: 2 });
      }),
    );
  });
});

describe('writes really were denied', () => {
  it('seeded docs are unchanged and no new docs exist after a denied write attempt', async () => {
    const alice = db(testEnv.authenticatedContext(ALICE));
    await assertFails(setDoc(doc(alice, 'users', ALICE), { displayName: 'Mallory' }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(db(ctx), 'users', ALICE));
      expect(snap.data()).toEqual(seeds.users.data);
      // assertSucceeds here only checks the admin path works; it is not a client read.
      const all = await assertSucceeds(getDocs(collection(db(ctx), 'anything')));
      expect(all.size).toBe(1);
    });
  });
});
