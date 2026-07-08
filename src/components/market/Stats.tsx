import { CATEGORIES } from '../../lib/market/data';
import { fmtPrice, repTier } from '../../lib/market/helpers';
import type { Seller } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { getSeller } from './store';
import { useMarketOverview } from './useMarketData';
import { Avatar, OnlineDot, PriceTag, Stars } from './parts';

const CAT_ICON: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));

export function Stats({ onOpen, onSeller }: { onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const { overview: o, loading } = useMarketOverview();

  if (loading || !o) {
    return <div className="mk-stats"><p className="mk-empty">⏳ {t('mk.loading')}</p></div>;
  }
  const maxVol = Math.max(...o.volumeByDay.map((d) => d.value), 1);
  const noSales = o.totalSold === 0;

  return (
    <div className="mk-stats">
      <div className="mk-dash-stats">
        <Kpi v={String(o.totalListings)} l={t('mk.stats.totallistings')} />
        <Kpi v={o.totalSold.toLocaleString('pt-BR')} l={t('mk.stats.totalsold')} />
        <Kpi v={fmtPrice(o.totalVolume)} l={t('mk.stats.totalvolume')} gold />
        <Kpi v={fmtPrice(o.volumeToday)} l={t('mk.stats.today')} />
        <Kpi v={fmtPrice(o.volumeMonth)} l={t('mk.stats.month')} />
      </div>

      <section className="mk-block">
        <h2 className="mk-h2">📊 {t('mk.stats.volume14')}</h2>
        {noSales ? (
          <p className="mk-muted">{t('mk.stats.nosales')}</p>
        ) : (
          <div className="mk-volbars">
            {o.volumeByDay.map((d) => (
              <div key={d.t} className="mk-volbar" title={`${new Date(d.t).toLocaleDateString('pt-BR')} · ${fmtPrice(d.value)}`}>
                <span className="mk-volbar-fill" style={{ height: `${(d.value / maxVol) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mk-stats-cols">
        {/* most sold */}
        <section className="mk-block">
          <h2 className="mk-h2">🔥 {t('mk.stats.mostsold')}</h2>
          <div className="mk-ranklist">
            {o.topSold.map((s, i) => (
              <div key={s.name} className="mk-rankrow static">
                <span className="mk-rank-n">{i + 1}</span>
                <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{CAT_ICON[s.category] || '📦'}</span>
                <span className="mk-rankrow-main">
                  <b>{s.name}</b>
                  <span className="mk-muted">{fmtPrice(s.volume)} {t('mk.stats.moved')}</span>
                </span>
                <span className="mk-rankrow-val">{s.count}× <small>{t('mk.stats.sold1')}</small></span>
              </div>
            ))}
            {o.topSold.length === 0 && <p className="mk-muted">{t('mk.stats.nosales')}</p>}
          </div>
        </section>

        {/* most viewed */}
        <section className="mk-block">
          <h2 className="mk-h2">👁 {t('mk.stats.mostviewed')}</h2>
          <div className="mk-ranklist">
            {o.topViewed.map((l, i) => (
              <button key={l.id} className="mk-rankrow" onClick={() => onOpen(l.id)}>
                <span className="mk-rank-n">{i + 1}</span>
                <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{l.image ? <img src={l.image} alt="" className="mk-icon-img" /> : l.icon}</span>
                <span className="mk-rankrow-main">
                  <b>{l.name}</b>
                  <span className="mk-muted">{getSeller(l.sellerId)?.nick ?? ''}</span>
                </span>
                <span className="mk-rankrow-side">
                  <PriceTag value={l.price} currency={l.currency} />
                  <span className="mk-rankrow-extra">{l.views.toLocaleString('pt-BR')} 👁</span>
                </span>
              </button>
            ))}
            {o.topViewed.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
          </div>
        </section>
      </div>

      <section className="mk-block">
        <h2 className="mk-h2">🏆 {t('mk.stats.topsellers')}</h2>
        <div className="mk-ranklist">
          {o.topSellers.map((s, i) => {
            const tier = repTier({ itemsSold: s.itemsSold } as Seller);
            return (
              <button key={s.id} className="mk-rankrow" onClick={() => onSeller(s.id)}>
                <span className="mk-rank-n">{i + 1}</span>
                <Avatar value={s.avatar} />
                <span className="mk-rankrow-main">
                  <b>{s.nick}</b> <OnlineDot online={false} />
                  <span className="mk-muted"><Stars n={s.ratingAvg} size={12} /> {s.ratingAvg.toFixed(1)} ({s.ratingCount})</span>
                </span>
                <span className="mk-rep" style={{ color: tier.color, borderColor: tier.color }}>{tier.icon} {tier.label}</span>
                <span className="mk-rankrow-val">{s.itemsSold} <small>{t('mk.itemssold')}</small></span>
              </button>
            );
          })}
          {o.topSellers.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ v, l, gold }: { v: string; l: string; gold?: boolean }) {
  return (
    <div className={`mk-kpi ${gold ? 'gold' : ''}`}>
      <b>{v}</b>
      <span>{l}</span>
    </div>
  );
}
