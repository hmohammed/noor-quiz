import { Link, Outlet } from 'react-router';
import { t } from '../../i18n/t';
import { AuthButton } from '../auth/AuthButton';
import { SessionProvider, useSession } from '../auth/session-context';

function SiteNav() {
  const { state } = useSession();
  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav__link">
        {t('nav.home')}
      </Link>
      {state.kind === 'signed-in' && (
        <Link to="/profile" className="site-nav__link">
          {t('nav.profile')}
        </Link>
      )}
    </nav>
  );
}

/** Shared shell: one session for every page, the header, then the page. */
export function AppLayout() {
  return (
    <SessionProvider>
      <header className="site-header">
        <SiteNav />
        <AuthButton />
      </header>
      <Outlet />
    </SessionProvider>
  );
}
