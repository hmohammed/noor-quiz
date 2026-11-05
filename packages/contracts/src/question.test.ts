import { describe, expect, it } from 'vitest';
import {
  CreateQuestionRequest,
  MemberQuestionView,
  Question,
  QuestionListResponse,
  UpdateQuestionRequest,
} from './question';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const AT = '2026-11-05T09:00:00.000Z';

const locale = {
  title: 'The fast',
  prompt: 'Which verse commands fasting?',
  choices: ['2:183', '1:1'],
  explanation: 'Al-Baqarah.',
};

const body = {
  difficulty: 'beginner' as const,
  topic: 'fasting',
  locales: { en: locale, ar: { ...locale, title: 'الصيام', explanation: 'البقرة' } },
  answer: { choiceIndex: 0 },
  sources: [{ kind: 'quran' as const, ref: '2:183' }],
};

const question = {
  id: ULID,
  tenantId: OTHER,
  type: 'mcq' as const,
  ...body,
  reviewStatus: 'draft' as const,
  reviewNotes: '',
  authoredBy: ULID,
  createdAt: AT,
  updatedAt: AT,
};

describe('CreateQuestionRequest', () => {
  it('accepts two choices, a choiceIndex in range, and one source', () => {
    expect(CreateQuestionRequest.parse(body)).toMatchObject({
      difficulty: 'beginner',
      topic: 'fasting',
      answer: { choiceIndex: 0 },
    });
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(
      CreateQuestionRequest.parse({
        ...body,
        locales: { en: { ...locale, choices: six } },
        answer: { choiceIndex: 5 },
      }).answer.choiceIndex,
    ).toBe(5);
  });

  it('trims text and keeps inner whitespace and non-NFC wording', () => {
    const decomposed = 'a\u0301';
    const parsed = CreateQuestionRequest.parse({
      ...body,
      topic: '  fasting  day  ',
      locales: {
        en: {
          ...locale,
          prompt: `  ${decomposed}  verse  `,
          choices: ['  2:183  ', '1:1'],
          explanation: '   ',
        },
      },
      sources: [{ kind: 'quran', ref: '  2:183  ' }],
    });
    expect(parsed.topic).toBe('fasting  day');
    expect(parsed.locales.en?.prompt).toBe(`${decomposed}  verse`);
    expect(parsed.locales.en?.prompt.normalize('NFC')).not.toBe(parsed.locales.en?.prompt);
    expect(parsed.locales.en?.choices).toEqual(['2:183', '1:1']);
    expect(parsed.locales.en?.explanation).toBe('');
    expect(parsed.sources[0]?.ref).toBe('2:183');
  });

  it('counts code points, so 48 emoji fit and 49 do not', () => {
    const emoji = '🙂';
    expect(emoji.length).toBe(2);
    expect(CreateQuestionRequest.parse({ ...body, topic: emoji.repeat(48) }).topic).toHaveLength(
      96,
    );
    expect(CreateQuestionRequest.safeParse({ ...body, topic: emoji.repeat(49) }).success).toBe(
      false,
    );
  });

  it('rejects fewer than 2 choices and an out-of-range choiceIndex', () => {
    expect(
      CreateQuestionRequest.safeParse({
        ...body,
        locales: { en: { ...locale, choices: ['only'] } },
      }).success,
    ).toBe(false);
    expect(
      CreateQuestionRequest.safeParse({
        ...body,
        locales: { en: { ...locale, choices: [] } },
      }).success,
    ).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, answer: {} }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, answer: { choiceIndex: 1.5 } }).success).toBe(
      false,
    );
    expect(CreateQuestionRequest.safeParse({ ...body, answer: { choiceIndex: -1 } }).success).toBe(
      false,
    );
    expect(CreateQuestionRequest.safeParse({ ...body, answer: { choiceIndex: 2 } }).success).toBe(
      false,
    );
  });

  it('rejects a missing source, an empty list, an unknown kind, a blank ref, and server-owned keys', () => {
    expect(
      CreateQuestionRequest.safeParse({
        difficulty: body.difficulty,
        topic: body.topic,
        locales: body.locales,
        answer: body.answer,
      }).success,
    ).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, sources: [] }).success).toBe(false);
    expect(
      CreateQuestionRequest.safeParse({ ...body, sources: [{ kind: 'web', ref: '2:183' }] })
        .success,
    ).toBe(false);
    expect(
      CreateQuestionRequest.safeParse({ ...body, sources: [{ kind: 'quran', ref: '   ' }] })
        .success,
    ).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, reviewStatus: 'approved' }).success).toBe(
      false,
    );
    expect(CreateQuestionRequest.safeParse({ ...body, type: 'mcq' }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, tenantId: ULID }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, authoredBy: ULID }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, id: ULID }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, schemaVersion: 1 }).success).toBe(false);
    expect(CreateQuestionRequest.safeParse({ ...body, locales: { fr: locale } }).success).toBe(
      false,
    );
  });

  it('rejects locales whose choice lists differ in length', () => {
    expect(
      CreateQuestionRequest.safeParse({
        ...body,
        locales: {
          en: locale,
          sv: { ...locale, choices: ['a', 'b', 'c'] },
        },
      }).success,
    ).toBe(false);
  });
});

