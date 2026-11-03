import { t } from '../../i18n/t';
import { PRIVACY_SECTIONS } from './policy';

/** Public page: no session or router hooks, so it renders the same signed in or out. */
export function PrivacyPage() {
  return (
    <main className="page privacy">
      <h1 className="privacy__title">{t('privacy.title')}</h1>
      <p className="privacy__placeholder">{t('privacy.placeholder')}</p>
      {PRIVACY_SECTIONS.map(({ titleKey, bodyKey }) => (
        <section key={titleKey} className="privacy__section">
          <h2>{t(titleKey)}</h2>
          <p>{t(bodyKey)}</p>
        </section>
      ))}
    </main>
  );
}
