import { useEffect, useMemo, useState } from 'react';
import {
  ALL_BOSSES,
  BOSSES,
  SCHEDULE_ROWS,
  brasiliaSecondsNow,
  clock,
  countdown,
  hhmm,
  nextForBoss,
  upcomingSlots,
} from '../lib/bosses';
import { useI18n } from '../lib/i18n';

const SPAWN_NOW = 90; // within 90s counts as "spawning now"

export function TimeBoss() {
  const { t } = useI18n();
  const [nowSec, setNowSec] = useState(brasiliaSecondsNow());

  useEffect(() => {
    const id = setInterval(() => setNowSec(brasiliaSecondsNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = useMemo(() => upcomingSlots(nowSec, 7), [nowSec]);
  const hero = upcoming[0];
  const rest = upcoming.slice(1);

  const inLabel = (sec: number) =>
    sec <= SPAWN_NOW ? t('tb.spawning') : t('tb.in', { t: countdown(sec) });

  // Which schedule row holds the very next spawn (to highlight it in the table).
  const nextRow = hero ? (Math.floor(hero.slot.minute / 60) % 12) : -1;

  return (
    <div className="tb">
      {/* ---- header ---- */}
      <header className="tb-head">
        <div>
          <h1 className="tb-h1">{t('tb.title')}</h1>
          <p className="tb-sub">{t('tb.subtitle')}</p>
        </div>
        <div className="tb-clock">
          <span className="tb-clock-label">{t('tb.nowlabel')}</span>
          <span className="tb-clock-time">{clock(nowSec)}</span>
          <span className="tb-clock-tz">{t('tb.timezone')}</span>
        </div>
      </header>

      {/* ---- hero: the next spawn ---- */}
      {hero && (
        <section className={`tb-hero ${hero.inSec <= SPAWN_NOW ? 'imminent' : ''}`}>
          <div className="tb-hero-time">
            <span className="tb-hero-label">{t('tb.nextone')}</span>
            <span className="tb-hero-hhmm">{hero.slot.label}</span>
            <span className="tb-hero-count">{inLabel(hero.inSec)}</span>
          </div>
          <div className="tb-hero-bosses">
            {hero.slot.bossIds.map((id) => {
              const b = BOSSES[id];
              return (
                <div className="tb-hero-boss" key={id}>
                  <img src={b.img} alt={b.name} loading="lazy" />
                  <div className="tb-hero-binfo">
                    <strong>{b.name}</strong>
                    <span>
                      {b.location}
                      {b.level ? ` · ${t('tb.lvl')}${b.level}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- upcoming list ---- */}
      <section className="tb-section">
        <h2 className="tb-h2">⏳ {t('tb.next')}</h2>
        <div className="tb-next-grid">
          {rest.map(({ slot, inSec }) => (
            <div className="tb-next-card" key={slot.minute}>
              <div className="tb-next-head">
                <span className="tb-next-hhmm">{slot.label}</span>
                <span className="tb-next-count">{inLabel(inSec)}</span>
              </div>
              <div className="tb-next-thumbs">
                {slot.bossIds.map((id) => (
                  <img
                    key={id}
                    src={BOSSES[id].img}
                    alt={BOSSES[id].name}
                    title={`${BOSSES[id].name} — ${BOSSES[id].location}`}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- full daily schedule ---- */}
      <section className="tb-section">
        <h2 className="tb-h2">📅 {t('tb.schedule')}</h2>
        <p className="tb-note">{t('tb.schedulenote')}</p>
        <div className="tb-table-wrap">
          <table className="tb-table">
            <thead>
              <tr>
                <th className="tb-th-time">{t('tb.time')}</th>
                <th>{t('tb.bosses')}</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULE_ROWS.map((ids, r) => (
                <tr key={r} className={r === nextRow ? 'tb-row-next' : ''}>
                  <td className="tb-td-time">
                    {hhmm(r * 60 + 30)} <span className="tb-slash">/</span> {hhmm((r + 12) * 60 + 30)}
                  </td>
                  <td>
                    <div className="tb-cell-bosses">
                      {ids.map((id) => {
                        const b = BOSSES[id];
                        return (
                          <span className="tb-chip" key={id} title={b.location}>
                            <img src={b.img} alt="" loading="lazy" />
                            <span className="tb-chip-text">
                              <span className="tb-chip-name">{b.name}</span>
                              <span className="tb-chip-loc">
                                {b.location}
                                {b.level ? ` · ${t('tb.lvl')}${b.level}` : ''}
                              </span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- all bosses ---- */}
      <section className="tb-section">
        <h2 className="tb-h2">👹 {t('tb.allbosses')}</h2>
        <div className="tb-boss-grid">
          {ALL_BOSSES.map((b) => {
            const n = nextForBoss(b.id, nowSec);
            return (
              <div className="tb-boss-card" key={b.id}>
                <img src={b.img} alt={b.name} loading="lazy" />
                <div className="tb-boss-body">
                  <strong>{b.name}</strong>
                  <span className="tb-boss-loc">
                    {b.location}
                    {b.level ? ` · ${t('tb.lvl')}${b.level}` : ''}
                  </span>
                  {n && (
                    <span className="tb-boss-next">
                      {t('tb.nextspawn', {
                        time: n.label,
                        in: n.inSec <= SPAWN_NOW ? t('tb.spawning') : countdown(n.inSec),
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
