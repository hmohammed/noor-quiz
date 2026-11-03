import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  isDomainError,
  type CommunitySlug,
  type DomainErrorCode,
  type Membership,
  type UserId,
} from '@noor/core';
import { runCommunityStoreContract } from '@noor/testkit';
import { FirestoreCommunityRepo, FirestoreMembershipRepo } from './community-repo';

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
  app = initializeApp({ projectId: 'demo-noor' }, 'community-repo-contract');
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clear(): Promise<void> {
  await db.recursiveDelete(db.collection('communities'));
  await db.recursiveDelete(db.collection('memberships'));
  await db.recursiveDelete(db.collection('communitySlugs'));
}

async function counts(): Promise<{ communities: number; memberships: number; slugs: number }> {
  const [communities, memberships, slugs] = await Promise.all([
    db.collection('communities').count().get(),
    db.collection('memberships').count().get(),
    db.collection('communitySlugs').count().get(),
  ]);
  return {
    communities: communities.data().count,
    memberships: memberships.data().count,
    slugs: slugs.data().count,
  };
}

async function readSlug(slug: string): Promise<CommunitySlug | null> {
  const snap = await db.collection('communitySlugs').doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as CommunitySlug;
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

runCommunityStoreContract('Firestore community repos (emulator)', async () => {
  await clear();
  return {
    communities: new FirestoreCommunityRepo(db),
    memberships: new FirestoreMembershipRepo(db),
    counts,
    readSlug,
    seedMembership,
  };
});

describe('Firestore community repos (emulator only)', () => {
  const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
  const AT = '2024-05-06T07:08:09.123Z';
  let communities: FirestoreCommunityRepo;
  let memberships: FirestoreMembershipRepo;

  beforeEach(async () => {
    await clear();
    communities = new FirestoreCommunityRepo(db);
    memberships = new FirestoreMembershipRepo(db);
  });

  it('refuses to run without FIRESTORE_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('rejects a corrupt community doc as INTERNAL with a reason only', async () => {
    await db
      .collection('communities')
      .doc(TENANT)
      .set({ id: TENANT, schemaVersion: 2, name: 'secret' });
    const err = await expectDomainError(communities.getById(TENANT as never), 'INTERNAL');
    expect((err as { details?: unknown }).details).toEqual({ reason: 'corrupt-community-doc' });
    expect(JSON.stringify(err)).not.toContain('secret');
  });

  it('rejects a corrupt membership doc as INTERNAL with a reason only', async () => {
    const id = `${USER}_${TENANT}`;
    await db.collection('memberships').doc(id).set({ id, userId: USER, role: 'superuser' });
    const err = await expectDomainError(memberships.get(TENANT as never, USER), 'INTERNAL');
    expect((err as { details?: unknown }).details).toEqual({ reason: 'corrupt-membership-doc' });
    expect(JSON.stringify(err)).not.toContain('superuser');
  });

  it('rejects a corrupt slug doc as INTERNAL when a create reads it', async () => {
    await db.collection('communitySlugs').doc('masjid').set({ id: 'masjid', slug: 'NOT A SLUG' });
    const err = await expectDomainError(
      communities.createWithOwner({
        community: {
          id: TENANT as never,
          tenantId: TENANT as never,
          name: 'Masjid',
          timezone: 'Europe/Stockholm',
          createdBy: USER,
          createdAt: AT,
          updatedAt: AT,
          schemaVersion: 1,
        },
        baseSlug: 'masjid',
        membership: {
          id: `${USER}_${TENANT}`,
          tenantId: TENANT as never,
          userId: USER,
          role: 'owner',
          createdAt: AT,
          updatedAt: AT,
          schemaVersion: 1,
        },
      }),
      'INTERNAL',
    );
    expect((err as { details?: unknown }).details).toEqual({
      reason: 'corrupt-community-slug-doc',
    });
    expect(await counts()).toEqual({ communities: 0, memberships: 0, slugs: 1 });
  });

  it('deleteByUser removes a corrupt membership doc', async () => {
    const id = `${USER}_${TENANT}`;
    await db.collection('memberships').doc(id).set({ userId: USER, schemaVersion: 2 });
    await expect(memberships.deleteByUser(USER)).resolves.toBeUndefined();
    expect((await db.collection('memberships').doc(id).get()).exists).toBe(false);
  });
});
