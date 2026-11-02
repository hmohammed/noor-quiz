import type { Locale } from '@noor/contracts';

export interface LocaleInfo {
  code: Locale;
  /** The language's own name (an endonym). Data, not a translated string. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', dir: 'ltr' },
  { code: 'sv', nativeName: 'Svenska', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl' },
  { code: 'am', nativeName: 'አማርኛ', dir: 'ltr' },
  { code: 'so', nativeName: 'Soomaali', dir: 'ltr' },
];
