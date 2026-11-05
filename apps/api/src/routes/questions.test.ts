import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  CURRENT_CONSENT_VERSION,
  membershipId,
  MEMBERSHIP_SCHEMA_VERSION,
  type Role,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import {
  CommunityResponse,
  ErrorResponse,
  MeResponse,
  Question,
  QuestionListResponse,
} from '@noor/contracts';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { createApp } from '../app';

function identity(overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  return {
    provider: 'firebase',
    subject: 'uid-alice',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
    ...overrides,
  };
}

const QUESTION = {
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
};

const MISSING = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

function setup(deps: TestDeps = makeTestDeps()) {
  const app = createApp({ deps, version: 'test-1' });
  const send = (method: string, path: string, authorization?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { app, deps, send };
}

async function expectCode(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const text = await res.text();
  expect(ErrorResponse.parse(JSON.parse(text)).error.code).toBe(code);
  return text;
}

async function signedIn(
  deps: TestDeps,
  overrides: Partial<VerifiedIdentity> = {},
  { consent = true }: { consent?: boolean } = {},
) {
  const token = deps.auth.issue(identity(overrides));
  const authorization = `Bearer ${token}`;
  const app = createApp({ deps, version: 'test-1' });
  const res = await app.request('/v1/me', { headers: { authorization } });
  const { userId } = MeResponse.parse(await res.json());
  if (consent) {
    const accepted = await app.request('/v1/me/consent', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ version: CURRENT_CONSENT_VERSION }),
    });
    expect(accepted.status).toBe(200);
  }
  return { authorization, userId: userId as UserId };
}

async function createCommunity(deps: TestDeps, authorization: string, name = 'Masjid Al-Noor') {
  const app = createApp({ deps, version: 'test-1' });
  const res = await app.request('/v1/communities', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ name, timezone: 'Europe/Stockholm' }),
  });
  expect(res.status).toBe(201);
  return CommunityResponse.parse(await res.json());
}

async function seedRole(deps: TestDeps, userId: UserId, tenantId: string, role: Role, at: string) {
  const tenant = asTenantId(tenantId);
  await deps.memberships.seed({
    id: membershipId(userId, tenant),
    tenantId: tenant,
    userId,
    role,
    createdAt: at,
    updatedAt: at,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  });
}

async function asRole(deps: TestDeps, role: Role) {
  const owner = await signedIn(deps, {
    subject: 'uid-owner',
    email: 'owner@example.com',
    name: 'Owner',
  });
  const community = await createCommunity(deps, owner.authorization);
  if (role === 'owner') {
    return {
      authorization: owner.authorization,
      userId: owner.userId,
      tenantId: community.tenantId,
    };
  }
  const person = await signedIn(deps, {
    subject: `uid-${role}`,
    email: `${role}@example.com`,
    name: 'Person',
  });
  await seedRole(deps, person.userId, community.tenantId, role, community.createdAt);
  return {
    authorization: person.authorization,
    userId: person.userId,
    tenantId: community.tenantId,
  };
}

function questionsPath(tenantId: string, questionId?: string): string {
  const base = `/v1/t/${tenantId}/questions`;
  return questionId === undefined ? base : `${base}/${questionId}`;
}

