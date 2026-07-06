import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ALL_BOSSES,
  BOSSES,
  type ScheduleEntry,
  buildEvents,
  fmtCountdown,
  fmtSince,
  nextForBoss,
} from '../lib/bosses';
import { useI18n, type Lang } from '../lib/i18n';

const IMMINENT = 120; // <= 2 min → pulse
const ALERT_MINS = [10, 5, 2];

// Pick the deepest male-sounding voice available for the language.
// Ordered preference: known deep male voices first, then any non-female.
function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() || [];
  const same = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  const pool = same.length ? same : voices;
  const pref =
    lang === 'pt'
      ? [/daniel/i, /fel[ií]pe/i, /ant[oô]nio/i, /ricardo/i, /jorge/i, /male|masculin|homem/i]
      : [/david/i, /george/i, /mark/i, /uk english male/i, /daniel/i, /fred/i, /guy/i, /male/i];
  for (const re of pref) {
    const v = pool.find((x) => re.test(x.name));
    if (v) return v;
  }
  const female = /female|feminin|mulher|maria|luciana|helo[íi]sa|francisca|zira|hazel|susan|linda/i;
  return pool.find((v) => !female.test(v.name)) || pool[0];
}

// Deep, slow, Kratos-style spoken alert via the Web Speech API.
// pitch 0 is the lowest the engine allows; rate is slowed for a heavy cadence.
function speak(text: string, lang: Lang) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  u.pitch = 0; // deepest the engine can go
  u.rate = 0.72; // slow, deliberate, menacing
  u.volume = 1;
  const v = pickVoice(lang);
  if (v) u.voice = v;
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
const tone = (id: string) => ({ ['--tone']: BOSSES[id].tone } as CSSProperties);

// Transparent portrait with a per-boss coloured 3D glow.
function BossImg({ id, size }: { id: string; size: 'lg' | 'md' }) {
  const b = BOSSES[id];
  return (
    <span className={`tb-portrait ${size}`} style={tone(id)} title={`${b.name} — ${b.location}`}>
      <img src={b.img} alt={b.name} loading="lazy" />
    </span>
  );
}

export function TimeBoss() {
  const { t, lang } = useI18n();
  const [now, setNow] = useState(() => new Date());

  const [favOnly, setFavOnly] = useState(() => localStorage.getItem('tb-favonly') === '1');
  const [audioOn, setAudioOn] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('tb-favorites') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [alertMins, setAlertMins] = useState<Record<number, boolean>>(() => {
    try {
      return { 10: true, 5: true, 2: true, ...JSON.parse(localStorage.getItem('tb-alertmins') || '{}') };
    } catch {
      return { 10: true, 5: true, 2: true };
    }
  });

  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const filter = favOnly && favorites.size ? favorites : undefined;
  const events = useMemo(() => buildEvents(now, filter), [now, favOnly, favorites]);
  const spawned = events.filter((e) => e.state === 'spawned');
  const upcoming = events.filter((e) => e.state === 'upcoming');
  const hero = upcoming[0];
  const rest = upcoming.slice(1, 7);

  // Voice alerts at the selected minute marks before each upcoming spawn.
  useEffect(() => {
    if (!audioOn) return;
    for (const ev of events) {
      if (ev.state !== 'upcoming') continue;
      for (const T of ALERT_MINS) {
        if (!alertMins[T]) continue;
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
  }, [events, audioOn, alertMins, lang, now, t]);

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
  const toggleAlertMin = (n: number) =>
    setAlertMins((prev) => {
      const nx = { ...prev, [n]: !prev[n] };
      localStorage.setItem('tb-alertmins', JSON.stringify(nx));
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

  return (
    <div className="tb">
      {/* header */}
      <header className="tb-head">
        <h1 className="tb-h1">{t('tb.title')}</h1>
        <p className="tb-sub">{t('tb.subtitle')}</p>
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
        <div className="tb-audio-wrap">
          <button className={`btn sm tb-audio ${audioOn ? 'on' : ''}`} onClick={toggleAudio} title={t('tb.audio.hint')}>
            {t('tb.audio.label')} {audioOn ? '✓' : ''}
          </button>
          {audioOn && (
            <span className="tb-audio-times">
              <span className="tb-audio-times-lbl">{t('tb.audio.times')}</span>
              {ALERT_MINS.map((n) => (
                <label key={n} className={`tb-chk ${alertMins[n] ? 'on' : ''}`}>
                  <input type="checkbox" checked={!!alertMins[n]} onChange={() => toggleAlertMin(n)} /> {n} min
                </label>
              ))}
            </span>
          )}
        </div>
      </div>
      {favOnly && favorites.size === 0 && <p className="tb-hint">{t('tb.fav.hint')}</p>}

      {/* just spawned (kept ~3 min) */}
      {spawned.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2 spawn">⚔️ {t('tb.justspawned')}</h2>
          <div className="tb-next-grid">
            {spawned.map((ev) => (
              <div className="tb-next-card spawned" key={ev.entry.hm}>
                <div className="tb-next-count spawn">{t('tb.spawning')}</div>
                <div className="tb-next-sub">{t('tb.spawnedago', { t: fmtSince(ev.sec) })}</div>
                <div className="tb-next-thumbs">
                  {ev.ids.map((id) => (
                    <BossImg key={id} id={id} size="md" />
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
                  <BossImg id={id} size="lg" />
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

      {/* coming up (countdown only) */}
      {rest.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2">⏳ {t('tb.next')}</h2>
          <div className="tb-next-grid big">
            {rest.map((ev, i) => (
              <div
                className={`tb-next-card ${ev.sec <= IMMINENT ? 'imminent' : ''}`}
                key={ev.entry.hm}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="tb-next-count">{t('tb.in', { t: fmtCountdown(ev.sec) })}</div>
                <div className="tb-next-thumbs">
                  {ev.ids.map((id) => (
                    <BossImg key={id} id={id} size="md" />
                  ))}
                </div>
                <div className="tb-next-names">
                  {ev.ids.map((id) => BOSSES[id].name + (isHardPrimal(ev.entry, id) ? ' (H)' : '')).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* all bosses + favorites */}
      <section className="tb-section">
        <h2 className="tb-h2">👹 {t('tb.allbosses')}</h2>
        <div className="tb-boss-grid">
          {ALL_BOSSES.map((b, i) => {
            const n = nextForBoss(b.id, now);
            const fav = favorites.has(b.id);
            return (
              <div
                className={`tb-boss-card ${fav ? 'fav' : ''}`}
                key={b.id}
                style={{ ...tone(b.id), animationDelay: `${i * 30}ms` }}
              >
                <button
                  className={`tb-star ${fav ? 'on' : ''}`}
                  onClick={() => toggleFav(b.id)}
                  title={fav ? t('tb.fav.remove') : t('tb.fav.add')}
                  aria-label={fav ? t('tb.fav.remove') : t('tb.fav.add')}
                >
                  {fav ? '⭐' : '☆'}
                </button>
                <BossImg id={b.id} size="md" />
                <div className="tb-boss-body">
                  <strong>{b.name}</strong>
                  <span className="tb-boss-loc">
                    {b.location}
                    {b.level ? ` · ${t('tb.lvl')}${b.level}` : ''}
                  </span>
                  {n && <span className="tb-boss-next">{t('tb.boss.next', { in: fmtCountdown(n.sec) })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
