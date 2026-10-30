// pristonzone.com/tutorial: how the site works. The player picks the area to learn (/tutorial/<area> opens one directly).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { youtubeEmbedUrl } from '../../lib/market/guides';
import type { Route } from '../../lib/routes';
import { AREAS, findArea } from './content';

const TXT = {
  title: { pt: 'Como usar o PristonZONE', en: 'How to use PristonZONE' },
  subtitle: { pt: 'Escolha a área que você quer aprender.', en: 'Choose the area you want to learn.' },
  all: { pt: '← Todas as áreas', en: '← All areas' },
  about: { pt: 'Para que serve', en: 'What it is for' },
  steps: { pt: 'Passo a passo', en: 'Step by step' },
  tips: { pt: 'Dicas', en: 'Tips' },
  open: { pt: 'Abrir', en: 'Open' },
  video: { pt: 'Vídeo', en: 'Video' },
  next: { pt: 'Próxima área', en: 'Next area' },
} as const;

const PREFIX = '/tutorial/';
const areaFromPath = () => {
  const p = window.location.pathname.toLowerCase();
  return p.startsWith(PREFIX) ? findArea(p.slice(PREFIX.length).replace(/\/+$/, ''))?.id ?? null : null;
};

export function Tutorial({ onOpen }: { onOpen: (patch: Partial<Route>) => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [sel, setSel] = useState<string | null>(areaFromPath);

  // Back/Forward between the list and an area.
  useEffect(() => {
    const onPop = () => setSel(areaFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const pick = (id: string | null) => {
    setSel(id);
    window.history.pushState(null, '', id ? `${PREFIX}${id}` : '/tutorial');
    window.scrollTo({ top: 0 });
  };

  const area = sel ? findArea(sel) : undefined;

  if (!area) {
    return (
      <div className="mk tut">
        <h1 className="mk-h1">❓ {T('title')}</h1>
        <p className="mk-muted">{T('subtitle')}</p>
        <div className="home-grid tut-grid">
          {AREAS.map((a) => (
            <button key={a.id} type="button" className="home-card" onClick={() => pick(a.id)}>
              <span className="home-card-icon">{a.icon}</span>
              <b className="home-card-title">{a.title[lang]}</b>
              <span className="home-card-desc">{a.summary[lang]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const idx = AREAS.findIndex((a) => a.id === area.id);
  const next = AREAS[(idx + 1) % AREAS.length];

  return (
    <div className="mk tut">
      <button type="button" className="mk-btn sm tut-back" onClick={() => pick(null)}>{T('all')}</button>
      <h1 className="mk-h1">{area.icon} {area.title[lang]}</h1>

      <section className="sr-card tut-card">
        <h2 className="mk-h2">{T('about')}</h2>
        <p>{area.about[lang]}</p>
        {area.note && <p className="mk-note">{area.note[lang]}</p>}
        <button type="button" className="mk-btn primary" onClick={() => onOpen(area.open)}>{T('open')}: {area.title[lang]}</button>
      </section>

      {area.video && (
        <section className="sr-card tut-card">
          <h2 className="mk-h2">🎬 {T('video')}</h2>
          <div className="guide-lightbox-frame">
            <iframe src={youtubeEmbedUrl(area.video)} title={area.title[lang]} allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        </section>
      )}

      <section className="sr-card tut-card">
        <h2 className="mk-h2">{T('steps')}</h2>
        <ol className="tut-steps">{area.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}</ol>
      </section>

      {area.tips.length > 0 && (
        <section className="sr-card tut-card">
          <h2 className="mk-h2">💡 {T('tips')}</h2>
          <ul className="tut-steps">{area.tips.map((s, i) => <li key={i}>{s[lang]}</li>)}</ul>
        </section>
      )}

      <button type="button" className="mk-btn tut-next" onClick={() => pick(next.id)}>{T('next')}: {next.icon} {next.title[lang]} →</button>
    </div>
  );
}
