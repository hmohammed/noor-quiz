import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isDomainError,
  type DomainErrorCode,
  type Membership,
  type TenantId,
  type UserId,
} from '@noor/core';
import { runInviteRepoContract } from '@noor/testkit';
import { FirestoreMembershipRepo } from './community-repo';
import { FirestoreInviteRepo } from './invite-repo';

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
  app = initializeApp({ projectId: 'demo-noor' }, 'invite-repo-contract');
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clear(): Promise<void> {
  await db.recursiveDelete(db.collection('invites'));
  await db.recursiveDelete(db.collection('memberships'));
}

async function countInvites(): Promise<number> {
  const snap = await db.collection('invites').count().get();
  return snap.data().count;
}

async function seedMembership(membership: Membership): Promise<void> {
  await db.collection('memberships').doc(membership.id).set({
    id: membership.id,
    tenantId: membership.tenantId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    schemaVersion: membership.schemaVersion,
  });
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

runInviteRepoContract('Firestore invite repo (emulator)', async () => {
  await clear();
  return {
    invites: new FirestoreInviteRepo(db),
    memberships: new FirestoreMembershipRepo(db),
    seedMembership,
    countInvites,
  };
});

describe('Firestore invite repo (emulator only)', () => {
  const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as TenantId;
  const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
  let invites: FirestoreInviteRepo;

  beforeAll(() => {
    invites = new FirestoreInviteRepo(db);
  });

  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('rejects a corrupt invite doc as INTERNAL with a reason only', async () => {
    await clear();
    const token = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
    await db.collection('invites').doc(token).set({ id: token, schemaVersion: 2, name: 'secret' });
    const err = await expectDomainError(invites.getByToken(token), 'INTERNAL');
    expect((err as { details?: unknown }).details).toEqual({ reason: 'corrupt-invite-doc' });
    expect(JSON.stringify(err)).not.toContain('secret');
  });

  it('does not change a stored invite when create hits CONFLICT', async () => {
    await clear();
    const token = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
    const at = '2024-05-06T07:08:09.123Z';
    const invite = {
      id: token as never,
      tenantId: TENANT,
      createdBy: USER,
      expiresAt: '2026-06-01T00:00:00.000Z',
      maxUses: 25,
      uses: 0,
      createdAt: at,
      updatedAt: at,
      schemaVersion: 1 as const,
    };
    await invites.create(TENANT, invite);
    await expectDomainError(invites.create(TENANT, { ...invite, maxUses: 2 }), 'CONFLICT');
    expect((await invites.getByToken(token))?.maxUses).toBe(25);
  });
});
