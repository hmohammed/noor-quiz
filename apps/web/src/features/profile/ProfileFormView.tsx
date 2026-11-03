import type { FormEvent, ReactNode } from 'react';
import type { Locale } from '@noor/contracts';
import { LOCALES } from '../../i18n/locales';
import { t } from '../../i18n/t';

/** Form values as shown. `''` means "not set yet". */
export interface ProfileValues {
  displayName: string;
  locale: Locale | '';
  timezone: string;
}

export type ProfileFormStatus = 'idle' | 'saving' | 'saved' | 'invalid-name' | 'error';

export type ProfileViewState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  /** The profile could not be loaded (nothing was saved). */
  | { kind: 'error' }
  | { kind: 'form'; status: ProfileFormStatus; values: ProfileValues };

export interface ProfileFormViewProps {
  state: ProfileViewState;
  /** IANA zones for the picker; the current value is always offered too. */
  timeZones: readonly string[];
  onChange<K extends keyof ProfileValues>(field: K, value: ProfileValues[K]): void;
  onSubmit(): void;
  /** Used by the `signed-out` state. */
  onSignIn?(): void;
  /** Used by the `error` state. */
  onRetry?(): void;
  /** Rendered after the form, only in the form state. Never inside the `<form>`. */
  afterForm?: ReactNode;
}

const NAME_ID = 'profile-display-name';
const NAME_HINT_ID = 'profile-display-name-hint';
const NAME_ERROR_ID = 'profile-display-name-error';
const LOCALE_ID = 'profile-locale';
const TIMEZONE_ID = 'profile-timezone';

export function ProfileFormView({
  state,
  timeZones,
  onChange,
  onSubmit,
  onSignIn,
  onRetry,
  afterForm,
}: ProfileFormViewProps) {
  const title = <h1 className="profile__title">{t('profile.title')}</h1>;

  switch (state.kind) {
    case 'loading':
      return (
        <main className="page">
          {title}
          <p role="status" aria-busy="true" className="profile__status">
            {t('profile.loading')}
          </p>
        </main>
      );
    case 'signed-out':
      return (
        <main className="page">
          {title}
          <p className="profile__status">{t('profile.signedOut')}</p>
          <button type="button" className="auth__button" onClick={onSignIn}>
            {t('auth.signIn')}
          </button>
        </main>
      );
    case 'unavailable':
      return (
        <main className="page">
          {title}
          <p className="profile__status">{t('profile.unavailable')}</p>
        </main>
      );
    case 'error':
      return (
        <main className="page">
          {title}
          <p role="alert" className="profile__error">
            {t('profile.error.load')}
          </p>
          <button type="button" className="auth__button" onClick={onRetry}>
            {t('profile.retry')}
          </button>
        </main>
      );
    case 'form':
      break;
  }

  const { status, values } = state;
  const saving = status === 'saving';
  const invalidName = status === 'invalid-name';
  const zones = timeZones.includes(values.timezone) ? timeZones : [values.timezone, ...timeZones];

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <main className="page">
      {title}
      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="profile-form__field">
          <label htmlFor={NAME_ID}>{t('profile.displayName')}</label>
          <input
            id={NAME_ID}
            name="displayName"
            type="text"
            dir="auto"
            autoComplete="nickname"
            className="profile-form__control"
            value={values.displayName}
            aria-invalid={invalidName || undefined}
            aria-describedby={invalidName ? `${NAME_HINT_ID} ${NAME_ERROR_ID}` : NAME_HINT_ID}
            onChange={(e) => onChange('displayName', e.target.value)}
          />
          <p id={NAME_HINT_ID} className="profile-form__hint">
            {t('profile.displayNameHint')}
          </p>
          {invalidName && (
            <p id={NAME_ERROR_ID} role="alert" className="profile__error">
              {t('profile.error.displayName')}
            </p>
          )}
        </div>

        <div className="profile-form__field">
          <label htmlFor={LOCALE_ID}>{t('profile.locale')}</label>
          <select
            id={LOCALE_ID}
            name="locale"
            className="profile-form__control"
            value={values.locale}
            onChange={(e) => onChange('locale', e.target.value as Locale)}
          >
            {values.locale === '' && <option value="">{t('profile.localeUnset')}</option>}
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code} dir={l.dir}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-form__field">
          <label htmlFor={TIMEZONE_ID}>{t('profile.timezone')}</label>
          <select
            id={TIMEZONE_ID}
            name="timezone"
            className="profile-form__control"
            dir="ltr"
            value={values.timezone}
            onChange={(e) => onChange('timezone', e.target.value)}
          >
            {zones.map((tz) =>
              tz === '' ? (
                <option key="" value="">
                  {t('profile.localeUnset')}
                </option>
              ) : (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="profile-form__actions">
          <button type="submit" className="auth__button" disabled={saving}>
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
          {status === 'saved' && (
            <p role="status" className="profile__status">
              {t('profile.saved')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="profile__error">
              {t('profile.error.generic')}
            </p>
          )}
        </div>
      </form>
      {afterForm}
    </main>
  );
}
