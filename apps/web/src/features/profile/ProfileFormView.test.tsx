import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import {
  ProfileFormView,
  type ProfileFormStatus,
  type ProfileValues,
  type ProfileViewState,
} from './ProfileFormView';

const noop = () => undefined;
const ZONES = ['Africa/Addis_Ababa', 'Europe/Stockholm'];
const VALUES: ProfileValues = { displayName: 'ሀሰን', locale: 'am', timezone: 'Europe/Stockholm' };

const render = (state: ProfileViewState) =>
  renderToStaticMarkup(
    <ProfileFormView state={state} timeZones={ZONES} onChange={noop} onSubmit={noop} />,
  );
const form = (status: ProfileFormStatus = 'idle', values: ProfileValues = VALUES) =>
  render({ kind: 'form', status, values });

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('ProfileFormView', () => {
  it('labels the name input and gives it dir="auto"', () => {
    const html = form();
    expect(html).toMatch(
      new RegExp(`<label for="profile-display-name">${escape(en['profile.displayName'])}</label>`),
    );
    expect(html).toMatch(/<input[^>]*id="profile-display-name"[^>]*dir="auto"[^>]*value="ሀሰን"/);
  });

  it('offers the five locales by their own names, each with its lang attribute', () => {
    const html = form();
    expect(html).toMatch(new RegExp(`<label for="profile-locale">${en['profile.locale']}</label>`));
    for (const [code, name] of [
      ['en', 'English'],
      ['sv', 'Svenska'],
      ['ar', 'العربية'],
      ['am', 'አማርኛ'],
      ['so', 'Soomaali'],
    ]) {
      expect(html).toMatch(
        new RegExp(`<option value="${code}" lang="${code}"[^>]*>${name}</option>`),
      );
    }
    expect(html).toMatch(/<option value="ar" lang="ar" dir="rtl"/);
    expect(html).not.toContain(en['profile.localeUnset']);
  });

  it('adds a "not set" option when locale and timezone are unset', () => {
    const html = form('idle', { displayName: '', locale: '', timezone: '' });
    expect(html).toMatch(new RegExp(`<option value=""[^>]*>${en['profile.localeUnset']}</option>`));
    expect(html.match(/<option value=""/g)).toHaveLength(2);
  });

  it('has a labelled timezone select that always includes the current value', () => {
    const html = form('idle', { ...VALUES, timezone: 'Asia/Riyadh' });
    expect(html).toMatch(
      new RegExp(`<label for="profile-timezone">${en['profile.timezone']}</label>`),
    );
    expect(html).toMatch(/<select[^>]*id="profile-timezone"/);
    expect(html).toContain('<option value="Asia/Riyadh"');
    expect(html).toContain('<option value="Africa/Addis_Ababa"');
  });

  it('loading: busy status and no form', () => {
    const html = render({ kind: 'loading' });
    expect(html).toMatch(
      new RegExp(`<p role="status" aria-busy="true"[^>]*>${escape(en['profile.loading'])}</p>`),
    );
    expect(html).not.toContain('<form');
  });

  it('signed-out: prompt, its own sign-in button and no form', () => {
    const html = render({ kind: 'signed-out' });
    expect(html).toContain(en['profile.signedOut']);
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['auth.signIn']}</button>`));
    expect(html).not.toContain('<form');
  });

  it('unavailable: says sign-in is unavailable, with no sign-in prompt or button', () => {
    const html = render({ kind: 'unavailable' });
    expect(html).toContain(escape(en['profile.unavailable']).replace(/'/g, '&#x27;'));
    expect(html).not.toContain(en['profile.signedOut']);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
  });

  it('load error: a load-failure alert (not the save message), a retry button and no form', () => {
    const html = render({ kind: 'error' });
    expect(html).toMatch(
      new RegExp(
        `<p role="alert"[^>]*>${escape(en['profile.error.load']).replace(/'/g, '&#x27;')}</p>`,
      ),
    );
    expect(html).not.toContain(en['profile.error.generic']);
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['profile.retry']}</button>`));
    expect(html).not.toContain('<form');
  });

  it('saving: the submit button is disabled and says saving', () => {
    const html = form('saving');
    expect(html).toMatch(
      new RegExp(
        `<button type="submit"[^>]*disabled=""[^>]*>${escape(en['profile.saving'])}</button>`,
      ),
    );
  });

  it('idle: the submit button is enabled', () => {
    const html = form();
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>${en['profile.save']}</button>`));
    expect(html).not.toContain('disabled');
  });

  it('saved: a status message', () => {
    expect(form('saved')).toMatch(new RegExp(`<p role="status"[^>]*>${en['profile.saved']}</p>`));
  });

  it('invalid-name: an alert tied to the name input', () => {
    const html = form('invalid-name');
    expect(html).toMatch(
      new RegExp(
        `<p id="profile-display-name-error" role="alert"[^>]*>${escape(en['profile.error.displayName'])}</p>`,
      ),
    );
    expect(html).toMatch(
      /<input[^>]*aria-invalid="true"[^>]*aria-describedby="[^"]*profile-display-name-error"/,
    );
  });

  it('error: an alert and the form stays', () => {
    const html = form('error');
    expect(html).toMatch(new RegExp(`<p role="alert"[^>]*>${en['profile.error.generic']}</p>`));
    expect(html).toContain('<form');
  });

  it('escapes the display name', () => {
    expect(form('idle', { ...VALUES, displayName: '"><b>x' })).toContain(
      'value="&quot;&gt;&lt;b&gt;x"',
    );
  });

  it('never renders a raw profile.* key', () => {
    const states: ProfileViewState[] = [
      { kind: 'loading' },
      { kind: 'signed-out' },
      { kind: 'unavailable' },
      { kind: 'error' },
      ...(['idle', 'saving', 'saved', 'invalid-name', 'error'] as const).map((status) => ({
        kind: 'form' as const,
        status,
        values: { displayName: '', locale: '' as const, timezone: '' },
      })),
    ];
    for (const state of states) expect(render(state)).not.toMatch(/profile\.[a-zA-Z]/);
  });
});
