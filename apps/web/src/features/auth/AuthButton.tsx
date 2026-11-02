import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import { SessionError, getIdToken, isConfigured, onChange, signIn, signOut } from '../../auth/session';
import { AuthButtonView, type AuthViewState } from './AuthButtonView';

/** Header sign-in control. Shows only what `/v1/me` returns, never Firebase user data. */
export function AuthButton() {
  const [state, setState] = useState<AuthViewState>(() =>
    isConfigured() ? { kind: 'loading' } : { kind: 'unavailable' },
  );
  // Bumped on every auth change and on unmount, so a late /v1/me result is dropped.
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isConfigured()) return;

    const cancelPending = () => {
      generation.current += 1;
      pending.current?.abort();
      pending.current = null;
    };

    const unsubscribe = onChange((signedIn) => {
      cancelPending();
      if (!signedIn) {
        setState({ kind: 'signed-out' });
        return;
      }
      const current = generation.current;
      const controller = new AbortController();
      pending.current = controller;
      const isCurrent = () => !controller.signal.aborted && current === generation.current;

      setState({ kind: 'loading' });
      getIdToken()
        .then((idToken) => {
          if (idToken === null) return null;
          return apiClient.getMe({ idToken, signal: controller.signal });
        })
        .then(
          (me) => {
            if (!isCurrent()) return;
            setState(
              me === null ? { kind: 'signed-out' } : { kind: 'signed-in', displayName: me.displayName },
            );
          },
          () => {
            if (isCurrent()) setState({ kind: 'error', hasSession: true });
          },
        );
    });

    return () => {
      unsubscribe();
      cancelPending();
    };
  }, []);

  const handleSignIn = () => {
    setState({ kind: 'loading' });
    // On success the onChange subscription takes over and loads /v1/me.
    signIn().catch((err: unknown) => {
      const cancelled = err instanceof SessionError && err.code === 'cancelled';
      setState(cancelled ? { kind: 'signed-out' } : { kind: 'error', hasSession: false });
    });
  };

  const handleSignOut = () => {
    signOut().catch(() => setState({ kind: 'error', hasSession: true }));
  };

  return <AuthButtonView state={state} onSignIn={handleSignIn} onSignOut={handleSignOut} />;
}
