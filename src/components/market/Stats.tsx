import { useMemo } from 'react';
import { SELLER_BY_ID } from '../../lib/market/data';
import { fmtPrice, marketOverview } from '../../lib/market/helpers';
import type { Listing } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { Avatar, OnlineDot, PriceTag, RepBadge, Stars } from './parts';

export function Stats({ onOpen, onSeller }: { onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const o = useMemo(() => marketOverview(), []);
  const maxVol = Math.max(...o.volumeByDay.map((d) => d.value), 1);

  return (
    <div className="mk-stats">
      <div className="mk-dash-stats">
        <Kpi v={String(o.totalListings)} l={t('mk.stats.totallistings')} />
        <Kpi v={o.totalSold.toLocaleString('pt-BR')} l={t('mk.stats.totalsold')} />
        <Kpi v={fmtPrice(o.totalVolume)} l={t('mk.stats.totalvolume')} gold />
        <Kpi v={fmtPrice(o.volumeToday)} l={t('mk.stats.today')} />
        <Kpi v={fmtPrice(o.volumeMonth)} l={t('mk.stats.month')} />
        <Kpi v={`${o.avgSellHours}h`} l={t('mk.stats.avgsell')} />
      </div>

      <section className="mk-block">
        <h2 className="mk-h2">📊 {t('mk.stats.volume14')}</h2>
        <div className="mk-volbars">
          {o.volumeByDay.map((d) => (
            <div key={d.t} className="mk-volbar" title={`${new Date(d.t).toLocaleDateString('pt-BR')} · ${fmtPrice(d.value)}`}>
              <span className="mk-volbar-fill" style={{ height: `${(d.value / maxVol) * 100}%` }} />
            </div>
          ))}
        </div>
      </section>

      <div className="mk-stats-cols">
        <RankList title={`🔥 ${t('mk.stats.trending')}`} rows={o.trending.map((x) => ({ l: x.listing, extra: `${x.pct >= 0 ? '+' : ''}${x.pct.toFixed(1)}%`, good: x.pct >= 0 }))} onOpen={onOpen} />
        <RankList title={`👁 ${t('mk.stats.mostviewed')}`} rows={o.topViewed.map((l) => ({ l, extra: `${l.views.toLocaleString('pt-BR')} 👁` }))} onOpen={onOpen} />
        <RankList title={`⭐ ${t('mk.stats.mostfav')}`} rows={o.topFavorited.map((l) => ({ l, extra: t(`mk.rarity.${l.rarity}`) }))} onOpen={onOpen} />
      </div>

      <section className="mk-block">
        <h2 className="mk-h2">🏆 {t('mk.stats.topsellers')}</h2>
        <div className="mk-ranklist">
          {o.topSellers.map((s, i) => (
            <button key={s.id} className="mk-rankrow" onClick={() => onSeller(s.id)}>
              <span className="mk-rank-n">{i + 1}</span>
              <Avatar value={s.avatar} />
              <span className="mk-rankrow-main">
                <b>{s.nick}</b> <OnlineDot online={s.online} />
                <span className="mk-muted"><Stars n={s.ratingAvg} size={12} /> {s.ratingAvg.toFixed(1)}</span>
              </span>
              <RepBadge seller={s} />
              <span className="mk-rankrow-val">{s.itemsSold} <small>{t('mk.itemssold')}</small></span>
            </button>
          ))}
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

function RankList({ title, rows, onOpen }: { title: string; rows: { l: Listing; extra: string; good?: boolean }[]; onOpen: (id: string) => void }) {
  return (
    <section className="mk-block">
      <h2 className="mk-h2">{title}</h2>
      <div className="mk-ranklist">
        {rows.map((r, i) => (
          <button key={r.l.id} className="mk-rankrow" onClick={() => onOpen(r.l.id)}>
            <span className="mk-rank-n">{i + 1}</span>
            <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{r.l.image ? <img src={r.l.image} alt="" className="mk-icon-img" /> : r.l.icon}</span>
            <span className="mk-rankrow-main">
              <b>{r.l.name}</b>
              <span className="mk-muted">{SELLER_BY_ID[r.l.sellerId]?.nick}</span>
            </span>
            <span className="mk-rankrow-side">
              <PriceTag value={r.l.price} currency={r.l.currency} />
              <span className={`mk-rankrow-extra ${r.good === undefined ? '' : r.good ? 'mk-good' : 'mk-bad'}`}>{r.extra}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
