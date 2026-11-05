import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError, apiClient } from '../../api/client';
import { useSession } from '../auth/session-context';
import { JoinView, type JoinViewState } from './JoinView';

type Preview =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'gone' }
  | { kind: 'error' }
  | { kind: 'ready'; name: string };

type Phase = 'idle' | 'joining' | { kind: 'joined'; name: string } | 'error';

/**
 * `/join/:token`. Loads the public preview with no auth header and does not
 * accept until the visitor clicks Join. A signed-out Join calls `signIn()` and
 * stays on this URL. After success the name comes from the accept response.
 */
export function JoinPage() {
  const { token } = useParams();
  const session = useSession();
  const [preview, setPreview] = useState<Preview>({ kind: 'loading' });
  const [phase, setPhase] = useState<Phase>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setPreview({ kind: 'not-found' });
      return;
    }
    let cancelled = false;
    setPreview({ kind: 'loading' });
    apiClient.previewInvite({ token }).then(
      (res) => {
        if (!cancelled) setPreview({ kind: 'ready', name: res.name });
      },
      (err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setPreview({ kind: 'not-found' });
        } else if (err instanceof ApiError && err.status === 410) setPreview({ kind: 'gone' });
        else setPreview({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  function onJoin() {
    if (session.state.kind === 'signed-out' || session.state.kind === 'unavailable') {
      session.signIn();
      return;
    }
    if (session.state.kind !== 'signed-in' || !token || preview.kind !== 'ready') return;
    setPhase('joining');
    session.acceptInvite(token).then(
      (summary) => setPhase({ kind: 'joined', name: summary.name }),
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 410) {
          setPhase('idle');
          setPreview({ kind: 'gone' });
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setPhase('idle');
          setPreview({ kind: 'not-found' });
          return;
        }
        setPhase('error');
      },
    );
  }

  function onRetry() {
    if (phase === 'error' && preview.kind === 'ready') {
      setPhase('idle');
      onJoin();
      return;
    }
    setPhase('idle');
    setAttempt((n) => n + 1);
  }

  return (
    <JoinView
      state={viewState(preview, phase, session.state.kind)}
      onJoin={onJoin}
      onRetry={onRetry}
      onSignIn={() => session.signIn()}
    />
  );
}

function viewState(preview: Preview, phase: Phase, sessionKind: string): JoinViewState {
  if (typeof phase === 'object') return { kind: 'joined', name: phase.name };
  if (preview.kind === 'not-found') return { kind: 'not-found' };
  if (preview.kind === 'gone') return { kind: 'gone' };
  if (preview.kind === 'loading') return { kind: 'loading' };
  if (preview.kind === 'error' || phase === 'error') return { kind: 'error' };
  if (phase === 'joining') return { kind: 'joining', name: preview.name };
  if (sessionKind === 'loading') return { kind: 'signing-in', name: preview.name };
  if (sessionKind === 'error') return { kind: 'sign-in-failed', name: preview.name };
  if (sessionKind === 'signed-out' || sessionKind === 'unavailable') {
    return { kind: 'signed-out', name: preview.name };
  }
  return { kind: 'preview', name: preview.name };
}
