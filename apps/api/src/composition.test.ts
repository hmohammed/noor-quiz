import { getApps } from 'firebase-admin/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseAuthVerifier } from './adapters/firebase/auth-verifier';
import {
  FirestoreCommunityRepo,
  FirestoreMembershipRepo,
} from './adapters/firebase/community-repo';
import { FirestoreInviteRepo } from './adapters/firebase/invite-repo';
import { FirestoreQuestionRepo } from './adapters/firebase/question-repo';
import { FirestoreScheduleRepo } from './adapters/firebase/schedule-repo';
import { FirestoreSeasonRepo } from './adapters/firebase/season-repo';
import { FirestoreUserRepo } from './adapters/firebase/user-repo';
import { SystemClock } from './adapters/system/clock';
import { UlidIdGenerator } from './adapters/system/ulid-id-generator';
import { createComposition } from './composition';
import { ConfigError } from './config';

const built = vi.hoisted(() => ({ auths: 0, clocks: 0, firestores: 0 }));

// Same SystemClock, but counts constructions so we can prove no adapter is built
// when config is invalid.
vi.mock('./adapters/system/clock', async (importOriginal) => {
  const real = await importOriginal<typeof import('./adapters/system/clock')>();
  class CountingSystemClock extends real.SystemClock {
    constructor() {
      super();
      built.clocks += 1;
    }
  }
  return { SystemClock: CountingSystemClock };
});

// Same admin Firestore, but counts how often a client (and so the admin app) is requested.
vi.mock('./adapters/firebase/firestore', async (importOriginal) => {
  const real = await importOriginal<typeof import('./adapters/firebase/firestore')>();
  return {
    getAdminFirestore: () => {
      built.firestores += 1;
      return real.getAdminFirestore();
    },
  };
});

// Same admin Auth, counted the same way.
vi.mock('./adapters/firebase/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('./adapters/firebase/auth')>();
  return {
    getAdminAuth: () => {
      built.auths += 1;
      return real.getAdminAuth();
    },
  };
});

describe('createComposition', () => {
  beforeEach(() => {
    built.auths = 0;
    built.clocks = 0;
    built.firestores = 0;
  });

  it.each([
    ['missing NOOR_ENV', {}],
    ['invalid NOOR_ENV', { NOOR_ENV: 'banana' }],
  ])('throws ConfigError before building any deps (%s)', (_label, env) => {
    const appsBefore = getApps().length;
    expect(() => createComposition(env, { version: 'test-1' })).toThrow(ConfigError);
    expect(built.auths).toBe(0);
    expect(built.clocks).toBe(0);
    expect(built.firestores).toBe(0);
    expect(getApps()).toHaveLength(appsBefore);
  });

  it('wires the system adapters, Firebase adapters and typed config with a valid env', () => {
    const root = createComposition({ NOOR_ENV: 'local', OTHER: 'x' }, { version: 'test-1' });

    expect(root.deps.auth).toBeInstanceOf(FirebaseAuthVerifier);
    expect(root.deps.clock).toBeInstanceOf(SystemClock);
    expect(root.deps.ids).toBeInstanceOf(UlidIdGenerator);
    expect(root.deps.users).toBeInstanceOf(FirestoreUserRepo);
    expect(root.deps.communities).toBeInstanceOf(FirestoreCommunityRepo);
    expect(root.deps.memberships).toBeInstanceOf(FirestoreMembershipRepo);
    expect(root.deps.invites).toBeInstanceOf(FirestoreInviteRepo);
    expect(root.deps.seasons).toBeInstanceOf(FirestoreSeasonRepo);
    expect(root.deps.questions).toBeInstanceOf(FirestoreQuestionRepo);
    expect(root.deps.schedules).toBeInstanceOf(FirestoreScheduleRepo);
    expect(built.auths).toBe(1);
    expect(built.clocks).toBe(1);
    expect(built.firestores).toBe(1);
    expect(root.config).toEqual({ env: 'local', logLevel: 'info' });
    expect(root.version).toBe('test-1');
  });

  it('reuses the admin app when called twice in one process', () => {
    createComposition({ NOOR_ENV: 'local' }, { version: 'test-1' });
    expect(() => createComposition({ NOOR_ENV: 'local' }, { version: 'test-1' })).not.toThrow();
    expect(getApps()).toHaveLength(1);
  });
});
