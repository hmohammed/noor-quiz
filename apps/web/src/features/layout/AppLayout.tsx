import { Link, Outlet, useLocation } from 'react-router';
import { t } from '../../i18n/t';
import { AuthButton } from '../auth/AuthButton';
import { SessionProvider, useSession } from '../auth/session-context';
import { ConsentGate } from '../consent/ConsentGate';
import { shouldShowConsentGate } from '../consent/consent-gate-rule';
import { PRIVACY_PATH } from '../privacy/policy';

function SiteNav() {
  const { state } = useSession();
  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav__link">
        {t('nav.home')}
      </Link>
      {state.kind === 'signed-in' && !state.me.consent.required && (
        <Link to="/profile" className="site-nav__link">
          {t('nav.profile')}
        </Link>
      )}
    </nav>
  );
}

/** The page, or the consent screen in its place while the user has not agreed yet. */
function PageOutlet() {
  const { state } = useSession();
  const { pathname } = useLocation();
  if (state.kind === 'signed-in' && shouldShowConsentGate(state, pathname)) {
    return <ConsentGate key={state.me.userId} />;
  }
  return <Outlet />;
}

/** Shared shell: one session for every page, the header, then the page. */
export function AppLayout() {
  return (
    <SessionProvider>
      <header className="site-header">
        <SiteNav />
        <AuthButton />
      </header>
      <PageOutlet />
      <footer className="site-footer">
        <Link to={PRIVACY_PATH} className="site-nav__link">
          {t('nav.privacy')}
        </Link>
      </footer>
    </SessionProvider>
  );
}
