import { describe, expect, it } from 'vitest';
import { ROLES, roleAtLeast, type Role } from './role';

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
