import { Link } from 'react-router';
import { t } from '../../i18n/t';
import { PRIVACY_PATH } from '../privacy/policy';

export type ConsentGateStatus = 'idle' | 'accepting' | 'error' | 'outdated';

export interface ConsentGateViewProps {
  status: ConsentGateStatus;
  onAccept(): void;
}

export function ConsentGateView({ status, onAccept }: ConsentGateViewProps) {
  const accepting = status === 'accepting';
  return (
    <main className="page consent">
      <h1 className="consent__title">{t('consent.title')}</h1>
      <p className="consent__summary">{t('consent.summary')}</p>
      <p className="consent__summary">
        <Link to={PRIVACY_PATH} className="site-nav__link">
          {t('consent.privacyLink')}
        </Link>
      </p>
      <div className="consent__actions">
        <button type="button" className="auth__button" disabled={accepting} onClick={onAccept}>
          {accepting ? t('consent.agreeing') : t('consent.agree')}
        </button>
        {accepting && (
          <p role="status" aria-busy="true" className="consent__status">
            {t('consent.agreeing')}
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="consent__error">
            {t('consent.error.generic')}
          </p>
        )}
        {status === 'outdated' && (
          <p role="alert" className="consent__error">
            {t('consent.error.outdated')}
          </p>
        )}
      </div>
    </main>
  );
}
