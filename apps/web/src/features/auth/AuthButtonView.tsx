import { t } from '../../i18n/t';

export type AuthViewState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; displayName: string | null }
  | { kind: 'error'; hasSession: boolean };

export interface AuthButtonViewProps {
  state: AuthViewState;
  onSignIn(): void;
  onSignOut(): void;
}

export function AuthButtonView({ state, onSignIn, onSignOut }: AuthButtonViewProps) {
  const signInButton = (
    <button type="button" className="auth__button" onClick={onSignIn}>
      {t('auth.signIn')}
    </button>
  );
  const signOutButton = (
    <button type="button" className="auth__button" onClick={onSignOut}>
      {t('auth.signOut')}
    </button>
  );

  switch (state.kind) {
    case 'loading':
      return (
        <div className="auth">
          <p role="status" aria-busy="true" className="auth__status">
            {t('auth.loading')}
          </p>
        </div>
      );
    case 'unavailable':
      return (
        <div className="auth">
          <p className="auth__status">{t('auth.unavailable')}</p>
        </div>
      );
    case 'signed-out':
      return <div className="auth">{signInButton}</div>;
    case 'signed-in':
      return (
        <div className="auth">
          {state.displayName === null ? (
            <span className="auth__name">{t('auth.noName')}</span>
          ) : (
            // dir="auto" so an Arabic or Ge'ez name keeps its own direction on an LTR page.
            <span className="auth__name" dir="auto" data-testid="auth-name">
              {state.displayName}
            </span>
          )}
          {signOutButton}
        </div>
      );
    case 'error':
      return (
        <div className="auth">
          <p role="alert" className="auth__error">
            {t('auth.error')}
          </p>
          {state.hasSession ? signOutButton : signInButton}
        </div>
      );
  }
}
