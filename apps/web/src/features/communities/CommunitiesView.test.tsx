import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CommunitySummary } from '@noor/contracts';
import en from '../../i18n/en.json';
import {
  CommunitiesView,
  type CommunitiesViewState,
  type CommunityFormStatus,
  type CommunityFormValues,
} from './CommunitiesView';

const noop = () => undefined;
const ZONES = ['Africa/Addis_Ababa', 'Europe/Stockholm'];
const VALUES: CommunityFormValues = { name: 'مسجد النور', timezone: 'Europe/Stockholm' };
const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const community = (role: CommunitySummary['role'], name = 'Masjid Al-Noor'): CommunitySummary => ({
  tenantId: ULID,
  name,
  slug: 'masjid-al-noor',
  timezone: 'Europe/Stockholm',
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const render = (state: CommunitiesViewState) =>
  renderToStaticMarkup(
    <CommunitiesView
      state={state}
      timeZones={ZONES}
      onNameChange={noop}
      onTimezoneChange={noop}
      onSubmit={noop}
    />,
  );

const ready = (
  status: CommunityFormStatus,
  communities: readonly CommunitySummary[],
  values: CommunityFormValues = VALUES,
) => render({ kind: 'ready', status, values, communities });

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('CommunitiesView', () => {
  it('loading: a busy status and no form', () => {
    const html = render({ kind: 'loading' });
    expect(html).toMatch(
      new RegExp(`<p role="status" aria-busy="true"[^>]*>${escape(en['community.loading'])}</p>`),
    );
    expect(html).not.toContain('<form');
  });

  it('signed-out: a prompt and a sign-in button, and no form', () => {
    const html = render({ kind: 'signed-out' });
    expect(html).toContain(en['community.signedOut']);
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${en['auth.signIn']}</button>`));
    expect(html).not.toContain('<form');
  });

  it('unavailable: says sign-in is unavailable, with no sign-in button', () => {
    const html = render({ kind: 'unavailable' });
    expect(html).toContain(escape(en['community.unavailable']));
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
  });

  it('load-error: an alert and a retry button, and no form', () => {
    const html = render({ kind: 'error' });
    expect(html).toMatch(
      new RegExp(`<p role="alert"[^>]*>${escape(en['community.error.load'])}</p>`),
    );
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${en['community.retry']}</button>`),
    );
    expect(html).not.toContain('<form');
  });

  it('empty list: keeps the form and shows the empty message', () => {
    const html = ready('idle', [], { name: '', timezone: '' });
    expect(html).toContain(escape(en['community.empty']));
    expect(html).toContain('<form');
    expect(html).toContain(`<label for="community-name">${en['community.name']}</label>`);
    expect(html).toContain(en['community.timezoneUnset']);
  });

  it('populated list: name, slug and every role, with the name escaped and dir="auto"', () => {
    const html = ready('idle', [
      community('member', "O'Brien Hall"),
      { ...community('scholar-reviewer'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAW' },
      { ...community('editor'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
      { ...community('admin'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB1' },
      { ...community('owner', '<b>Noor</b>'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB2' },
    ]);
    expect(html).toContain('O&#x27;Brien Hall');
    expect(html).toContain('&lt;b&gt;Noor&lt;/b&gt;');
    expect(html).not.toContain('<b>Noor</b>');
    expect(html).toMatch(/<span class="community__name" dir="auto">/);
    expect(html).toContain(en['community.slug']);
    expect(html).toContain('masjid-al-noor');
    for (const role of ['member', 'scholar-reviewer', 'editor', 'admin', 'owner'] as const) {
      expect(html).toContain(en[`community.role.${role}`]);
    }
    expect(html).toContain(`href="/communities/${ULID}/seasons"`);
    expect(html).toContain(en['season.link']);
  });

  it('renders the invite panel in that row and makes the rest of the page inert', () => {
    const html = renderToStaticMarkup(
      <CommunitiesView
        state={{ kind: 'ready', status: 'idle', values: VALUES, communities: [community('owner')] }}
        timeZones={ZONES}
        onNameChange={noop}
        onTimezoneChange={noop}
        onSubmit={noop}
        inviteFor={ULID}
        invitePanel={<section className="invite-dialog">link</section>}
      />,
    );
    expect(html).toContain('<main class="page">');
    expect(html).toMatch(
      /<ul class="community__list">[\s\S]*<section class="invite-dialog">link<\/section>[\s\S]*<\/ul>/,
    );
    expect(html).toContain('inert=""');
    expect(html).toMatch(
      /<div class="community__summary" inert="">[\s\S]*<\/div><section class="invite-dialog">link<\/section>/,
    );
    expect(html).not.toMatch(/<section class="invite-dialog"[^>]*inert/);
  });

  it('shows Invite for admin and owner only', () => {
    const label = en['community.invite'];
    for (const role of ['member', 'scholar-reviewer', 'editor'] as const) {
      expect(ready('idle', [community(role)])).not.toContain(`>${label}<`);
    }
    for (const role of ['admin', 'owner'] as const) {
      const html = ready('idle', [community(role)]);
      expect(html).toContain(`>${label}<`);
      expect(html).toMatch(/<button type="button"[^>]*class="auth__button community__invite"/);
    }
  });

  it('name input has dir="auto"', () => {
    const html = ready('idle', []);
    expect(html).toMatch(/<input[^>]*id="community-name"[^>]*dir="auto"/);
  });

  it('saving: the submit button is disabled and a status uses the saving label', () => {
    const html = ready('saving', []);
    expect(html).toMatch(
      new RegExp(
        `<button type="submit"[^>]*disabled=""[^>]*>${escape(en['community.saving'])}</button>`,
      ),
    );
    expect(html).toMatch(new RegExp(`<p role="status"[^>]*>${escape(en['community.saving'])}</p>`));
  });

  it('save-error: an alert and the form stays', () => {
    const html = ready('error', [community('owner')]);
    expect(html).toMatch(
      new RegExp(`<p role="alert"[^>]*>${escape(en['community.error.save'])}</p>`),
    );
    expect(html).not.toContain(en['community.error.created']);
    expect(html).toContain('<form');
    expect(html).toContain('Masjid Al-Noor');
  });

  it('created but the list failed: a different alert and Try again, not the save error', () => {
    const html = ready('list-error', []);
    expect(html).toContain(en['community.error.created']);
    expect(html).not.toContain(en['community.error.save']);
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${en['community.retry']}</button>`),
    );
    expect(html).not.toContain(escape(en['community.empty']));
    expect(html).toMatch(
      new RegExp(
        `<button type="submit"[^>]*disabled=""[^>]*>${escape(en['community.create'])}</button>`,
      ),
    );
    expect(html).toContain('<form');
  });

  it('uses an en.json value for every community string', () => {
    const html = [
      render({ kind: 'loading' }),
      render({ kind: 'signed-out' }),
      render({ kind: 'unavailable' }),
      render({ kind: 'error' }),
      ready('idle', [], { name: '', timezone: '' }),
      ready('saving', []),
      ready('error', []),
      ready('invalid-name', []),
      ready('invalid-timezone', [], { name: 'Masjid', timezone: '' }),
      ready('list-error', []),
      ready('idle', [
        community('member'),
        { ...community('scholar-reviewer'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAW' },
        { ...community('editor'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
        { ...community('admin'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB1' },
        { ...community('owner'), tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FB2' },
      ]),
    ].join('\n');
    for (const [key, value] of Object.entries(en)) {
      if (!key.startsWith('community.')) continue;
      if (key.startsWith('community.invite.') || key === 'community.invite') continue;
      expect(html, key).toContain(escape(value));
    }
  });
});
