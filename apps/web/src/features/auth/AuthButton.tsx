import { AuthButtonView, type AuthViewState } from './AuthButtonView';
import { useSession, type SessionState } from './session-context';

function toViewState(state: SessionState): AuthViewState {
  return state.kind === 'signed-in'
    ? { kind: 'signed-in', displayName: state.me.displayName }
    : state;
}

/** Header sign-in control. Shows only what `/v1/me` returns, never Firebase user data. */
export function AuthButton() {
  const { state, signIn, signOut } = useSession();
  return <AuthButtonView state={toViewState(state)} onSignIn={signIn} onSignOut={signOut} />;
}
