import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CommunityRole, MemberView } from '@noor/contracts';
import en from '../../i18n/en.json';
import { MembersView, type MembersViewState } from './MembersView';

const noop = () => undefined;
const ACTOR = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const THIRD = '01ARZ3NDEKTSV4RRFFQ69G5FB0';

const member = (
  userId: string,
  role: CommunityRole,
  displayName: string | null = 'Ada',
): MemberView => ({
  userId,
  role,
  displayName,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const ready = (
  overrides: Partial<Extract<MembersViewState, { kind: 'ready' }>> & {
    actorRole: CommunityRole;
    members: readonly MemberView[];
  },
): MembersViewState => ({
  kind: 'ready',
  actorUserId: ACTOR,
  drafts: {},
  savingUserId: null,
  saveError: null,
  confirmRemoveUserId: null,
  removing: false,
  removeError: false,
  ...overrides,
});

const render = (
  state: MembersViewState,
  handlers: Partial<Parameters<typeof MembersView>[0]> = {},
) =>
  renderToStaticMarkup(
    <MembersView
      state={state}
      onSignIn={noop}
      onRetry={noop}
      onDraftChange={noop}
      onSave={noop}
      onRemoveStart={noop}
      onRemove={noop}
      onRemoveCancel={noop}
      {...handlers}
    />,
  );

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');

describe('MembersView', () => {
  it('loading: a busy status', () => {
    const html = render({ kind: 'loading' });
    expect(html).toMatch(
      new RegExp(`<p role="status" aria-busy="true"[^>]*>${escape(en['members.loading'])}</p>`),
    );
  });

  it('signed-out: a prompt and a sign-in button', () => {
    const html = render({ kind: 'signed-out' });
    expect(html).toContain(en['members.signedOut']);
    expect(html).toContain(en['auth.signIn']);
  });

  it('unavailable: says sign-in is unavailable', () => {
    const html = render({ kind: 'unavailable' });
    expect(html).toContain(escape(en['members.unavailable']));
    expect(html).not.toContain('<button');
  });

  it('load-error: an alert and a retry button', () => {
    const html = render({ kind: 'error' });
    expect(html).toContain(escape(en['members.error.load']));
    expect(html).toContain(en['members.retry']);
  });

  it('forbidden: the forbidden copy and no member names', () => {
    const html = render({ kind: 'forbidden' });
    expect(html).toContain(escape(en['members.forbidden']));
    expect(html).not.toContain('Ada');
    expect(html).not.toContain(OTHER);
  });

  it('ready list: names use dir="auto" and show the role label', () => {
    const html = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner', 'Owner Name'), member(OTHER, 'editor', 'Editor Name')],
      }),
    );
    expect(html).toMatch(/<span class="members__name" dir="auto">Owner Name<\/span>/);
    expect(html).toContain(en['community.role.editor']);
    expect(html).toContain('Editor Name');
  });

  it('own row has no role select and no Remove', () => {
    const html = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner', 'Me'), member(OTHER, 'member', 'Them')],
      }),
    );
    expect(html).not.toContain(`id="member-role-${ACTOR}"`);
    const ownBlock = html.slice(
      html.indexOf(`data-user="${ACTOR}"`),
      html.indexOf(`data-user="${OTHER}"`),
    );
    expect(ownBlock).not.toContain(en['members.remove']);
    expect(ownBlock).not.toContain('<select');
  });

  it("an admin's row for an editor offers Member through Admin, not Owner", () => {
    const html = render(
      ready({
        actorRole: 'admin',
        members: [member(ACTOR, 'admin', 'Admin'), member(OTHER, 'editor', 'Editor')],
      }),
    );
    const select = html.slice(
      html.indexOf(`id="member-role-${OTHER}"`),
      html.indexOf('</select>', html.indexOf(`id="member-role-${OTHER}"`)) + '</select>'.length,
    );
    expect(select).toContain(en['community.role.member']);
    expect(select).toContain(en['community.role.scholar-reviewer']);
    expect(select).toContain(en['community.role.editor']);
    expect(select).toContain(en['community.role.admin']);
    expect(select).not.toContain(`>${en['community.role.owner']}<`);
  });

  it("an owner's row for an editor also offers Owner", () => {
    const html = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner', 'Owner'), member(OTHER, 'editor', 'Editor')],
      }),
    );
    const select = html.slice(
      html.indexOf(`id="member-role-${OTHER}"`),
      html.indexOf('</select>', html.indexOf(`id="member-role-${OTHER}"`)) + '</select>'.length,
    );
    expect(select).toContain(`>${en['community.role.owner']}<`);
  });

  it("an admin's row for an owner has neither a select nor Remove", () => {
    const html = render(
      ready({
        actorRole: 'admin',
        members: [member(ACTOR, 'admin', 'Admin'), member(OTHER, 'owner', 'Owner')],
      }),
    );
    expect(html).not.toContain(`id="member-role-${OTHER}"`);
    const otherBlock = html.slice(html.indexOf(`data-user="${OTHER}"`));
    expect(otherBlock).not.toContain(en['members.remove']);
  });

  it('Remove uses a confirm step before it calls the handler', () => {
    const onRemove = vi.fn();
    const onRemoveStart = vi.fn();
    const confirming = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner'), member(OTHER, 'member')],
        confirmRemoveUserId: OTHER,
      }),
      { onRemove, onRemoveStart },
    );
    expect(confirming).toContain(en['members.remove.confirmPrompt']);
    expect(confirming).toContain(en['members.remove.confirm']);
    expect(confirming).toContain(en['members.remove.cancel']);
    expect(onRemove).not.toHaveBeenCalled();
    expect(onRemoveStart).not.toHaveBeenCalled();

    const idle = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner'), member(OTHER, 'member')],
      }),
    );
    expect(idle).toContain(en['members.remove']);
    expect(idle).not.toContain(en['members.remove.confirmPrompt']);
  });

  it('a 409 from a role save shows the last-owner copy', () => {
    const html = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner'), member(OTHER, 'admin'), member(THIRD, 'owner')],
        saveError: 'last-owner',
      }),
    );
    expect(html).toContain(en['members.error.lastOwner']);
  });

  it('unnamed members use the unnamed copy', () => {
    const html = render(
      ready({
        actorRole: 'owner',
        members: [member(ACTOR, 'owner', null)],
      }),
    );
    expect(html).toContain(en['members.unnamed']);
  });
});
