import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import { AuthButtonView, type AuthViewState } from './AuthButtonView';

const noop = () => undefined;
const render = (state: AuthViewState) =>
  renderToStaticMarkup(<AuthButtonView state={state} onSignIn={noop} onSignOut={noop} />);

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const button = (label: string) =>
  new RegExp(`<button type="button"[^>]*>${escape(label)}</button>`);

describe('AuthButtonView', () => {
  it('signed-out: shows the sign-in button', () => {
    const html = render({ kind: 'signed-out' });
    expect(html).toMatch(button(en['auth.signIn']));
    expect(html).not.toContain(en['auth.signOut']);
  });

  it('loading: shows a busy status and no button', () => {
    const html = render({ kind: 'loading' });
    expect(html).toMatch(
      new RegExp(`<p role="status" aria-busy="true"[^>]*>${escape(en['auth.loading'])}</p>`),
    );
    expect(html).not.toContain('<button');
  });

  it('signed-in: shows the name with dir="auto" and a sign-out button', () => {
    const html = render({ kind: 'signed-in', displayName: 'أمينة' });
    expect(html).toMatch(/<span[^>]*dir="auto"[^>]*data-testid="auth-name"[^>]*>أمينة<\/span>/);
    expect(html).toMatch(button(en['auth.signOut']));
    expect(html).not.toContain(en['auth.signIn']);
  });

  it('signed-in without a name: shows the noName fallback', () => {
    const html = render({ kind: 'signed-in', displayName: null });
    expect(html).toContain(en['auth.noName']);
    expect(html).not.toContain('data-testid="auth-name"');
    expect(html).toMatch(button(en['auth.signOut']));
  });

  it('escapes the display name', () => {
    const html = render({ kind: 'signed-in', displayName: '<b>x</b>' });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('error without a session: shows an alert and the sign-in button to retry', () => {
    const html = render({ kind: 'error', hasSession: false });
    expect(html).toMatch(new RegExp(`<p role="alert"[^>]*>${escape(en['auth.error'])}</p>`));
    expect(html).toMatch(button(en['auth.signIn']));
    expect(html).not.toContain(en['auth.signOut']);
  });

  it('error with a session: shows an alert and the sign-out button', () => {
    const html = render({ kind: 'error', hasSession: true });
    expect(html).toMatch(new RegExp(`<p role="alert"[^>]*>${escape(en['auth.error'])}</p>`));
    expect(html).toMatch(button(en['auth.signOut']));
    expect(html).not.toContain(en['auth.signIn']);
  });

  it('unavailable: shows the message and no button', () => {
    const html = render({ kind: 'unavailable' });
    expect(html).toContain(en['auth.unavailable']);
    expect(html).not.toContain('<button');
  });

  it('never renders a raw auth.* key', () => {
    const states: AuthViewState[] = [
      { kind: 'loading' },
      { kind: 'unavailable' },
      { kind: 'signed-out' },
      { kind: 'signed-in', displayName: 'Amina' },
      { kind: 'signed-in', displayName: null },
      { kind: 'error', hasSession: false },
      { kind: 'error', hasSession: true },
    ];
    for (const state of states) expect(render(state)).not.toMatch(/auth\.[a-zA-Z]/);
  });
});
