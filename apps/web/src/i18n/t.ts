// Minimal English-only translator. T080 replaces this with the full i18n module
// (`useI18n()`, locale files, RTL switching). Keep call sites as `t('dotted.key')`.
import en from './en.json';

const messages: Readonly<Record<string, string>> = en;

/** Returns the English message for `key`, or the key itself when it is unknown. */
export function t(key: string): string {
  return messages[key] ?? key;
}
