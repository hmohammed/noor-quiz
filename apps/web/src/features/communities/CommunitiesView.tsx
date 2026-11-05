import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import type { CommunitySummary } from '@noor/contracts';
import { t } from '../../i18n/t';

export interface CommunityFormValues {
  name: string;
  timezone: string;
}

export type CommunityFormStatus =
  'idle' | 'saving' | 'invalid-name' | 'invalid-timezone' | 'error' | 'list-error';

export type CommunityLeaveError = 'last-owner' | 'generic' | null;

export type CommunitiesViewState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      status: CommunityFormStatus;
      values: CommunityFormValues;
      communities: readonly CommunitySummary[];
      confirmLeaveTenantId: string | null;
      leaving: boolean;
      leaveError: CommunityLeaveError;
    };

export interface CommunitiesViewProps {
  state: CommunitiesViewState;
  /** IANA zones for the picker; the current value is always offered too. */
  timeZones: readonly string[];
  onNameChange(value: string): void;
  onTimezoneChange(value: string): void;
  onSubmit(): void;
  /** Shown for admin and owner rows. The button element is the focus to restore on close. */
  onInvite?(community: CommunitySummary, opener: HTMLButtonElement): void;
  /**
   * Inline invite panel for this tenant, rendered in that row. While set, the rest of
   * the page is inert so a second tap cannot create another link.
   */
  inviteFor?: string;
  invitePanel?: ReactNode;
  /** Start the leave confirm step for this community. */
  onLeaveStart?(community: CommunitySummary): void;
  /** Confirm leave for this community. */
  onLeave?(community: CommunitySummary): void;
  /** Cancel the leave confirm step. */
  onLeaveCancel?(): void;
  /** Used by the `signed-out` state. */
  onSignIn?(): void;
  /** Used by the load-error state. */
  onRetry?(): void;
}

const NAME_ID = 'community-name';
const NAME_HINT_ID = 'community-name-hint';
const NAME_ERROR_ID = 'community-name-error';
const TIMEZONE_ID = 'community-timezone';
const TIMEZONE_ERROR_ID = 'community-timezone-error';

