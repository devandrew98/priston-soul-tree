import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_BOSSES,
  BOSSES,
  SCHEDULE,
  type ScheduleEntry,
  buildEvents,
  detectTz,
  fmtCountdown,
  fmtSince,
  localClock,
  localMinutes,
  localTime,
  nextForBoss,
  nextOccurrence,
  resolveTz,
  tzOffsetLabel,
  TZ_OPTIONS,
} from '../lib/bosses';
import { useI18n, type Lang } from '../lib/i18n';

const IMMINENT = 120; // <= 2 min → pulse

// Deep-voiced spoken alert via the Web Speech API.
function speak(text: string, lang: Lang) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  u.pitch = 0.4; // grave / deep
  u.rate = 0.95;
  u.volume = 1;
  const voices = synth.getVoices();
  const pref = voices.find((v) => v.lang?.toLowerCase().startsWith(lang));
  if (pref) u.voice = pref;
  synth.speak(u);
}

function buildAlert(ids: string[], min: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const names = ids.map((id) => BOSSES[id].name);
  if (names.length === 1) return t('tb.alert.one', { name: names[0], min });
  const and = t('tb.alert.and');
  const list =
    names.length === 2
      ? `${names[0]} ${and} ${names[1]}`
      : `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
  return t('tb.alert.many', { list, min });
}

const isHardPrimal = (entry: ScheduleEntry, id: string) => id === 'primal-golem' && entry.hardPrimal;

export function TimeBoss() {
  const { t, lang } = useI18n();
  const [now, setNow] = useState(() => new Date());

  const [tzChoice, setTzChoice] = useState(() => localStorage.getItem('tb-tz') || 'auto');
  const [favOnly, setFavOnly] = useState(() => localStorage.getItem('tb-favonly') === '1');
  const [audioOn, setAudioOn] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('tb-favorites') || '[]'));
    } catch {
      return new Set();
    }
  });

  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tz = resolveTz(tzChoice);
  const filter = favOnly && favorites.size ? favorites : undefined;
  const events = useMemo(() => buildEvents(now, filter), [now, favOnly, favorites]);
  const spawned = events.filter((e) => e.state === 'spawned');
  const upcoming = events.filter((e) => e.state === 'upcoming');
  const hero = upcoming[0];
  const rest = upcoming.slice(1, 7);

  // Voice alerts at 10 / 5 / 2 minutes before each upcoming spawn.
  useEffect(() => {
    if (!audioOn) return;
    for (const ev of events) {
      if (ev.state !== 'upcoming') continue;
      for (const T of [10, 5, 2]) {
        const th = T * 60;
        if (ev.sec <= th && ev.sec > th - 60) {
          const key = `${ev.when.getTime()}-${T}`;
          if (!announced.current.has(key)) {
            announced.current.add(key);
            speak(buildAlert(ev.ids, T, t), lang);
          }
        }
      }
    }
    if (announced.current.size > 240) {
      const cutoff = now.getTime() - 3600000;
      for (const k of announced.current) if (Number(k.split('-')[0]) < cutoff) announced.current.delete(k);
    }
  }, [events, audioOn, lang, now, t]);

  const changeTz = (v: string) => {
    setTzChoice(v);
    localStorage.setItem('tb-tz', v);
  };
  const changeFavOnly = (v: boolean) => {
    setFavOnly(v);
    localStorage.setItem('tb-favonly', v ? '1' : '0');
  };
  const toggleFav = (id: string) =>
    setFavorites((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      localStorage.setItem('tb-favorites', JSON.stringify([...nx]));
      return nx;
    });
  const toggleAudio = () => {
    const nx = !audioOn;
    setAudioOn(nx);
    if (nx) {
      try {
        window.speechSynthesis?.getVoices();
      } catch {
        /* ignore */
      }
      speak(t('tb.audio.enabled'), lang);
    } else {
      window.speechSynthesis?.cancel();
    }
  };

  // Schedule rows formatted + sorted in the viewer's timezone (stable per tz).
  const scheduleRows = useMemo(() => {
    const ref = new Date();
    return SCHEDULE.map((entry) => {
      const occ = nextOccurrence(entry.utcMin, ref);
      return { entry, localMin: localMinutes(occ, tz), localHm: localTime(occ, tz) };
    }).sort((a, b) => a.localMin - b.localMin);
  }, [tz]);

  const tzName = tzChoice === 'auto' ? detectTz() : TZ_OPTIONS.find((o) => o.id === tzChoice)?.[lang] || tzChoice;

  return (
    <div className="tb">
      {/* header */}
      <header className="tb-head">
        <div>
          <h1 className="tb-h1">{t('tb.title')}</h1>
          <p className="tb-sub">{t('tb.subtitle')}</p>
        </div>
        <div className="tb-clock">
          <span className="tb-clock-label">{t('tb.nowlabel')}</span>
          <span className="tb-clock-time">{localClock(now, tz)}</span>
          <span className="tb-clock-tz">
            {tzOffsetLabel(tz)} · {tzName}
          </span>
        </div>
      </header>

      {/* controls */}
      <div className="tb-controls">
        <div className="tb-seg">
          <button className={!favOnly ? 'on' : ''} onClick={() => changeFavOnly(false)}>
            {t('tb.fav.all')}
          </button>
          <button className={favOnly ? 'on' : ''} onClick={() => changeFavOnly(true)}>
            {t('tb.fav.only')}
          </button>
        </div>
        <label className="tb-ctl">
          <span>🌐 {t('tb.tz.label')}</span>
          <select className="input" value={tzChoice} onChange={(e) => changeTz(e.target.value)}>
            {TZ_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o[lang]}
              </option>
            ))}
          </select>
        </label>
        <button className={`btn sm tb-audio ${audioOn ? 'on' : ''}`} onClick={toggleAudio} title={t('tb.audio.hint')}>
          {t('tb.audio.label')} {audioOn ? '✓' : ''}
        </button>
      </div>
      {favOnly && favorites.size === 0 && <p className="tb-hint">{t('tb.fav.hint')}</p>}

      {/* just spawned (kept ~3 min) */}
      {spawned.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2 spawn">⚔️ {t('tb.justspawned')}</h2>
          <div className="tb-next-grid">
            {spawned.map((ev) => (
              <div className="tb-next-card spawned" key={ev.entry.hm}>
                <div className="tb-next-head">
                  <span className="tb-next-count spawn">{t('tb.spawning')}</span>
                </div>
                <div className="tb-next-sub">{t('tb.spawnedago', { t: fmtSince(ev.sec) })}</div>
                <div className="tb-next-thumbs">
                  {ev.ids.map((id) => (
                    <img key={id} src={BOSSES[id].img} alt={BOSSES[id].name} title={BOSSES[id].name} loading="lazy" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* hero: next spawn (countdown only) */}
      {hero && (
        <section className={`tb-hero ${hero.sec <= IMMINENT ? 'imminent' : ''}`}>
          <div className="tb-hero-time">
            <span className="tb-hero-label">{t('tb.nextone')}</span>
            <span className="tb-hero-hhmm">{fmtCountdown(hero.sec)}</span>
          </div>
          <div className="tb-hero-bosses">
            {hero.ids.map((id) => {
              const b = BOSSES[id];
              return (
                <div className="tb-hero-boss" key={id}>
                  <img src={b.img} alt={b.name} loading="lazy" />
                  <div className="tb-hero-binfo">
                    <strong>
                      {b.name}
                      {isHardPrimal(hero.entry, id) ? ' (H)' : ''}
                    </strong>
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

      {/* upcoming (countdown only) */}
      {rest.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2">⏳ {t('tb.next')}</h2>
          <div className="tb-next-grid">
            {rest.map((ev) => (
              <div className={`tb-next-card ${ev.sec <= IMMINENT ? 'imminent' : ''}`} key={ev.entry.hm}>
                <div className="tb-next-head">
                  <span className="tb-next-count">{t('tb.in', { t: fmtCountdown(ev.sec) })}</span>
                </div>
                <div className="tb-next-thumbs">
                  {ev.ids.map((id) => (
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
      )}

      {/* full schedule (local times) */}
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
              {scheduleRows.map(({ entry, localHm }) => (
                <tr key={entry.hm} className={hero && entry === hero.entry ? 'tb-row-next' : ''}>
                  <td className="tb-td-time">{localHm}</td>
                  <td>
                    <div className="tb-cell-bosses">
                      {entry.ids.map((id) => {
                        const b = BOSSES[id];
                        return (
                          <span className="tb-chip" key={id} title={b.location}>
                            <img src={b.img} alt="" loading="lazy" />
                            <span className="tb-chip-text">
                              <span className="tb-chip-name">
                                {b.name}
                                {isHardPrimal(entry, id) ? ' (H)' : ''}
                              </span>
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

      {/* all bosses + favorites */}
      <section className="tb-section">
        <h2 className="tb-h2">👹 {t('tb.allbosses')}</h2>
        <div className="tb-boss-grid">
          {ALL_BOSSES.map((b) => {
            const n = nextForBoss(b.id, now);
            const fav = favorites.has(b.id);
            return (
              <div className={`tb-boss-card ${fav ? 'fav' : ''}`} key={b.id}>
                <button
                  className={`tb-star ${fav ? 'on' : ''}`}
                  onClick={() => toggleFav(b.id)}
                  title={fav ? t('tb.fav.remove') : t('tb.fav.add')}
                  aria-label={fav ? t('tb.fav.remove') : t('tb.fav.add')}
                >
                  {fav ? '⭐' : '☆'}
                </button>
                <img src={b.img} alt={b.name} loading="lazy" />
                <div className="tb-boss-body">
                  <strong>{b.name}</strong>
                  <span className="tb-boss-loc">
                    {b.location}
                    {b.level ? ` · ${t('tb.lvl')}${b.level}` : ''}
                  </span>
                  {n && (
                    <span className="tb-boss-next">
                      {t('tb.boss.next', { time: localTime(n.when, tz), in: fmtCountdown(n.sec) })}
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
