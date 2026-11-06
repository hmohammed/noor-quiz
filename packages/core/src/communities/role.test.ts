import { describe, expect, it } from 'vitest';
import type { UserId } from '../users/user';
import {
  canApproveOrReject,
  canChangeRole,
  canRemoveMember,
  canSubmitForReview,
  ROLES,
  roleAtLeast,
  type Role,
} from './role';

const SAME = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;

/** The predicate from the members spec, written out so it is not the implementation. */
function expectedChange(
  actorRole: Role,
  targetRole: Role,
  newRole: Role,
  sameUser: boolean,
): boolean {
  if (sameUser) return ROLES.indexOf(newRole) <= ROLES.indexOf(targetRole);
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    return ROLES.indexOf(targetRole) < ROLES.indexOf('admin') && newRole !== 'owner';
  }
  return false;
}

function expectedRemove(actorRole: Role, targetRole: Role, sameUser: boolean): boolean {
  if (sameUser) return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && ROLES.indexOf(targetRole) < ROLES.indexOf('admin');
}

describe('roleAtLeast', () => {
  it('is true exactly when the actor rank is at least the minimum, for every pair', () => {
    for (const actor of ROLES) {
      for (const min of ROLES) {
        expect(roleAtLeast(actor, min)).toBe(ROLES.indexOf(actor) >= ROLES.indexOf(min));
      }
    }
  });

  it.each(['', 'superuser', 'OWNER', 'member '])('is false for an unrecognised role %j', (role) => {
    for (const min of ROLES) {
      expect(roleAtLeast(role, min as Role)).toBe(false);
    }
  });
});

describe('canSubmitForReview', () => {
  it('is true for editor and above only', () => {
    expect(canSubmitForReview('member')).toBe(false);
    expect(canSubmitForReview('scholar-reviewer')).toBe(false);
    expect(canSubmitForReview('editor')).toBe(true);
    expect(canSubmitForReview('admin')).toBe(true);
    expect(canSubmitForReview('owner')).toBe(true);
    expect(canSubmitForReview('unknown')).toBe(false);
  });
});

describe('canApproveOrReject', () => {
  it('is true for scholar-reviewer, admin and owner, not editor', () => {
    expect(canApproveOrReject('member')).toBe(false);
    expect(canApproveOrReject('scholar-reviewer')).toBe(true);
    expect(canApproveOrReject('editor')).toBe(false);
    expect(canApproveOrReject('admin')).toBe(true);
    expect(canApproveOrReject('owner')).toBe(true);
    expect(canApproveOrReject('unknown')).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('decides every actor, target, new role and same-user combination', () => {
    // Named cases inside the table: a self raise is false, an admin cannot mint an
    // owner, and an owner may set owner on someone else.
    expect(
      canChangeRole({ userId: SAME, role: 'member' }, { userId: SAME, role: 'member' }, 'admin'),
    ).toBe(false);
    expect(
      canChangeRole({ userId: SAME, role: 'admin' }, { userId: OTHER, role: 'member' }, 'owner'),
    ).toBe(false);
    expect(
      canChangeRole({ userId: SAME, role: 'owner' }, { userId: OTHER, role: 'member' }, 'owner'),
    ).toBe(true);

    let rows = 0;
    for (const actorRole of ROLES) {
      for (const targetRole of ROLES) {
        for (const newRole of ROLES) {
          for (const sameUser of [true, false]) {
            rows += 1;
            const actor = { userId: SAME, role: actorRole };
            const target = { userId: sameUser ? SAME : OTHER, role: targetRole };
            expect(
              canChangeRole(actor, target, newRole),
              `${actorRole} -> ${targetRole} as ${newRole} same=${sameUser}`,
            ).toBe(expectedChange(actorRole, targetRole, newRole, sameUser));
          }
        }
      }
    }
    expect(rows).toBe(250);
  });
});

describe('canRemoveMember', () => {
  it('decides every actor, target and same-user combination', () => {
    let rows = 0;
    for (const actorRole of ROLES) {
      for (const targetRole of ROLES) {
        for (const sameUser of [true, false]) {
          rows += 1;
          const actor = { userId: SAME, role: actorRole };
          const target = { userId: sameUser ? SAME : OTHER, role: targetRole };
          expect(
            canRemoveMember(actor, target),
            `${actorRole} removes ${targetRole} same=${sameUser}`,
          ).toBe(expectedRemove(actorRole, targetRole, sameUser));
        }
      }
    }
    expect(rows).toBe(50);
  });
});
