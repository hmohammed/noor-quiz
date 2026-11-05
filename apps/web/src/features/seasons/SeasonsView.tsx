import type { FormEvent } from 'react';
import { SEASON_KINDS, type SeasonView } from '@noor/contracts';
import { t } from '../../i18n/t';

export interface SeasonFormValues {
  name: string;
  kind: string;
  timezone: string;
  startDate: string;
  lengthDays: string;
  opensAtLocal: string;
  closesAtLocal: string;
}

export type SeasonFormStatus =
  'idle' | 'saving' | 'suggesting' | 'invalid' | 'error' | 'suggest-error' | 'list-error';

export type SeasonsViewState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      role: 'member' | 'scholar-reviewer' | 'editor' | 'admin' | 'owner';
      status: SeasonFormStatus;
      values: SeasonFormValues;
      seasons: readonly SeasonView[];
    };

export interface SeasonsViewProps {
  state: SeasonsViewState;
  timeZones: readonly string[];
  onNameChange(value: string): void;
  onKindChange(value: string): void;
  onTimezoneChange(value: string): void;
  onStartDateChange(value: string): void;
  onLengthChange(value: string): void;
  onOpensChange(value: string): void;
  onClosesChange(value: string): void;
  onSubmit(): void;
  onSuggest(): void;
  onSignIn?(): void;
  onRetry?(): void;
}

const NAME_ID = 'season-name';
const KIND_ID = 'season-kind';
const TIMEZONE_ID = 'season-timezone';
const START_ID = 'season-start';
const LENGTH_ID = 'season-length';
const OPENS_ID = 'season-opens';
const CLOSES_ID = 'season-closes';

/** Fills start date and length only. The form is not submitted. */
export function applyRamadanSuggestion(
  values: SeasonFormValues,
  suggestion: { startDate: string; lengthDays: number },
): SeasonFormValues {
  return {
    ...values,
    startDate: suggestion.startDate,
    lengthDays: String(suggestion.lengthDays),
  };
}

function stateLabel(state: SeasonView['state']): string {
  if (state.phase === 'upcoming') return t('season.state.upcoming');
  if (state.phase === 'ended') return t('season.state.ended');
  return `${t('season.state.active')} ${state.dayIndex}`;
}

