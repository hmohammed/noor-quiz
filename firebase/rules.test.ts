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
const ALICE_USER_ID = '01JAAAAAAAAAAAAAAAAAAAAAAA';
const TENANT_ID = '01KAAAAAAAAAAAAAAAAAAAAAAA';
const AT = '2026-01-01T00:00:00.000Z';

const seeds = {
  users: {
    id: ALICE_USER_ID,
    data: {
      id: ALICE_USER_ID,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  identities: {
    id: `firebase_${ALICE}`,
    data: {
      id: `firebase_${ALICE}`,
      provider: 'firebase',
      subject: ALICE,
      userId: ALICE_USER_ID,
      email: 'alice@example.com',
      emailVerified: true,
      createdAt: AT,
      schemaVersion: 1,
    },
  },
  anything: { id: 'x', data: { v: 1 } },
  communities: {
    id: TENANT_ID,
    data: {
      id: TENANT_ID,
      tenantId: TENANT_ID,
      name: 'Masjid Al-Noor',
      slug: 'masjid-al-noor',
      timezone: 'Europe/Stockholm',
      createdBy: ALICE_USER_ID,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  memberships: {
    id: `${ALICE_USER_ID}_${TENANT_ID}`,
    data: {
      id: `${ALICE_USER_ID}_${TENANT_ID}`,
      tenantId: TENANT_ID,
      userId: ALICE_USER_ID,
      role: 'owner',
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  communitySlugs: {
    id: 'masjid-al-noor',
    data: {
      id: 'masjid-al-noor',
      slug: 'masjid-al-noor',
      tenantId: TENANT_ID,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  invites: {
    id: '01BBBBBBBBBBBBBBBBBBBBBBBB',
    data: {
      id: '01BBBBBBBBBBBBBBBBBBBBBBBB',
      tenantId: TENANT_ID,
      createdBy: ALICE_USER_ID,
      expiresAt: AT,
      maxUses: 25,
      uses: 0,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  questions: {
    id: '01CCCCCCCCCCCCCCCCCCCCCCCC',
    data: {
      id: '01CCCCCCCCCCCCCCCCCCCCCCCC',
      tenantId: TENANT_ID,
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
      authoredBy: ALICE_USER_ID,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
  seasons: {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    data: {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      tenantId: TENANT_ID,
      name: 'Ramadan 1448',
      kind: 'ramadan',
      startDate: '2035-01-01',
      lengthDays: 30,
      timezone: 'Europe/Stockholm',
      opensAtLocal: '08:00',
      closesAtLocal: '21:00',
      createdBy: ALICE_USER_ID,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    },
  },
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
    batch.set(doc(firestore, 'users', ALICE_USER_ID), { displayName: 'Mallory' });
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
    await assertFails(setDoc(doc(alice, 'users', ALICE_USER_ID), { displayName: 'Mallory' }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(db(ctx), 'users', ALICE_USER_ID));
      expect(snap.data()).toEqual(seeds.users.data);
      // assertSucceeds here only checks the admin path works; it is not a client read.
      const all = await assertSucceeds(getDocs(collection(db(ctx), 'anything')));
      expect(all.size).toBe(1);
    });
  });
});
