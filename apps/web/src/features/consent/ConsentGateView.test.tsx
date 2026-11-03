import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import { ConsentGateView, type ConsentGateStatus } from './ConsentGateView';

const messages: Record<string, string> = en;
const noop = () => undefined;
const STATUSES: ConsentGateStatus[] = ['idle', 'accepting', 'error', 'outdated'];

const render = (status: ConsentGateStatus) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ConsentGateView status={status} onAccept={noop} />
    </MemoryRouter>,
  );

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('ConsentGateView', () => {
  it('idle: title, summary, privacy link and an enabled agree button', () => {
    const html = render('idle');
    expect(html).toMatch(new RegExp(`<h1[^>]*>${escape(en['consent.title'])}</h1>`));
    expect(html).toContain(escape(en['consent.summary']));
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/privacy"[^>]*>${escape(en['consent.privacyLink'])}</a>`),
    );
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['consent.agree']}</button>`));
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('accepting: a disabled button that says so, a busy status and no alert', () => {
    const html = render('accepting');
    expect(html).toMatch(
      new RegExp(
        `<button type="button"[^>]*disabled=""[^>]*>${escape(en['consent.agreeing'])}</button>`,
      ),
    );
    expect(html).toMatch(/<p role="status" aria-busy="true"/);
    expect(html).not.toContain('role="alert"');
  });

  it('error: the generic alert and an enabled button to retry', () => {
    const html = render('error');
    expect(html).toMatch(
      new RegExp(`<p role="alert"[^>]*>${escape(en['consent.error.generic'])}</p>`),
    );
    expect(html).not.toContain(escape(en['consent.error.outdated']));
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['consent.agree']}</button>`));
    expect(html).not.toContain('disabled');
  });

  it('outdated: the outdated-terms alert (not the generic one) and an enabled button', () => {
    const html = render('outdated');
    expect(html).toMatch(
      new RegExp(`<p role="alert"[^>]*>${escape(en['consent.error.outdated'])}</p>`),
    );
    expect(html).not.toContain(escape(en['consent.error.generic']));
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['consent.agree']}</button>`));
    expect(html).not.toContain('disabled');
  });

  it('never renders a raw consent.* key', () => {
    for (const status of STATUSES) expect(render(status)).not.toMatch(/consent\.[a-zA-Z]/);
  });

  it('every consent.* key it uses exists in en.json', () => {
    for (const key of [
      'consent.title',
      'consent.summary',
      'consent.privacyLink',
      'consent.agree',
      'consent.agreeing',
      'consent.error.generic',
      'consent.error.outdated',
      'nav.privacy',
    ]) {
      expect(messages[key], key).toEqual(expect.any(String));
    }
  });
});
