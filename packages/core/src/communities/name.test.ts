import { describe, expect, it } from 'vitest';
import { normaliseCommunityName } from './name';

const GEEZ_48 = 'ሀ'.repeat(48);

describe('normaliseCommunityName', () => {
  it.each([
    ['Latin with a hyphen', 'Masjid Al-Noor', 'Masjid Al-Noor'],
    ['Arabic', 'مسجد النور', 'مسجد النور'],
    ['digits after a letter', 'Masjid 99', 'Masjid 99'],
    ['an apostrophe', "Noor's Mosque", "Noor's Mosque"],
    ['a typographic apostrophe', 'Noor’s Mosque', 'Noor’s Mosque'],
    ['surrounding spaces', '  Masjid Al-Noor  ', 'Masjid Al-Noor'],
    ['inner whitespace runs', 'Masjid   Al-Noor', 'Masjid Al-Noor'],
    ['a combining mark, NFC', 'A\u030Asa Mosque', 'Åsa Mosque'],
    ["exactly 48 Ge'ez code points", GEEZ_48, GEEZ_48],
    ['two letters', 'Ab', 'Ab'],
  ])('accepts %s', (_label, input, normalised) => {
    expect(normaliseCommunityName(input)).toBe(normalised);
  });

  it.each([
    ['one character', 'A'],
    ['empty', ''],
    ['spaces only', '   '],
    ['starts with a digit', '123 Mosque'],
    ['markup', '<b>'],
    ['a name containing markup', 'Masjid <b>'],
    ['an emoji', 'Masjid 😀'],
    ['emoji only', '😀😀'],
    ['a NUL control', 'Masjid\u0000'],
    ['a leading ZWJ', '\u200DMasjid'],
    ['ends with a hyphen', 'Noor-'],
    ['ends with an apostrophe', "Noor'"],
    ['ends with a typographic apostrophe', 'Noor’'],
    ['starts with a hyphen', '-Noor'],
    ['49 code points', 'ن'.repeat(49)],
    ['marks only', '\u0301\u0301'],
  ])('rejects %s', (_label, input) => {
    expect(normaliseCommunityName(input)).toBeNull();
  });

  it('does not strip a rejected character down to a shorter name', () => {
    expect(normaliseCommunityName('Masjid 😀')).toBeNull();
    expect(normaliseCommunityName('<b>Masjid</b>')).toBeNull();
  });
});