describe('question routes reject the wrong caller', () => {
  it.each(['member', 'scholar-reviewer'] as const)(
    'returns 403 FORBIDDEN for a %s on POST, GET and PATCH',
    async (role) => {
      const { deps, send } = setup();
      const actor = await asRole(deps, role);
      await expectCode(
        await send('POST', questionsPath(actor.tenantId), actor.authorization, QUESTION),
        403,
        'FORBIDDEN',
      );
      await expectCode(
        await send('GET', questionsPath(actor.tenantId), actor.authorization),
        403,
        'FORBIDDEN',
      );
      await expectCode(
        await send('PATCH', questionsPath(actor.tenantId, MISSING), actor.authorization, {
          topic: 'prayer',
        }),
        403,
        'FORBIDDEN',
      );
      expect(deps.questions.count()).toBe(0);
    },
  );

  it.each(['POST', 'GET', 'PATCH'] as const)(
    'returns 401 UNAUTHENTICATED on %s without a token',
    async (method) => {
      const { deps, send } = setup();
      const owner = await asRole(deps, 'owner');
      const path =
        method === 'PATCH' ? questionsPath(owner.tenantId, MISSING) : questionsPath(owner.tenantId);
      const body =
        method === 'GET' ? undefined : method === 'POST' ? QUESTION : { topic: 'prayer' };
      await expectCode(await send(method, path, undefined, body), 401, 'UNAUTHENTICATED');
    },
  );

  it.each(['POST', 'GET', 'PATCH'] as const)(
    'returns 403 FORBIDDEN for an editor of another tenant on %s',
    async (method) => {
      const { deps, send } = setup();
      const alice = await asRole(deps, 'editor');
      const bob = await signedIn(deps, {
        subject: 'uid-bob',
        email: 'bob@example.com',
        name: 'Bob',
      });
      const bobCommunity = await createCommunity(deps, bob.authorization, 'Bob School');
      await seedRole(deps, bob.userId, bobCommunity.tenantId, 'editor', bobCommunity.createdAt);
      const path =
        method === 'PATCH' ? questionsPath(alice.tenantId, MISSING) : questionsPath(alice.tenantId);
      const body =
        method === 'GET' ? undefined : method === 'POST' ? QUESTION : { topic: 'prayer' };
      await expectCode(await send(method, path, bob.authorization, body), 403, 'FORBIDDEN');
    },
  );

  it.each(['POST', 'GET', 'PATCH'] as const)(
    'returns 403 CONSENT_REQUIRED for an editor without consent on %s',
    async (method) => {
      const { deps, send } = setup();
      const editor = await asRole(deps, 'editor');
      await deps.users.recordConsent(
        editor.userId,
        { version: '2000-01-01', acceptedAt: '2020-01-01T00:00:00.000Z' },
        '2020-01-01T00:00:00.000Z',
      );
      const path =
        method === 'PATCH'
          ? questionsPath(editor.tenantId, MISSING)
          : questionsPath(editor.tenantId);
      const body =
        method === 'GET' ? undefined : method === 'POST' ? QUESTION : { topic: 'prayer' };
      await expectCode(
        await send(method, path, editor.authorization, body),
        403,
        'CONSENT_REQUIRED',
      );
    },
  );
});

