import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { MeResponse, UpdateMeRequestInput } from '@noor/contracts';
import { ApiError, apiClient } from '../../api/client';
import {
  SessionError,
  getIdToken,
  isConfigured,
  onChange,
  signIn as sessionSignIn,
  signOut as sessionSignOut,
} from '../../auth/session';
import { browserTimeZone, timezoneDefault } from './timezone-default';

export type SessionState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; me: MeResponse }
  | { kind: 'error'; hasSession: boolean };

export interface Session {
  state: SessionState;
  signIn(): void;
  signOut(): void;
  /** Saves a profile patch through the API and replaces `me` on success. */
  updateMe(patch: UpdateMeRequestInput): Promise<MeResponse>;
}

const SessionContext = createContext<Session | null>(null);

/**
 * The one place that loads `/v1/me`. Shows only what the API returns, never Firebase
 * user data. After the first load it fills a missing timezone from the browser.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() =>
    isConfigured() ? { kind: 'loading' } : { kind: 'unavailable' },
  );
  // Bumped on every auth change and on unmount, so a late API result is dropped.
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
          return apiClient.getMe({ idToken, signal: controller.signal }).then((me) => {
            if (isCurrent()) applyTimezoneDefault(idToken, me);
            return me;
          });
        })
        .then(
          (me) => {
            if (!isCurrent()) return;
            setState(me === null ? { kind: 'signed-out' } : { kind: 'signed-in', me });
          },
          () => {
            if (isCurrent()) setState({ kind: 'error', hasSession: true });
          },
        );

      // Fire-and-forget: a failure leaves the user without a timezone, as before.
      function applyTimezoneDefault(idToken: string, me: MeResponse) {
        const body = timezoneDefault(me, browserTimeZone());
        if (body === null) return;
        apiClient.updateMe({ idToken, body, signal: controller.signal }).then(
          (updated) => {
            if (isCurrent()) setState({ kind: 'signed-in', me: updated });
          },
          () => undefined,
        );
      }
    });

    return () => {
      unsubscribe();
      cancelPending();
    };
  }, []);

  const signIn = useCallback(() => {
    setState({ kind: 'loading' });
    // On success the onChange subscription takes over and loads /v1/me.
    sessionSignIn().catch((err: unknown) => {
      const cancelled = err instanceof SessionError && err.code === 'cancelled';
      setState(cancelled ? { kind: 'signed-out' } : { kind: 'error', hasSession: false });
    });
  }, []);

  const signOut = useCallback(() => {
    sessionSignOut().catch(() => setState({ kind: 'error', hasSession: true }));
  }, []);

  const updateMe = useCallback(async (patch: UpdateMeRequestInput) => {
    const current = generation.current;
    const idToken = await getIdToken();
    if (idToken === null) throw new ApiError('Not signed in', { status: 401 });
    const me = await apiClient.updateMe({ idToken, body: patch });
    if (current === generation.current) setState({ kind: 'signed-in', me });
    return me;
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, updateMe }),
    [state, signIn, signOut, updateMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession() needs a <SessionProvider>');
  return session;
}
