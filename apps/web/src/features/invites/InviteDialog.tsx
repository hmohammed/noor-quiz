import { useEffect, useRef } from 'react';
import { inviteQrDataUrl } from './invite-qr';
import { t } from '../../i18n/t';

export type InviteDialogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      url: string;
      expiresAt: string;
      timeZone: string;
      copy: 'idle' | 'copied' | 'failed';
    };

export interface InviteDialogProps {
  communityName: string;
  state: InviteDialogState;
  onClose(): void;
  onRetry(): void;
  onCopy(): void;
}

const TITLE_ID = 'invite-dialog-title';

function formatExpiry(expiresAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(expiresAt));
}

/**
 * Inline invite panel in the community row, same idea as profile delete: not a modal.
 * When the link is ready, focus moves to it. Escape closes. The page around it is inert.
 */
export function InviteDialog({
  communityName,
  state,
  onClose,
  onRetry,
  onCopy,
}: InviteDialogProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const readyUrl = state.kind === 'ready' ? state.url : null;

  useEffect(() => {
    if (!readyUrl) return;
    linkRef.current?.focus();
    panelRef.current?.scrollIntoView({ block: 'nearest' });
  }, [readyUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section className="invite-dialog" aria-labelledby={TITLE_ID} ref={panelRef}>
      <h2 id={TITLE_ID} className="invite-dialog__title">
        {t('community.invite')}
      </h2>
      <p className="invite-dialog__name" dir="auto">
        {communityName}
      </p>
      {state.kind === 'loading' && (
        <p role="status" aria-busy="true" className="community__status">
          {t('community.invite.loading')}
        </p>
      )}
      {state.kind === 'error' && (
        <>
          <p role="alert" className="community__error">
            {t('community.invite.error')}
          </p>
          <button type="button" className="auth__button invite-dialog__button" onClick={onRetry}>
            {t('community.invite.retry')}
          </button>
        </>
      )}
      {state.kind === 'ready' && (
        <>
          <a
            ref={linkRef}
            className="invite-dialog__link"
            href={state.url}
            aria-label={t('community.invite.link')}
          >
            {state.url}
          </a>
          <p className="invite-dialog__expires">
            <span>{t('community.invite.expires')}</span>{' '}
            <time dateTime={state.expiresAt}>{formatExpiry(state.expiresAt, state.timeZone)}</time>
          </p>
          <img
            className="invite-dialog__qr"
            alt={t('community.invite.qr')}
            src={inviteQrDataUrl(state.url)}
          />
          <div className="invite-dialog__actions">
            <button type="button" className="auth__button" onClick={onCopy}>
              {state.copy === 'copied' ? t('community.invite.copied') : t('community.invite.copy')}
            </button>
            {state.copy === 'failed' && (
              <p role="alert" className="community__error">
                {t('community.invite.copyFailed')}
              </p>
            )}
          </div>
        </>
      )}
      <button type="button" className="auth__button invite-dialog__button" onClick={onClose}>
        {t('community.invite.close')}
      </button>
    </section>
  );
}
