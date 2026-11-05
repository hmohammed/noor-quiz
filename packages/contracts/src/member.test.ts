import { describe, expect, it } from 'vitest';
import {
  ChangeMemberRoleRequest,
  LeaveCommunityRequest,
  MembersResponse,
  MemberView,
} from './member';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const view = (overrides: Record<string, unknown> = {}) => ({
  userId: ULID,
  displayName: 'Ada',
  role: 'editor',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ChangeMemberRoleRequest', () => {
  it('accepts a known role', () => {
    expect(ChangeMemberRoleRequest.parse({ role: 'scholar-reviewer' })).toEqual({
      role: 'scholar-reviewer',
    });
  });

  it.each([
    ['an unknown role', { role: 'superuser' }],
    ['a missing role', {}],
    ['a userId', { userId: ULID }],
    ['a tenantId', { tenantId: ULID }],
    ['a role plus an extra key', { role: 'member', extra: true }],
  ])('rejects %s', (_label, body) => {
    expect(ChangeMemberRoleRequest.safeParse(body).success).toBe(false);
  });
});

describe('LeaveCommunityRequest', () => {
  it('accepts an empty object', () => {
    expect(LeaveCommunityRequest.parse({})).toEqual({});
  });

  it('rejects a role key', () => {
    expect(LeaveCommunityRequest.safeParse({ role: 'member' }).success).toBe(false);
  });
});

describe('MemberView', () => {
  it('accepts a view and a null display name', () => {
    expect(MemberView.parse(view())).toEqual(view());
    expect(MemberView.parse(view({ displayName: null }))).toEqual(view({ displayName: null }));
  });

  it.each([
    ['email', view({ email: 'a@example.com' })],
    ['schemaVersion', view({ schemaVersion: 1 })],
    ['updatedAt', view({ updatedAt: '2026-01-01T00:00:00.000Z' })],
    ['an empty display name', view({ displayName: '' })],
    ['a bad role', view({ role: 'superuser' })],
  ])('rejects %s', (_label, body) => {
    expect(MemberView.safeParse(body).success).toBe(false);
  });
});

describe('MembersResponse', () => {
  it('accepts a list of views', () => {
    expect(MembersResponse.parse({ members: [view()] })).toEqual({ members: [view()] });
  });

  it('rejects a member that leaks email', () => {
    expect(MembersResponse.safeParse({ members: [view({ email: 'a@example.com' })] }).success).toBe(
      false,
    );
  });
});