describe('POST /v1/t/:tenantId/questions', () => {
  it('returns 201 for an editor with the answer, draft status and the caller as author', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const res = await send('POST', questionsPath(editor.tenantId), editor.authorization, QUESTION);
    expect(res.status).toBe(201);
    const text = await res.text();
    const created = Question.parse(JSON.parse(text));
    expect(created).toMatchObject({
      ...QUESTION,
      topic: 'fasting',
      type: 'mcq',
      reviewStatus: 'draft',
      reviewNotes: '',
      authoredBy: editor.userId,
      tenantId: editor.tenantId,
    });
    expect(created.answer.choiceIndex).toBe(0);
    expect(text).not.toContain('schemaVersion');
    expect(deps.questions.count()).toBe(1);
  });

  it.each(['admin', 'owner'] as const)('returns 201 for an %s', async (role) => {
    const { deps, send } = setup();
    const actor = await asRole(deps, role);
    const res = await send('POST', questionsPath(actor.tenantId), actor.authorization, QUESTION);
    expect(res.status).toBe(201);
    expect(Question.parse(await res.json()).authoredBy).toBe(actor.userId);
  });

  it.each([
    ['one choice', { locales: { en: { ...QUESTION.locales.en, choices: ['only'] } } }],
    ['no choices', { locales: { en: { ...QUESTION.locales.en, choices: [] } } }],
    ['a missing choiceIndex', { answer: {} }],
    ['a fractional choiceIndex', { answer: { choiceIndex: 1.5 } }],
    ['a negative choiceIndex', { answer: { choiceIndex: -1 } }],
    ['a choiceIndex past the end', { answer: { choiceIndex: 2 } }],
  ])('returns 400 VALIDATION for %s and writes nothing', async (_label, patch) => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const text = await expectCode(
      await send('POST', questionsPath(editor.tenantId), editor.authorization, {
        ...QUESTION,
        ...patch,
      }),
      400,
      'VALIDATION',
    );
    expect(text).not.toContain('Which verse commands fasting?');
    expect(deps.questions.count()).toBe(0);
  });

  it.each([
    ['reviewStatus', { reviewStatus: 'approved' }],
    ['type', { type: 'mcq' }],
    ['tenantId', { tenantId: MISSING }],
    ['authoredBy', { authoredBy: MISSING }],
    ['id', { id: MISSING }],
    ['schemaVersion', { schemaVersion: 1 }],
  ])('returns 400 VALIDATION when POST sends %s and writes nothing', async (_label, extra) => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    await expectCode(
      await send('POST', questionsPath(editor.tenantId), editor.authorization, {
        ...QUESTION,
        ...extra,
      }),
      400,
      'VALIDATION',
    );
    expect(deps.questions.count()).toBe(0);
  });

  it.each([
    ['missing sources', { sources: undefined }],
    ['empty sources', { sources: [] }],
    ['an unknown source kind', { sources: [{ kind: 'web', ref: '2:183' }] }],
    ['a blank ref', { sources: [{ kind: 'quran', ref: '   ' }] }],
  ])('returns 400 VALIDATION for %s and writes nothing', async (label, patch) => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const body =
      label === 'missing sources'
        ? {
            difficulty: QUESTION.difficulty,
            topic: QUESTION.topic,
            locales: QUESTION.locales,
            answer: QUESTION.answer,
          }
        : { ...QUESTION, ...patch };
    await expectCode(
      await send('POST', questionsPath(editor.tenantId), editor.authorization, body),
      400,
      'VALIDATION',
    );
    expect(deps.questions.count()).toBe(0);
  });

  it('returns 400 VALIDATION for a body over 32768 bytes and writes nothing', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    await expectCode(
      await send('POST', questionsPath(editor.tenantId), editor.authorization, {
        ...QUESTION,
        topic: 'x'.repeat(40_000),
      }),
      400,
      'VALIDATION',
    );
    expect(deps.questions.count()).toBe(0);
  });
});

describe('GET /v1/t/:tenantId/questions', () => {
  it('returns this tenant’s questions newest first, including an empty list, with the answer', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const empty = await send('GET', questionsPath(editor.tenantId), editor.authorization);
    expect(empty.status).toBe(200);
    expect(QuestionListResponse.parse(await empty.json())).toEqual({ questions: [] });

    const first = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, {
          ...QUESTION,
          topic: 'older',
        })
      ).json(),
    );
    const second = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, {
          ...QUESTION,
          topic: 'same',
        })
      ).json(),
    );
    expect(first.createdAt).toBe(second.createdAt);
    expect(second.id > first.id).toBe(true);

    deps.clock.advance({ days: 1 });
    const newest = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, {
          ...QUESTION,
          topic: 'newest',
        })
      ).json(),
    );

    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const other = await createCommunity(deps, bob.authorization, 'Bob School');
    const otherCreated = await send(
      'POST',
      questionsPath(other.tenantId),
      bob.authorization,
      QUESTION,
    );
    expect(otherCreated.status).toBe(201);

    const listed = QuestionListResponse.parse(
      await (await send('GET', questionsPath(editor.tenantId), editor.authorization)).json(),
    );
    expect(listed.questions.map((question) => question.id)).toEqual([
      newest.id,
      second.id,
      first.id,
    ]);
    expect(listed.questions.every((question) => question.tenantId === editor.tenantId)).toBe(true);
    expect(listed.questions.map((question) => question.answer.choiceIndex)).toEqual([0, 0, 0]);
  });
});

