import { useState } from 'react';
import { ConsentOutdatedError } from '../auth/accept-consent';
import { useSession } from '../auth/session-context';
import { ConsentGateView, type ConsentGateStatus } from './ConsentGateView';

/**
 * Shown by `AppLayout` in place of the page while consent is required. On success the
 * session's new `me` removes the gate, so there is no success state here.
 */
export function ConsentGate() {
  const { acceptConsent } = useSession();
  const [status, setStatus] = useState<ConsentGateStatus>('idle');

  const handleAccept = () => {
    if (status === 'accepting') return;
    setStatus('accepting');
    acceptConsent().catch((err: unknown) => {
      setStatus(err instanceof ConsentOutdatedError ? 'outdated' : 'error');
    });
  };

  return <ConsentGateView status={status} onAccept={handleAccept} />;
}
