import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { t } from '../../i18n/t';

type ApiStatus = 'checking' | 'ok' | 'unreachable';

const statusKey: Record<ApiStatus, string> = {
  checking: 'home.api.checking',
  ok: 'home.api.ok',
  unreachable: 'home.api.unreachable',
};

export function HomePage() {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    apiClient.getHealth({ signal: controller.signal }).then(
      () => {
        if (!controller.signal.aborted) setStatus('ok');
      },
      () => {
        if (!controller.signal.aborted) setStatus('unreachable');
      },
    );
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <p role="status" data-testid="api-status" className={`api-status api-status--${status}`}>
        {t(statusKey[status])}
      </p>
    </main>
  );
}
