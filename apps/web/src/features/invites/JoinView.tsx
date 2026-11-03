import { t } from '../../i18n/t';

export type JoinViewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'gone' }
  | { kind: 'error' }
  | { kind: 'signed-out'; name: string }
  | { kind: 'preview'; name: string }
  | { kind: 'joining'; name: string }
  | { kind: 'joined'; name: string };

export interface JoinViewProps {
  state: JoinViewState;
  onJoin(): void;
  onRetry(): void;
}

function Name({ name }: { name: string }) {
  return (
    <p className="join__name" dir="auto">
      {name}
    </p>
  );
}

/** Join page states. The community name uses dir="auto". No hard-coded copy. */
export function JoinView({ state, onJoin, onRetry }: JoinViewProps) {
  const title = <h1 className="join__title">{t('join.title')}</h1>;

  if (state.kind === 'loading') {
    return (
      <main className="page">
        {title}
        <p role="status" aria-busy="true" className="join__status">
          {t('join.loading')}
        </p>
      </main>
    );
  }
  if (state.kind === 'not-found') {
    return (
      <main className="page">
        {title}
        <p role="status" className="join__status">
          {t('join.notFound')}
        </p>
      </main>
    );
  }
  if (state.kind === 'gone') {
    return (
      <main className="page">
        {title}
        <p role="status" className="join__status">
          {t('join.gone')}
        </p>
      </main>
    );
  }
  if (state.kind === 'error') {
    return (
      <main className="page">
        {title}
        <p role="alert" className="join__error">
          {t('join.error')}
        </p>
        <button type="button" className="auth__button" onClick={onRetry}>
          {t('join.retry')}
        </button>
      </main>
    );
  }
  if (state.kind === 'joined') {
    return (
      <main className="page">
        {title}
        <p role="status" className="join__status">
          {t('join.joined')}
        </p>
        <Name name={state.name} />
      </main>
    );
  }

  const joining = state.kind === 'joining';
  return (
    <main className="page">
      {title}
      <Name name={state.name} />
      {state.kind === 'signed-out' && <p className="join__status">{t('join.signIn')}</p>}
      <div className="join__actions">
        <button
          type="button"
          className="auth__button"
          onClick={onJoin}
          disabled={joining || undefined}
        >
          {joining ? t('join.joining') : t('join.join')}
        </button>
        {joining && (
          <p role="status" className="join__status">
            {t('join.joining')}
          </p>
        )}
      </div>
    </main>
  );
}
