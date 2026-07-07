import { useI18n } from '../lib/i18n';

export function Home() {
  const { t } = useI18n();

  return (
    <div className="home">
      <header className="home-hero">
        <img src="/pristonzone-logo.png" alt="PristonZONE" className="home-logo" />
        <h1 className="home-welcome-title">{t('home.welcome.title')}</h1>
        <p className="home-welcome-body">{t('home.welcome.body')}</p>
      </header>

      <footer className="home-credits">
        {t('home.credits', { a: 'HaDDeR', b: 'CommitaoDourado' })}
      </footer>
    </div>
  );
}
