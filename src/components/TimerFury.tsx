import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { fmtCountdown, fmtSince } from '../lib/bosses';
import { FURY_LEVELS, buildFuryEvents, nextForLevel } from '../lib/fury';
import { useI18n } from '../lib/i18n';
import { speak } from '../lib/alert';

const IMMINENT = 120; // <= 2 min → pulse
const ALERT_MINS = [10, 5, 2];

const pad = (n: number) => String(n).padStart(2, '0');
const tone = (color: string) => ({ ['--tone']: color } as CSSProperties);

// Transparent Fury portrait with a per-level coloured 3D glow.
function FuryImg({ src, tone: color, size }: { src: string; tone: string; size: 'xl' | 'md' }) {
  return (
    <span className={`tb-portrait ${size}`} style={tone(color)}>
      <img src={src} alt="Fury" loading="lazy" />
    </span>
  );
}

export function TimerFury() {
  const { t, lang } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [audioOn, setAudioOn] = useState(false);
  const [alertMins, setAlertMins] = useState<Record<number, boolean>>(() => {
    try {
      return { 10: true, 5: true, 2: true, ...JSON.parse(localStorage.getItem('tf-alertmins') || '{}') };
    } catch {
      return { 10: true, 5: true, 2: true };
    }
  });

  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(() => buildFuryEvents(now), [now]);
  const spawned = events.filter((e) => e.state === 'spawned');
  const upcoming = events.filter((e) => e.state === 'upcoming');
  const hero = upcoming[0];
  const rest = upcoming.slice(1);

  // Voice alerts at the selected minute marks before each upcoming spawn.
  useEffect(() => {
    if (!audioOn) return;
    for (const ev of events) {
      if (ev.state !== 'upcoming') continue;
      for (const T of ALERT_MINS) {
        if (!alertMins[T]) continue;
        const th = T * 60;
        if (ev.sec <= th && ev.sec > th - 60) {
          const key = `${ev.level.id}-${ev.when.getTime()}-${T}`;
          if (!announced.current.has(key)) {
            announced.current.add(key);
            speak(t('tf.alert.one', { name: ev.level.name, min: T }), lang);
          }
        }
      }
    }
    if (announced.current.size > 240) {
      const cutoff = now.getTime() - 3600000;
      for (const k of announced.current) {
        const parts = k.split('-');
        if (Number(parts[parts.length - 2]) < cutoff) announced.current.delete(k);
      }
    }
  }, [events, audioOn, alertMins, lang, now, t]);

  const toggleAlertMin = (n: number) =>
    setAlertMins((prev) => {
      const nx = { ...prev, [n]: !prev[n] };
      localStorage.setItem('tf-alertmins', JSON.stringify(nx));
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
        <h1 className="tb-h1">{t('tf.title')}</h1>
        <p className="tb-sub">{t('tf.subtitle')}</p>
      </header>

      {/* controls */}
      <div className="tb-controls">
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

      {/* just appeared (kept ~3 min) */}
      {spawned.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2 spawn">🔥 {t('tf.justspawned')}</h2>
          <div className="tb-next-grid slim">
            {spawned.map((ev) => (
              <div className="tb-next-card slim spawned" key={ev.level.id} style={tone(ev.level.tone)}>
                <div className="tb-next-names slim">{ev.level.name}</div>
                <div className="tb-next-count slim spawn">{t('tf.spawnedago', { t: fmtSince(ev.sec) })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* hero: next fury overall (countdown only) */}
      {hero && (
        <section className={`tb-hero ${hero.sec <= IMMINENT ? 'imminent' : ''}`} style={tone(hero.level.tone)}>
          <div className="tb-hero-time">
            <span className="tb-hero-label">{t('tf.nextone')}</span>
            <span className="tb-hero-hhmm">{fmtCountdown(hero.sec)}</span>
          </div>
          <div className="tb-hero-bosses">
            <div className="tb-hero-boss">
              <FuryImg src={hero.level.img} tone={hero.level.tone} size="xl" />
              <div className="tb-hero-binfo">
                <strong>{hero.level.name}</strong>
                <span>
                  {t('tf.times')}: {hero.level.hours.map((h) => `${pad(h)}h`).join(' · ')}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* coming up (name + countdown only) */}
      {rest.length > 0 && (
        <section className="tb-section">
          <h2 className="tb-h2">⏳ {t('tf.next')}</h2>
          <div className="tb-next-grid slim">
            {rest.map((ev, i) => (
              <div
                className={`tb-next-card slim ${ev.sec <= IMMINENT ? 'imminent' : ''}`}
                key={ev.level.id}
                style={{ ...tone(ev.level.tone), animationDelay: `${i * 45}ms` }}
              >
                <div className="tb-next-names slim">{ev.level.name}</div>
                <div className="tb-next-count slim">{t('tb.in', { t: fmtCountdown(ev.sec) })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* all levels + their hour lists */}
      <section className="tb-section">
        <h2 className="tb-h2">🔥 {t('tf.levels')}</h2>
        <div className="tb-boss-grid">
          {FURY_LEVELS.map((level, i) => {
            const n = nextForLevel(level.id, now);
            return (
              <div
                className="tb-boss-card tf-level-card"
                key={level.id}
                style={{ ...tone(level.tone), animationDelay: `${i * 30}ms` }}
              >
                <FuryImg src={level.img} tone={level.tone} size="md" />
                <div className="tb-boss-body">
                  <strong>{level.name}</strong>
                  <span className="tb-boss-loc">
                    {t('tf.times')}: {level.hours.map((h) => `${pad(h)}h`).join(' · ')}
                  </span>
                  {n && <span className="tb-boss-next">{t('tf.boss.next', { in: fmtCountdown(n.sec) })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
