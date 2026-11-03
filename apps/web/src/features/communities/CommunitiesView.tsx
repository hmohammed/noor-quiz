import type { FormEvent } from 'react';
import type { CommunitySummary } from '@noor/contracts';
import { t } from '../../i18n/t';

export interface CommunityFormValues {
  name: string;
  timezone: string;
}

export type CommunityFormStatus =
  'idle' | 'saving' | 'invalid-name' | 'invalid-timezone' | 'error' | 'list-error';

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
    };

export interface CommunitiesViewProps {
  state: CommunitiesViewState;
  /** IANA zones for the picker; the current value is always offered too. */
  timeZones: readonly string[];
  onNameChange(value: string): void;
  onTimezoneChange(value: string): void;
  onSubmit(): void;
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
  onSignIn,
  onRetry,
}: CommunitiesViewProps) {
  const title = <h1 className="community__title">{t('community.title')}</h1>;

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

  const { status, values, communities } = state;
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
      {communities.length === 0 ? (
        listError ? null : (
          <p className="community__status">{t('community.empty')}</p>
        )
      ) : (
        <ul className="community__list">
          {communities.map((community) => (
            <li key={community.tenantId} className="community__item">
              <span className="community__name" dir="auto">
                {community.name}
              </span>
              <span className="community__slug">
                {t('community.slug')} {community.slug}
              </span>
              <span className="community__role">{t(`community.role.${community.role}`)}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="community__form" onSubmit={handleSubmit} noValidate>
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
