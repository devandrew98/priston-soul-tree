// Christmas details for the whole site: a light snowfall plus the `xmas` class on <html> (garland, Santa hat and footer line live in index.css).
// Nothing here changes the layout: the snow is a click-through canvas, the rest is decoration on existing elements.
import { useEffect, useRef, useState } from 'react';
import { CHRISTMAS_EVENT, CHRISTMAS_FLAG, flakeCount, isChristmasSeason } from '../lib/christmas';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { fetchSiteFlag } from '../lib/market/siteSettings';

interface Flake { x: number; y: number; r: number; v: number; a: number; ph: number; sway: number; crystal: boolean }

function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, raf = 0, last = 0;
    let flakes: Flake[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const make = (spread: boolean): Flake => {
      const crystal = Math.random() < 0.18;
      return {
        x: Math.random() * w, y: spread ? Math.random() * h : -8,
        r: crystal ? 1.3 + Math.random() * 0.9 : 0.8 + Math.random() * 1.6, v: 16 + Math.random() * 28, a: 0.3 + Math.random() * 0.45,
        ph: Math.random() * Math.PI * 2, sway: 6 + Math.random() * 14, crystal,
      };
    };
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = flakeCount(w, h);
      flakes = Array.from({ length: n }, () => make(true));
    };
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
      for (const f of flakes) {
        f.y += f.v * dt;
        f.ph += dt * 0.9;
        const x = f.x + Math.sin(f.ph) * f.sway;
        if (f.y > h + 8) Object.assign(f, make(false));
        ctx.globalAlpha = f.a;
        if (f.crystal) {
          // the bigger flakes are little six-armed snowflakes that turn slowly
          const R = f.r * 3.2, rot = f.ph * 0.5;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const a = rot + (k * Math.PI) / 3;
            ctx.moveTo(x - Math.cos(a) * R, f.y - Math.sin(a) * R); ctx.lineTo(x + Math.cos(a) * R, f.y + Math.sin(a) * R);
          }
          ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        }
      }
    };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <canvas ref={ref} className="xmas-snow" aria-hidden="true" />;
}

/** Whether the Christmas decoration is on right now: inside the season and not switched off by the administrator. */
export function useChristmasActive(): boolean {
  const [flag, setFlag] = useState(true); // the administrator's switch (on unless turned off)
  const season = isChristmasSeason();

  useEffect(() => {
    if (!season) return;
    if (BACKEND_ENABLED) fetchSiteFlag(CHRISTMAS_FLAG).then(setFlag).catch(() => {});
    const onFlag = (e: Event) => setFlag((e as CustomEvent<boolean>).detail !== false);
    window.addEventListener(CHRISTMAS_EVENT, onFlag);
    return () => window.removeEventListener(CHRISTMAS_EVENT, onFlag);
  }, [season]);

  return season && flag;
}

export function ChristmasTheme() {
  const active = useChristmasActive();
  // people who ask their system for less motion get the garland and the hat, but no snow
  const [still, setStill] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setStill(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('xmas', active);
    return () => document.documentElement.classList.remove('xmas');
  }, [active]);

  return active && !still ? <Snow /> : null;
}