describe('UpdateQuestionRequest', () => {
  it('accepts one field and rejects an empty body, extra keys, and empty sources', () => {
    expect(UpdateQuestionRequest.parse({ topic: '  prayer  ' })).toEqual({ topic: 'prayer' });
    expect(UpdateQuestionRequest.safeParse({}).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ reviewStatus: 'draft' }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ type: 'mcq' }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ tenantId: ULID }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ authoredBy: ULID }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ id: ULID }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ schemaVersion: 1 }).success).toBe(false);
    expect(UpdateQuestionRequest.safeParse({ sources: [] }).success).toBe(false);
    expect(
      UpdateQuestionRequest.safeParse({ sources: [{ kind: 'book', ref: '   ' }] }).success,
    ).toBe(false);
  });
});

describe('MemberQuestionView', () => {
  it('strips answer and explanation and keeps prompt and choices', () => {
    const view = MemberQuestionView.parse(question);
    expect(view).not.toHaveProperty('answer');
    expect(view).not.toHaveProperty('explanation');
    expect(view).not.toHaveProperty('reviewStatus');
    expect(view).not.toHaveProperty('reviewNotes');
    expect(view).not.toHaveProperty('authoredBy');
    expect(view).not.toHaveProperty('createdAt');
    expect(view).not.toHaveProperty('schemaVersion');
    expect(view.locales.en).not.toHaveProperty('explanation');
    expect(view.locales.ar).not.toHaveProperty('explanation');
    expect(view.locales.en?.prompt).toBe(question.locales.en.prompt);
    expect(view.locales.en?.choices).toEqual(question.locales.en.choices);
    expect(view.locales.ar?.prompt).toBe(question.locales.ar.prompt);
    expect(view.locales.ar?.choices).toEqual(question.locales.ar.choices);
    expect(JSON.stringify(view)).not.toContain('explanation');
    expect(JSON.stringify(view)).not.toContain('choiceIndex');
  });
});

describe('Question', () => {
  it('keeps answer.choiceIndex and explanation, so the editor response is not the member view', () => {
    const parsed = Question.parse(question);
    expect(parsed.answer.choiceIndex).toBe(0);
    expect(parsed.locales.en?.explanation).toBe('Al-Baqarah.');
    expect(parsed.locales.ar?.explanation).toBe('البقرة');
    expect(parsed).not.toEqual(MemberQuestionView.parse(question));
  });

  it('rejects schemaVersion and accepts the later review statuses without writing them here', () => {
    expect(Question.safeParse({ ...question, schemaVersion: 1 }).success).toBe(false);
    expect(Question.parse({ ...question, reviewStatus: 'in_review' }).reviewStatus).toBe(
      'in_review',
    );
    expect(Question.parse({ ...question, sources: [] }).sources).toEqual([]);
  });

  it('lists questions as a strict object', () => {
    expect(QuestionListResponse.parse({ questions: [] })).toEqual({ questions: [] });
    expect(QuestionListResponse.parse({ questions: [question] }).questions).toHaveLength(1);
    expect(QuestionListResponse.safeParse({ questions: [], extra: true }).success).toBe(false);
  });
});
