// Shared voice-alert engine used by Timer Boss and Timer Fury.
// A synthesised "horn of doom" dread tone, then a spoken line over a low drone.
import type { Lang } from './i18n';

// Pick the deepest male-sounding voice available for the language.
// Ordered preference: known deep male voices first, then any non-female.
export function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
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

// ---- Web Audio: a genuinely menacing alert, synthesised (not just TTS pitch) ----
let audioCtx: AudioContext | null = null;
function ensureCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

// Soft grit so the horn sounds thick, not clean.
function gritCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// A downward-bending "horn of doom" + sub rumble. Returns its duration (s).
function playDreadAlert(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const dur = 1.9;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.7, now + 0.18); // swell in
  master.gain.setValueAtTime(0.7, now + 1.0);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur); // fade out

  const shaper = ctx.createWaveShaper();
  shaper.curve = gritCurve(16);
  shaper.oversample = '2x';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, now);
  lp.frequency.exponentialRampToValueAtTime(650, now + 0.25); // open then close = growl
  lp.frequency.exponentialRampToValueAtTime(120, now + 1.7);
  const comp = ctx.createDynamicsCompressor(); // limiter so it never clips/hurts
  master.connect(shaper);
  shaper.connect(lp);
  lp.connect(comp);
  comp.connect(ctx.destination);

  // Detuned low brass — starts a touch high and bends DOWN (the ominous signature).
  const brass: [number, number][] = [[46, 0.4], [46.6, 0.4], [92, 0.2]];
  for (const [f, g] of brass) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.06, now);
    o.frequency.exponentialRampToValueAtTime(f, now + 0.55);
    const gain = ctx.createGain();
    gain.gain.value = g;
    o.connect(gain);
    gain.connect(master);
    o.start(now);
    o.stop(now + dur);
  }
  // Sub-bass rumble for dread.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(38, now);
  const subg = ctx.createGain();
  subg.gain.value = 0.5;
  sub.connect(subg);
  subg.connect(master);
  sub.start(now);
  sub.stop(now + dur);

  return dur;
}

// A quiet low bed that plays UNDER the voice while it speaks.
function startDrone(ctx: AudioContext): { stop: () => void } {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.11, now + 0.3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 170;
  const o1 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 41;
  o1.connect(g);
  o2.connect(g);
  g.connect(lp);
  lp.connect(ctx.destination);
  o1.start(now);
  o2.start(now);
  return {
    stop: () => {
      const t = (audioCtx ?? ctx).currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o1.stop(t + 0.5);
      o2.stop(t + 0.5);
    },
  };
}

// Deep, slow, fear-inducing alert: synthesised dread tone, then the spoken line
// over a low drone. pitch 0 / slow rate keep the TTS as heavy as the engine allows.
export function speak(text: string, lang: Lang) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const ctx = ensureCtx();
  const dur = ctx ? playDreadAlert(ctx) : 0;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  u.pitch = 0; // deepest the engine can go
  u.rate = 0.72; // slow, deliberate, menacing
  u.volume = 1;
  const v = pickVoice(lang);
  if (v) u.voice = v;

  let drone: { stop: () => void } | null = null;
  u.onstart = () => { if (ctx) drone = startDrone(ctx); };
  u.onend = () => drone?.stop();
  u.onerror = () => drone?.stop();

  // Let the horn swell, then bring the voice in over its fading tail.
  window.setTimeout(() => synth.speak(u), Math.min(1100, dur * 600));
}
