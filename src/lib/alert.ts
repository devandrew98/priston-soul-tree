// Shared voice-alert engine used by Timer Boss and Timer Fury.
// No sound effects — just a spoken line in a thick, angry-sounding male voice.
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

// Speak the alert with a male voice — thick/deep and delivered like an angry
// shout: a touch lower pitch for weight, a little faster and at full volume for
// the aggressive edge. No horn, no drone — just the voice.
export function speak(text: string, lang: Lang) {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  u.pitch = 0.5; // thicker / deeper — the "grosso" the request asks for
  u.rate = 1.12; // slightly punchy, like someone talking with anger
  u.volume = 1; // full force
  const v = pickVoice(lang);
  if (v) u.voice = v;

  synth.speak(u);
}
