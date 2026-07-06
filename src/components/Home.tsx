import type { Section } from '../App';
import { useI18n } from '../lib/i18n';

const CARDS: { id: Exclude<Section, 'home'>; icon: string; navKey: string; descKey: string }[] = [
  { id: 'timeboss', icon: '🕐', navKey: 'nav.timeboss', descKey: 'home.card.timeboss' },
  { id: 'timerfury', icon: '🔥', navKey: 'nav.timerfury', descKey: 'home.card.timerfury' },
  { id: 'sod', icon: '🎯', navKey: 'nav.sod', descKey: 'home.card.sod' },
  { id: 'market', icon: '🏰', navKey: 'nav.market', descKey: 'home.card.market' },
  { id: 'soultree', icon: '🌳', navKey: 'nav.soultree', descKey: 'home.card.soultree' },
];

export function Home({ go }: { go: (s: Section) => void }) {
  const { t } = useI18n();

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-badge">⚔️</div>
        <h1 className="home-hero-title">{t('home.hero.title')}</h1>
        <p className="home-hero-tagline">{t('home.hero.tagline')}</p>
        <p className="home-intro">{t('home.intro')}</p>
      </header>

      <section className="home-welcome">
        <h2 className="home-welcome-title">{t('home.welcome.title')}</h2>
        <p className="home-welcome-body">{t('home.welcome.body')}</p>
      </section>

      <section className="home-section">
        <h2 className="home-h2">{t('home.cards.title')}</h2>
        <div className="home-grid">
          {CARDS.map((c) => (
            <button key={c.id} className="home-card" onClick={() => go(c.id)}>
              <span className="home-card-icon">{c.icon}</span>
              <strong className="home-card-title">{t(c.navKey)}</strong>
              <span className="home-card-desc">{t(c.descKey)}</span>
              <span className="home-card-open">{t('home.open')} →</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="home-credits">
        {t('home.credits', { a: 'HaDDeR', b: 'CommitaoDourado' })}
      </footer>
    </div>
  );
}
