import { DomainError } from '../errors';
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from '../users/profile';
import {
  isQuestionDifficulty,
  isSourceKind,
  type Question,
  type QuestionDifficulty,
  type QuestionLocale,
  type QuestionLocales,
  type QuestionSource,
} from './question';

/** Editorial fields a create or a merged patch must satisfy. Identity fields are not here. */
export interface QuestionContent {
  difficulty: QuestionDifficulty;
  topic: string;
  locales: QuestionLocales;
  answer: { choiceIndex: number };
  sources: QuestionSource[];
}

export interface QuestionLocaleInput {
  title: string;
  prompt: string;
  choices: readonly string[];
  explanation: string;
}

export interface QuestionContentInput {
  difficulty: string;
  topic: string;
  locales: Partial<Record<Locale, QuestionLocaleInput>>;
  answer: { choiceIndex: number };
  sources: readonly { kind: string; ref: string }[];
}

export interface QuestionPatch {
  difficulty?: string;
  topic?: string;
  locales?: Partial<Record<Locale, QuestionLocaleInput>>;
  answer?: { choiceIndex: number };
  sources?: readonly { kind: string; ref: string }[];
}

function codePoints(value: string): number {
  return Array.from(value).length;
}

/** Trimmed only. Quran wording is not NFC-normalised and inner spaces stay. */
function trimText(value: unknown, min: number, max: number, reason: string): string {
  if (typeof value !== 'string') throw new DomainError('VALIDATION', { reason });
  const trimmed = value.trim();
  const length = codePoints(trimmed);
  if (length < min || length > max) throw new DomainError('VALIDATION', { reason });
  return trimmed;
}

function requireDifficulty(value: string): QuestionDifficulty {
  if (!isQuestionDifficulty(value)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-difficulty' });
  }
  return value;
}

function requireLocale(value: QuestionLocaleInput): QuestionLocale {
  if (typeof value !== 'object' || value === null || !Array.isArray(value.choices)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-locale' });
  }
  return {
    title: trimText(value.title, 1, 120, 'invalid-title'),
    prompt: trimText(value.prompt, 1, 2000, 'invalid-prompt'),
    choices: value.choices.map((choice) => trimText(choice, 1, 300, 'invalid-choice')),
    explanation: trimText(value.explanation, 0, 2000, 'invalid-explanation'),
  };
}

function requireLocales(value: Partial<Record<Locale, QuestionLocaleInput>>): QuestionLocales {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-locales' });
  }
  const locales: QuestionLocales = {};
  for (const key of Object.keys(value)) {
    if (!isSupportedLocale(key)) throw new DomainError('VALIDATION', { reason: 'invalid-locale' });
    const content = value[key];
    if (content === undefined) continue;
    locales[key] = requireLocale(content);
  }
  if (Object.keys(locales).length === 0) {
    throw new DomainError('VALIDATION', { reason: 'invalid-locales' });
  }
  return locales;
}

function requireSources(value: readonly { kind: string; ref: string }[]): QuestionSource[] {
  if (!Array.isArray(value)) throw new DomainError('VALIDATION', { reason: 'invalid-sources' });
  return value.map((source) => {
    if (typeof source !== 'object' || source === null || !isSourceKind(source.kind)) {
      throw new DomainError('VALIDATION', { reason: 'invalid-source' });
    }
    return { kind: source.kind, ref: trimText(source.ref, 1, 200, 'invalid-source') };
  });
}

/** Trims text and copies locales, choices and sources. Does not check choice rules. */
export function normaliseQuestionContent(input: QuestionContentInput): QuestionContent {
  if (typeof input.answer !== 'object' || input.answer === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-choice-index' });
  }
  return {
    difficulty: requireDifficulty(input.difficulty),
    topic: trimText(input.topic, 1, 48, 'invalid-topic'),
    locales: requireLocales(input.locales),
    answer: { choiceIndex: input.answer.choiceIndex },
    sources: requireSources(input.sources),
  };
}

function presentLocales(locales: QuestionLocales): QuestionLocale[] {
  const found: QuestionLocale[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    const content = locales[locale];
    if (content) found.push(content);
  }
  return found;
}

/**
 * Choice count, the same choice length in every locale, `choiceIndex`, and sources.
 * Create and update both require 1–8 sources. Lengths are code points of the text
 * `normaliseQuestionContent` already trimmed.
 */
export function assertQuestion(content: QuestionContent): void {
  const locales = presentLocales(content.locales);
  if (locales.length === 0) throw new DomainError('VALIDATION', { reason: 'invalid-locales' });
  const count = locales[0]?.choices.length ?? 0;
  if (count < 2 || count > 6 || locales.some((locale) => locale.choices.length !== count)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-choices' });
  }
  for (const locale of locales) {
    trimText(locale.title, 1, 120, 'invalid-title');
    trimText(locale.prompt, 1, 2000, 'invalid-prompt');
    trimText(locale.explanation, 0, 2000, 'invalid-explanation');
    for (const choice of locale.choices) trimText(choice, 1, 300, 'invalid-choice');
  }
  const choiceIndex = content.answer?.choiceIndex;
  if (
    typeof choiceIndex !== 'number' ||
    !Number.isInteger(choiceIndex) ||
    choiceIndex < 0 ||
    choiceIndex >= count
  ) {
    throw new DomainError('VALIDATION', { reason: 'invalid-choice-index' });
  }
  if (!Array.isArray(content.sources) || content.sources.length < 1 || content.sources.length > 8) {
    throw new DomainError('VALIDATION', { reason: 'invalid-sources' });
  }
  for (const source of content.sources) {
    if (!isSourceKind(source.kind))
      throw new DomainError('VALIDATION', { reason: 'invalid-source' });
    trimText(source.ref, 1, 200, 'invalid-source');
  }
  trimText(content.topic, 1, 48, 'invalid-topic');
  if (!isQuestionDifficulty(content.difficulty)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-difficulty' });
  }
}

/** Overlay `patch` on the stored question. An absent key stays as stored. */
export function contentFromPatch(stored: Question, patch: QuestionPatch): QuestionContent {
  return normaliseQuestionContent({
    difficulty: patch.difficulty === undefined ? stored.difficulty : patch.difficulty,
    topic: patch.topic === undefined ? stored.topic : patch.topic,
    locales: patch.locales === undefined ? stored.locales : patch.locales,
    answer: patch.answer === undefined ? stored.answer : patch.answer,
    sources: patch.sources === undefined ? stored.sources : patch.sources,
  });
}

export function hasQuestionPatch(patch: QuestionPatch): boolean {
  return (
    patch.difficulty !== undefined ||
    patch.topic !== undefined ||
    patch.locales !== undefined ||
    patch.answer !== undefined ||
    patch.sources !== undefined
  );
}