describe('PATCH /v1/t/:tenantId/questions/:questionId', () => {
  it('returns 200 for one field and keeps identity, with updatedAt from the clock', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const created = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, QUESTION)
      ).json(),
    );
    deps.clock.advance({ hours: 1 });

    const res = await send(
      'PATCH',
      questionsPath(editor.tenantId, created.id),
      editor.authorization,
      { topic: '  prayer  ' },
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const patched = Question.parse(JSON.parse(text));
    expect(patched.topic).toBe('prayer');
    expect(patched.id).toBe(created.id);
    expect(patched.tenantId).toBe(created.tenantId);
    expect(patched.type).toBe('mcq');
    expect(patched.reviewStatus).toBe('draft');
    expect(patched.authoredBy).toBe(created.authoredBy);
    expect(patched.createdAt).toBe(created.createdAt);
    expect(patched.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(patched.updatedAt).toBe('2026-01-01T01:00:00.000Z');
    expect(text).not.toContain('schemaVersion');
    expect(deps.questions.count()).toBe(1);
  });

  it('returns 400 VALIDATION for an empty object and writes nothing', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const created = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, QUESTION)
      ).json(),
    );
    await expectCode(
      await send('PATCH', questionsPath(editor.tenantId, created.id), editor.authorization, {}),
      400,
      'VALIDATION',
    );
    const listed = QuestionListResponse.parse(
      await (await send('GET', questionsPath(editor.tenantId), editor.authorization)).json(),
    );
    expect(listed.questions).toEqual([created]);
  });

  it('returns 404 NOT_FOUND for an unknown id and for another tenant’s question id', async () => {
    const { deps, send } = setup();
    const alice = await asRole(deps, 'editor');
    const created = Question.parse(
      await (
        await send('POST', questionsPath(alice.tenantId), alice.authorization, QUESTION)
      ).json(),
    );
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const other = await createCommunity(deps, bob.authorization, 'Bob School');

    await expectCode(
      await send('PATCH', questionsPath(alice.tenantId, MISSING), alice.authorization, {
        topic: 'prayer',
      }),
      404,
      'NOT_FOUND',
    );
    await expectCode(
      await send('PATCH', questionsPath(other.tenantId, created.id), bob.authorization, {
        topic: 'prayer',
      }),
      404,
      'NOT_FOUND',
    );
    const listed = QuestionListResponse.parse(
      await (await send('GET', questionsPath(alice.tenantId), alice.authorization)).json(),
    );
    expect(listed.questions).toEqual([created]);
  });

  it('returns 400 VALIDATION for a non-ULID id', async () => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    await send('POST', questionsPath(editor.tenantId), editor.authorization, QUESTION);
    await expectCode(
      await send('PATCH', questionsPath(editor.tenantId, 'not-a-ulid'), editor.authorization, {
        topic: 'prayer',
      }),
      400,
      'VALIDATION',
    );
  });

  it.each([
    ['reviewStatus', { reviewStatus: 'draft' }],
    ['type', { type: 'mcq' }],
    ['tenantId', { tenantId: MISSING }],
    ['authoredBy', { authoredBy: MISSING }],
    ['id', { id: MISSING }],
    ['schemaVersion', { schemaVersion: 1 }],
    ['empty sources', { sources: [] }],
    ['an unknown source kind', { sources: [{ kind: 'web', ref: '2:183' }] }],
    ['a blank ref', { sources: [{ kind: 'hadith', ref: '  ' }] }],
  ])('returns 400 VALIDATION when PATCH sends %s and writes nothing', async (_label, body) => {
    const { deps, send } = setup();
    const editor = await asRole(deps, 'editor');
    const created = Question.parse(
      await (
        await send('POST', questionsPath(editor.tenantId), editor.authorization, QUESTION)
      ).json(),
    );
    await expectCode(
      await send('PATCH', questionsPath(editor.tenantId, created.id), editor.authorization, body),
      400,
      'VALIDATION',
    );
    const listed = QuestionListResponse.parse(
      await (await send('GET', questionsPath(editor.tenantId), editor.authorization)).json(),
    );
    expect(listed.questions).toEqual([created]);
  });
});
