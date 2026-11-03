import { describe, expect, it } from 'vitest';
import type { UserId } from '@noor/core';
import { runUserRepoContract } from './contracts/user-repo.contract';
import { InMemoryUserRepo } from './in-memory-user-repo';

runUserRepoContract('InMemoryUserRepo', async () => {
  const repo = new InMemoryUserRepo();
  return {
    repo,
    counts: async () => repo.counts(),
    addIdentity: (identity) => repo.addIdentity(identity),
  };
});

describe('InMemoryUserRepo', () => {
  it('returns copies, so changing a returned user does not change the stored one', async () => {
    const repo = new InMemoryUserRepo();
    const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
    const at = '2026-01-01T00:00:00.000Z';
    const created = await repo.createWithIdentity(
      {
        id,
        displayName: 'Alice',
        locale: null,
        timezone: null,
        consent: null,
        createdAt: at,
        updatedAt: at,
        schemaVersion: 1,
      },
      {
        id: 'firebase_uid-alice',
        provider: 'firebase',
        subject: 'uid-alice',
        userId: id,
        email: null,
        emailVerified: false,
        createdAt: at,
        schemaVersion: 1,
      },
    );

    created.displayName = 'Mallory';
    const read = await repo.getById(id);
    if (read) read.displayName = 'Eve';
    const byIdentity = await repo.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
    if (byIdentity) byIdentity.displayName = 'Trudy';

    expect((await repo.getById(id))?.displayName).toBe('Alice');

    const updated = await repo.updateProfile(id, { displayName: 'Åsa' }, at);
    updated.displayName = 'Mallory';
    expect((await repo.getById(id))?.displayName).toBe('Åsa');
  });
});