export function CommunitiesView({
  state,
  timeZones,
  onNameChange,
  onTimezoneChange,
  onSubmit,
  onInvite,
  inviteFor,
  invitePanel,
  onLeaveStart,
  onLeave,
  onLeaveCancel,
  onSignIn,
  onRetry,
}: CommunitiesViewProps) {
  const cancelLeaveRef = useRef<HTMLButtonElement>(null);
  const confirmingLeave = state.kind === 'ready' ? state.confirmLeaveTenantId : null;

  useEffect(() => {
    if (confirmingLeave) cancelLeaveRef.current?.focus();
  }, [confirmingLeave]);

  const locked = inviteFor !== undefined;
  const title = (
    <h1 className="community__title" inert={locked ? true : undefined}>
      {t('community.title')}
    </h1>
  );

  switch (state.kind) {
    case 'loading':
      return (
        <main className="page">
          {title}
          <p role="status" aria-busy="true" className="community__status">
            {t('community.loading')}
          </p>
        </main>
      );
    case 'signed-out':
      return (
        <main className="page">
          {title}
          <p className="community__status">{t('community.signedOut')}</p>
          <button type="button" className="auth__button" onClick={onSignIn}>
            {t('auth.signIn')}
          </button>
        </main>
      );
    case 'unavailable':
      return (
        <main className="page">
          {title}
          <p className="community__status">{t('community.unavailable')}</p>
        </main>
      );
    case 'error':
      return (
        <main className="page">
          {title}
          <p role="alert" className="community__error">
            {t('community.error.load')}
          </p>
          <button type="button" className="auth__button" onClick={onRetry}>
            {t('community.retry')}
          </button>
        </main>
      );
    case 'ready':
      break;
  }

  const { status, values, communities, confirmLeaveTenantId, leaving, leaveError } = state;
  const saving = status === 'saving';
  const listError = status === 'list-error';
  const invalidName = status === 'invalid-name';
  const invalidTimezone = status === 'invalid-timezone';
  const zones =
    values.timezone === '' || timeZones.includes(values.timezone)
      ? timeZones
      : [values.timezone, ...timeZones];

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <main className="page">
      {title}
      {leaveError === 'last-owner' && (
        <p role="alert" className="community__error">
          {t('community.leave.lastOwner')}
        </p>
      )}
      {leaveError === 'generic' && (
        <p role="alert" className="community__error">
          {t('community.leave.error')}
        </p>
      )}
      {communities.length === 0 ? (
        listError ? null : (
          <p className="community__status">{t('community.empty')}</p>
        )
      ) : (
        <ul className="community__list">
          {communities.map((community) => {
            const active = inviteFor === community.tenantId;
            const confirmingLeave = confirmLeaveTenantId === community.tenantId;
            const canManageMembers = community.role === 'admin' || community.role === 'owner';
            return (
              <li
                key={community.tenantId}
                className="community__item"
                inert={locked && !active ? true : undefined}
              >
                <div className="community__summary" inert={active ? true : undefined}>
                  <span className="community__name" dir="auto">
                    {community.name}
                  </span>
                  <span className="community__slug">
                    {t('community.slug')} {community.slug}
                  </span>
                  <span className="community__role">{t(`community.role.${community.role}`)}</span>
                  <a className="season__link" href={`/communities/${community.tenantId}/seasons`}>
                    {t('season.link')}
                  </a>
                  {canManageMembers && (
                    <a className="season__link" href={`/communities/${community.tenantId}/members`}>
                      {t('members.link')}
                    </a>
                  )}
                  {(community.role === 'admin' || community.role === 'owner') && (
                    <button
                      type="button"
                      className="auth__button community__invite"
                      onClick={(e) => onInvite?.(community, e.currentTarget)}
                    >
                      {t('community.invite')}
                    </button>
                  )}
                  {!confirmingLeave && (
                    <button
                      type="button"
                      className="auth__button community__leave"
                      disabled={leaving || undefined}
                      onClick={() => onLeaveStart?.(community)}
                    >
                      {t('community.leave')}
                    </button>
                  )}
                  {confirmingLeave && (
                    <div
                      className="community__leave-confirm"
                      aria-busy={leaving ? true : undefined}
                    >
                      <p>{t('community.leave.confirmPrompt')}</p>
                      <div className="community__leave-actions">
                        <button
                          type="button"
                          className="community__leave-confirm-button"
                          disabled={leaving || undefined}
                          onClick={() => onLeave?.(community)}
                        >
                          {leaving ? t('community.leave.leaving') : t('community.leave.confirm')}
                        </button>
                        <button
                          type="button"
                          className="community__leave-cancel"
                          ref={cancelLeaveRef}
                          disabled={leaving || undefined}
                          onClick={onLeaveCancel}
                        >
                          {t('community.leave.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {active ? invitePanel : null}
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="community__form"
        onSubmit={handleSubmit}
        noValidate
        inert={locked ? true : undefined}
      >
        <div className="community__field">
          <label htmlFor={NAME_ID}>{t('community.name')}</label>
          <input
            id={NAME_ID}
            name="name"
            type="text"
            dir="auto"
            className="community__control"
            value={values.name}
            disabled={saving || undefined}
            aria-invalid={invalidName || undefined}
            aria-describedby={invalidName ? `${NAME_HINT_ID} ${NAME_ERROR_ID}` : NAME_HINT_ID}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <p id={NAME_HINT_ID} className="community__hint">
            {t('community.nameHint')}
          </p>
          {invalidName && (
            <p id={NAME_ERROR_ID} role="alert" className="community__error">
              {t('community.error.name')}
            </p>
          )}
        </div>
        <div className="community__field">
          <label htmlFor={TIMEZONE_ID}>{t('community.timezone')}</label>
          <select
            id={TIMEZONE_ID}
            name="timezone"
            className="community__control"
            dir="ltr"
            value={values.timezone}
            disabled={saving || undefined}
            aria-invalid={invalidTimezone || undefined}
            aria-describedby={invalidTimezone ? TIMEZONE_ERROR_ID : undefined}
            onChange={(e) => onTimezoneChange(e.target.value)}
          >
            {values.timezone === '' && <option value="">{t('community.timezoneUnset')}</option>}
            {zones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {invalidTimezone && (
            <p id={TIMEZONE_ERROR_ID} role="alert" className="community__error">
              {t('community.error.timezone')}
            </p>
          )}
        </div>
        <div className="community__actions">
          <button type="submit" className="auth__button" disabled={saving || listError}>
            {saving ? t('community.saving') : t('community.create')}
          </button>
          {saving && (
            <p role="status" className="community__status">
              {t('community.saving')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="community__error">
              {t('community.error.save')}
            </p>
          )}
          {status === 'list-error' && (
            <>
              <p role="alert" className="community__error">
                {t('community.error.created')}
              </p>
              <button type="button" className="auth__button" onClick={onRetry}>
                {t('community.retry')}
              </button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
