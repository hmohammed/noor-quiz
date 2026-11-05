import { describe, expect, it } from 'vitest';
import {
  AcceptInviteRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  InvitePreviewResponse,
} from './invite';

const TOKEN = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('CreateInviteRequest', () => {
  it('accepts an empty body and the documented bounds', () => {
    expect(CreateInviteRequest.parse({})).toEqual({});
    expect(CreateInviteRequest.parse({ expiresInDays: 1, maxUses: 1 })).toEqual({
      expiresInDays: 1,
      maxUses: 1,
    });
    expect(CreateInviteRequest.parse({ expiresInDays: 30, maxUses: 100 })).toEqual({
      expiresInDays: 30,
      maxUses: 100,
    });
    expect(CreateInviteRequest.parse({ expiresInDays: 7 })).toEqual({ expiresInDays: 7 });
    expect(CreateInviteRequest.parse({ maxUses: 25 })).toEqual({ maxUses: 25 });
  });

  it.each([
    ['expiresInDays 0', { expiresInDays: 0 }],
    ['expiresInDays 31', { expiresInDays: 31 }],
    ['maxUses 0', { maxUses: 0 }],
    ['maxUses 101', { maxUses: 101 }],
    ['a fractional day', { expiresInDays: 1.5 }],
    ['a fractional maxUses', { maxUses: 2.5 }],
    ['a string day', { expiresInDays: '7' }],
    ['a role', { role: 'owner' }],
    ['a tenantId', { tenantId: TOKEN }],
    ['a createdBy', { createdBy: TOKEN }],
    ['an expiresAt', { expiresAt: '2026-01-08T00:00:00.000Z' }],
    ['a uses', { uses: 0 }],
    ['a token', { token: TOKEN }],
    ['an unknown key', { note: 'please' }],
  ])('rejects %s', (_label, body) => {
    expect(CreateInviteRequest.safeParse(body).success).toBe(false);
  });
});

describe('CreateInviteResponse', () => {
  const body = {
    token: TOKEN,
    expiresAt: '2026-01-08T00:00:00.000Z',
    maxUses: 25,
  };

  it('accepts the documented shape', () => {
    expect(CreateInviteResponse.parse(body)).toEqual(body);
  });

  it.each([
    ['createdBy', { ...body, createdBy: TOKEN }],
    ['uses', { ...body, uses: 0 }],
    ['tenantId', { ...body, tenantId: TOKEN }],
    ['slug', { ...body, slug: 'masjid' }],
    ['role', { ...body, role: 'member' }],
    ['a missing token', { expiresAt: body.expiresAt, maxUses: 25 }],
    ['a non-ULID token', { ...body, token: 'not-a-ulid' }],
    ['maxUses 0', { ...body, maxUses: 0 }],
    ['maxUses 101', { ...body, maxUses: 101 }],
  ])('rejects %s', (_label, value) => {
    expect(CreateInviteResponse.safeParse(value).success).toBe(false);
  });
});

describe('InvitePreviewResponse', () => {
  it('accepts a name and nothing else', () => {
    expect(InvitePreviewResponse.parse({ name: 'Masjid Al-Noor' })).toEqual({
      name: 'Masjid Al-Noor',
    });
    expect(InvitePreviewResponse.parse({ name: 'م' })).toEqual({ name: 'م' });
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a 49-code-point name', { name: 'م'.repeat(49) }],
    ['a slug', { name: 'Masjid Al-Noor', slug: 'masjid' }],
    ['a tenantId', { name: 'Masjid Al-Noor', tenantId: TOKEN }],
    ['a role', { name: 'Masjid Al-Noor', role: 'member' }],
    ['a missing name', {}],
  ])('rejects %s', (_label, body) => {
    expect(InvitePreviewResponse.safeParse(body).success).toBe(false);
  });
});

describe('AcceptInviteRequest', () => {
  it('accepts an empty object', () => {
    expect(AcceptInviteRequest.parse({})).toEqual({});
  });

  it('rejects a role', () => {
    expect(AcceptInviteRequest.safeParse({ role: 'owner' }).success).toBe(false);
  });
});
