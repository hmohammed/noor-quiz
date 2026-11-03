import { useEffect, useRef } from 'react';
import { t } from '../../i18n/t';

export type DeleteAccountStatus = 'idle' | 'confirming' | 'deleting' | 'error';

const TITLE_ID = 'profile-delete-title';

export function DeleteAccountView({
  status,
  onStart,
  onConfirm,
  onCancel,
}: {
  status: DeleteAccountStatus;
  onStart(): void;
  onConfirm(): void;
  onCancel(): void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busy = status === 'deleting';

  useEffect(() => {
    if (status === 'confirming') cancelRef.current?.focus();
  }, [status]);

  return (
    <section
      className="profile-delete"
      aria-labelledby={TITLE_ID}
      aria-busy={busy ? true : undefined}
    >
      <h2 id={TITLE_ID} className="profile-delete__title">
        {t('profile.delete.title')}
      </h2>
      {status === 'idle' ? (
        <>
          <p>{t('profile.delete.intro')}</p>
          <button type="button" className="profile-delete__start" onClick={onStart}>
            {t('profile.delete.start')}
          </button>
        </>
      ) : (
        <>
          <p>{t('profile.delete.confirmPrompt')}</p>
          {status === 'error' && (
            <p role="alert" className="profile__error">
              {t('profile.delete.error')}
            </p>
          )}
          <div className="profile-delete__actions">
            <button
              type="button"
              className="profile-delete__confirm"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? t('profile.delete.deleting') : t('profile.delete.confirm')}
            </button>
            <button
              type="button"
              className="profile-delete__cancel"
              ref={cancelRef}
              disabled={busy}
              onClick={onCancel}
            >
              {t('profile.delete.cancel')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
