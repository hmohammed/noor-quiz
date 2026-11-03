import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import { JoinView, type JoinViewState } from './JoinView';

const NAME = 'مسجد النور';
const noop = () => undefined;

const render = (state: JoinViewState) =>
  renderToStaticMarkup(
    <div dir="rtl">
      <JoinView state={state} onJoin={noop} onRetry={noop} />
    </div>,
  );

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('JoinView', () => {
  it('loading: a busy status and no join button', () => {
    const html = render({ kind: 'loading' });
    expect(html).toContain('dir="rtl"');
    expect(html).toMatch(/aria-busy="true"/);
    expect(html).toContain(en['join.loading']);
    expect(html).not.toMatch(new RegExp(`<button[^>]*>${en['join.join']}</button>`));
  });

  it('preview: the name with dir="auto" and a Join button', () => {
    const html = render({ kind: 'preview', name: NAME });
    expect(html).toContain('dir="rtl"');
    expect(html).toMatch(/<p class="join__name" dir="auto">/);
    expect(html).toContain(NAME);
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['join.join']}</button>`));
  });

  it('not-found: the not-found copy and no name or Join button', () => {
    const html = render({ kind: 'not-found' });
    expect(html).toContain(en['join.notFound']);
    expect(html).not.toContain(NAME);
    expect(html).not.toMatch(new RegExp(`<button[^>]*>${en['join.join']}</button>`));
  });

  it('gone: no name and no Join button', () => {
    const html = render({ kind: 'gone' });
    expect(html).toContain(en['join.gone']);
    expect(html).not.toContain(NAME);
    expect(html).not.toContain('join__name');
    expect(html).not.toMatch(new RegExp(`<button[^>]*>${en['join.join']}</button>`));
  });

  it('signed-out: the name, a sign-in prompt and a Join button', () => {
    const html = render({ kind: 'signed-out', name: NAME });
    expect(html).toContain(en['join.signIn']);
    expect(html).toContain(NAME);
    expect(html).toMatch(/dir="auto"/);
    expect(html).toContain(en['join.join']);
  });

  it('joined: the joined copy and the name from accept', () => {
    const html = render({ kind: 'joined', name: 'Masjid Al-Noor' });
    expect(html).toContain(en['join.joined']);
    expect(html).toContain('Masjid Al-Noor');
    expect(html).toMatch(/dir="auto"/);
  });

  it('error: an alert and retry', () => {
    const html = render({ kind: 'error' });
    expect(html).toMatch(new RegExp(`<p role="alert"[^>]*>${escape(en['join.error'])}</p>`));
    expect(html).toContain(en['join.retry']);
  });

  it('uses an en.json value for every join string, under dir="rtl"', () => {
    const html = [
      render({ kind: 'loading' }),
      render({ kind: 'not-found' }),
      render({ kind: 'gone' }),
      render({ kind: 'error' }),
      render({ kind: 'signed-out', name: NAME }),
      render({ kind: 'preview', name: NAME }),
      render({ kind: 'joining', name: NAME }),
      render({ kind: 'joined', name: NAME }),
    ].join('\n');
    expect(html).toContain('dir="rtl"');
    for (const [key, value] of Object.entries(en)) {
      if (!key.startsWith('join.')) continue;
      expect(html, key).toContain(escape(value));
    }
  });
});