function canCreate(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

export function SeasonsView({
  state,
  timeZones,
  onNameChange,
  onKindChange,
  onTimezoneChange,
  onStartDateChange,
  onLengthChange,
  onOpensChange,
  onClosesChange,
  onSubmit,
  onSuggest,
  onSignIn,
  onRetry,
}: SeasonsViewProps) {
  const title = <h1 className="season__title">{t('season.title')}</h1>;

  switch (state.kind) {
    case 'loading':
      return (
        <main className="page">
          {title}
          <p role="status" aria-busy="true" className="season__status">
            {t('season.loading')}
          </p>
        </main>
      );
    case 'signed-out':
      return (
        <main className="page">
          {title}
          <p className="season__status">{t('season.signedOut')}</p>
          <button type="button" className="auth__button" onClick={onSignIn}>
            {t('auth.signIn')}
          </button>
        </main>
      );
    case 'unavailable':
      return (
        <main className="page">
          {title}
          <p className="season__status">{t('season.unavailable')}</p>
        </main>
      );
    case 'error':
      return (
        <main className="page">
          {title}
          <p role="alert" className="season__error">
            {t('season.error.load')}
          </p>
          <button type="button" className="auth__button" onClick={onRetry}>
            {t('season.retry')}
          </button>
        </main>
      );
    case 'ready':
      break;
  }

  const { status, values, seasons, role } = state;
  const showForm = canCreate(role);
  const saving = status === 'saving';
  const suggesting = status === 'suggesting';
  const listError = status === 'list-error';
  const busy = saving || suggesting;
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
      {seasons.length === 0 ? (
        listError ? null : (
          <p className="season__status">{t('season.empty')}</p>
        )
      ) : (
        <ul className="season__list">
          {seasons.map((season) => (
            <li key={season.id} className="season__item">
              <span className="season__name" dir="auto">
                {season.name}
              </span>
              <span className="season__meta">
                <bdi dir="ltr">{season.startDate}</bdi>
              </span>
              <span className="season__meta">{stateLabel(season.state)}</span>
            </li>
          ))}
        </ul>
      )}
      {showForm && (
        <form className="season__form" onSubmit={handleSubmit} noValidate>
          <div className="season__field">
            <label htmlFor={NAME_ID}>{t('season.name')}</label>
            <input
              id={NAME_ID}
              name="name"
              type="text"
              dir="auto"
              className="season__control"
              value={values.name}
              disabled={busy || undefined}
              onChange={(e) => onNameChange(e.target.value)}
            />
            <p className="season__hint">{t('season.nameHint')}</p>
          </div>
          <div className="season__field">
            <label htmlFor={KIND_ID}>{t('season.kind')}</label>
            <select
              id={KIND_ID}
              name="kind"
              className="season__control"
              value={values.kind}
              disabled={busy || undefined}
              onChange={(e) => onKindChange(e.target.value)}
            >
              {SEASON_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`season.kind.${kind}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="season__field">
            <label htmlFor={TIMEZONE_ID}>{t('season.timezone')}</label>
            <select
              id={TIMEZONE_ID}
              name="timezone"
              className="season__control"
              dir="ltr"
              value={values.timezone}
              disabled={busy || undefined}
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              {zones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="season__field">
            <label htmlFor={START_ID}>{t('season.startDate')}</label>
            <input
              id={START_ID}
              name="startDate"
              type="date"
              dir="ltr"
              className="season__control"
              value={values.startDate}
              disabled={busy || undefined}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          <div className="season__field">
            <label htmlFor={LENGTH_ID}>{t('season.lengthDays')}</label>
            <input
              id={LENGTH_ID}
              name="lengthDays"
              type="number"
              dir="ltr"
              className="season__control"
              min={1}
              max={366}
              step={1}
              value={values.lengthDays}
              disabled={busy || undefined}
              onChange={(e) => onLengthChange(e.target.value)}
            />
          </div>
          <div className="season__field">
            <label htmlFor={OPENS_ID}>{t('season.opensAt')}</label>
            <input
              id={OPENS_ID}
              name="opensAtLocal"
              type="time"
              dir="ltr"
              className="season__control"
              value={values.opensAtLocal}
              disabled={busy || undefined}
              onChange={(e) => onOpensChange(e.target.value)}
            />
          </div>
          <div className="season__field">
            <label htmlFor={CLOSES_ID}>{t('season.closesAt')}</label>
            <input
              id={CLOSES_ID}
              name="closesAtLocal"
              type="time"
              dir="ltr"
              className="season__control"
              value={values.closesAtLocal}
              disabled={busy || undefined}
              onChange={(e) => onClosesChange(e.target.value)}
            />
          </div>
          {values.kind === 'ramadan' && (
            <div className="season__actions">
              <p className="season__hint">{t('season.suggestionHint')}</p>
              <button
                type="button"
                className="auth__button"
                disabled={busy || undefined}
                onClick={onSuggest}
              >
                {suggesting ? t('season.suggesting') : t('season.suggest')}
              </button>
            </div>
          )}
          <div className="season__actions">
            <button
              type="submit"
              className="auth__button"
              disabled={busy || listError || undefined}
            >
              {saving ? t('season.saving') : t('season.create')}
            </button>
            {status === 'invalid' && (
              <p role="alert" className="season__error">
                {t('season.error.form')}
              </p>
            )}
            {status === 'error' && (
              <p role="alert" className="season__error">
                {t('season.error.save')}
              </p>
            )}
            {listError && (
              <>
                <p role="alert" className="season__error">
                  {t('season.error.created')}
                </p>
                <button type="button" className="auth__button" onClick={onRetry}>
                  {t('season.retry')}
                </button>
              </>
            )}
            {status === 'suggest-error' && (
              <p role="alert" className="season__error">
                {t('season.error.suggest')}
              </p>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
