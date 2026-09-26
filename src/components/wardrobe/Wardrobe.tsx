// Entry point for the "Armário de Personagem" tool: list of the player's own
// characters, or the builder for creating/editing one.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../market/store';
import { fetchMyCharacters } from '../../lib/wardrobe/characters';
import type { WardrobeCharacter } from '../../lib/wardrobe/types';
import { LoginPrompt } from '../market/LoginPrompt';
import { WardrobeBuilder } from './WardrobeBuilder';

type View = { name: 'list' } | { name: 'create' } | { name: 'edit'; id: string };

export function Wardrobe({ onLogin }: { onLogin: () => void }) {
  const { t } = useI18n();
  const { userId, isLoggedIn } = useAuth();
  const [view, setView] = useState<View>({ name: 'list' });
  const [characters, setCharacters] = useState<WardrobeCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchMyCharacters(userId).then((c) => { if (!cancelled) setCharacters(c); }).catch(() => { if (!cancelled) setCharacters([]); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  if (!isLoggedIn) return <LoginPrompt onLogin={onLogin} />;

  if (view.name !== 'list') {
    return (
      <WardrobeBuilder
        editId={view.name === 'edit' ? view.id : undefined}
        onDone={() => { setView({ name: 'list' }); setTick((x) => x + 1); }}
      />
    );
  }

  const copyLink = (slug: string) => { navigator.clipboard?.writeText(`${location.origin}/char/${slug}`); };

  return (
    <div className="wd-list">
      <div className="wd-list-head">
        <div>
          <h1 className="mk-h1">🧥 {t('wd.title')}</h1>
          <p className="mk-muted">{t('wd.subtitle')}</p>
        </div>
        <button className="mk-btn primary" onClick={() => setView({ name: 'create' })}>+ {t('wd.create.title')}</button>
      </div>

      {loading ? (
        <p className="mk-empty">⏳ {t('mk.loading')}</p>
      ) : characters.length === 0 ? (
        <p className="mk-empty">{t('wd.list.empty')}</p>
      ) : (
        <div className="wd-list-grid">
          {characters.map((c) => (
            <div key={c.id} className="wd-list-card">
              <b>{c.nick}</b>
              <span className="mk-muted">{t(`wd.class.${c.class}`)} · {t('wd.info.level')} {c.level}</span>
              <span className={`mk-status ${c.listedOnMarketplace ? 'available' : 'reserved'}`}>{c.listedOnMarketplace ? t('wd.sale.listed.yes') : t('wd.sale.listed.no')}</span>
              <div className="wd-list-card-acts">
                <button className="mk-btn sm" onClick={() => setView({ name: 'edit', id: c.id })}>{t('mk.edit')}</button>
                <button className="mk-btn sm" onClick={() => window.open(`/char/${c.slug}`, '_blank', 'noopener,noreferrer')}>👁 {t('wd.list.view')}</button>
                <button className="mk-btn sm" onClick={() => copyLink(c.slug)}>🔗</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
