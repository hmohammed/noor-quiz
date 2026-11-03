/** The public privacy page. Reachable signed out and while consent is pending. */
export const PRIVACY_PATH = '/privacy';

export interface PrivacySection {
  readonly titleKey: string;
  readonly bodyKey: string;
}

/** Placeholder sections, in page order. The text lives in `en.json` under `privacy.*`. */
export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  { titleKey: 'privacy.data.title', bodyKey: 'privacy.data.body' },
  { titleKey: 'privacy.use.title', bodyKey: 'privacy.use.body' },
  { titleKey: 'privacy.rights.title', bodyKey: 'privacy.rights.body' },
  { titleKey: 'privacy.contact.title', bodyKey: 'privacy.contact.body' },
];
