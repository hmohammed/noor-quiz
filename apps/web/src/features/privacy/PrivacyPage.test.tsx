import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import { PrivacyPage } from './PrivacyPage';
import { PRIVACY_PATH, PRIVACY_SECTIONS } from './policy';

const messages: Record<string, string> = en;
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('PrivacyPage', () => {
  // No SessionProvider or router around it: the page is public by construction.
  const html = renderToStaticMarkup(<PrivacyPage />);

  it('lives at /privacy', () => {
    expect(PRIVACY_PATH).toBe('/privacy');
  });

  it('shows the title and the placeholder notice', () => {
    expect(html).toMatch(new RegExp(`<h1[^>]*>${escape(en['privacy.title'])}</h1>`));
    expect(html).toContain(escape(en['privacy.placeholder']));
  });

  it('renders one heading and body per section, in order', () => {
    expect(PRIVACY_SECTIONS.length).toBeGreaterThan(0);
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual(PRIVACY_SECTIONS.map((s) => escape(messages[s.titleKey] ?? '')));
    let from = 0;
    for (const { titleKey, bodyKey } of PRIVACY_SECTIONS) {
      const title = html.indexOf(escape(messages[titleKey] ?? ''), from);
      const body = html.indexOf(escape(messages[bodyKey] ?? ''), title);
      expect(title, titleKey).toBeGreaterThanOrEqual(from);
      expect(body, bodyKey).toBeGreaterThan(title);
      from = body;
    }
  });

  it('every privacy.* key it uses exists in en.json', () => {
    const keys = [
      'privacy.title',
      'privacy.placeholder',
      ...PRIVACY_SECTIONS.flatMap((s) => [s.titleKey, s.bodyKey]),
    ];
    for (const key of keys) expect(messages[key], key).toEqual(expect.any(String));
  });

  it('never renders a raw privacy.* key', () => {
    expect(html).not.toMatch(/privacy\.[a-zA-Z]/);
  });
});
