const NAME_MIN = 2;
const NAME_MAX = 48;
const STARTS_WITH_LETTER = /^\p{L}/u;
/** Letters, marks, numbers, spaces, ASCII hyphen, ASCII apostrophe, and ’ (U+2019). */
const NAME_BODY = /^[\p{L}\p{M}\p{N} '\u2019-]+$/u;
const ENDS_WITH_EDGE = /[-'\u2019]$/u;

/**
 * A community name a member types: NFC, trim, collapse whitespace runs to one space,
 * then it must be 2–48 code points, start with a Unicode letter, and otherwise be
 * letters, marks, numbers, spaces, hyphens or apostrophes. It must not end with a
 * hyphen or apostrophe. Returns null instead of stripping emoji, markup or controls.
 */
export function normaliseCommunityName(s: string): string | null {
  if (typeof s !== 'string') return null;
  const name = s.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = Array.from(name).length;
  if (length < NAME_MIN || length > NAME_MAX) return null;
  if (!STARTS_WITH_LETTER.test(name) || !NAME_BODY.test(name) || ENDS_WITH_EDGE.test(name)) {
    return null;
  }
  return name;
}
