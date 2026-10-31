// Admin > Mensagens da Home: edit the welcome text and the Pix support text, in PT and EN, and choose in which language each is shown.
// Empty fields keep the site's default text (shown as the placeholder).
import { useEffect, useState } from 'react';
import { useI18n, dictText } from '../../lib/i18n';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { fetchHomeTexts, resetHomeText, saveHomeText, type HomeText, type HomeTextKey } from '../../lib/market/homeTexts';
import { Loading } from '../Loading';
import { RichTextEditor } from './RichTextEditor';

const TXT = {
  hint: { pt: 'Os textos fixos da Home. Deixe um campo vazio para usar o texto padrão (aparece em cinza). O texto aceita negrito, itálico, sublinhado, listas e links. Para os avisos e novidades, use “Notícias”.', en: 'The fixed texts of the Home. Leave a field empty to use the default text (shown in grey). The text accepts bold, italic, underline, lists and links. For notices and news, use “News”.' },
  showIn: { pt: 'Aparece em:', en: 'Shown in:' },
  title: { pt: 'Título', en: 'Title' },
  body: { pt: 'Texto', en: 'Text' },
  save: { pt: 'Salvar', en: 'Save' },
  saved: { pt: 'Salvo.', en: 'Saved.' },
  reset: { pt: 'Voltar ao texto padrão', en: 'Back to the default text' },
  none: { pt: 'Marque pelo menos um idioma.', en: 'Pick at least one language.' },
  notReady: { pt: 'Ainda não está ativo: rode o arquivo supabase/43_home_texts.sql no Supabase.', en: 'Not active yet: run supabase/43_home_texts.sql in Supabase.' },
  noBackend: { pt: 'Sem conexão com o banco neste ambiente.', en: 'No database connection in this environment.' },
} as const;

const BLOCKS: { key: HomeTextKey; icon: string; name: { pt: string; en: string }; where: { pt: string; en: string }; titleKey: string; bodyKey: string }[] = [
  { key: 'welcome', icon: '👋', name: { pt: 'Boas-vindas', en: 'Welcome' }, where: { pt: 'Embaixo da logo, no topo da Home', en: 'Under the logo, at the top of the Home' }, titleKey: 'home.welcome.title', bodyKey: 'home.welcome.body' },
  { key: 'pix', icon: '💜', name: { pt: 'Apoie o PristonZONE (Pix)', en: 'Support PristonZONE (Pix)' }, where: { pt: 'Cartão ao lado da logo, com o QR Code', en: 'Card beside the logo, with the QR code' }, titleKey: 'home.pix.title', bodyKey: 'home.pix.body' },
];

const blank = (key: HomeTextKey): HomeText => ({ key, titlePt: '', titleEn: '', bodyPt: '', bodyEn: '', showPt: true, showEn: true });

function Block({ def, saved, onChange }: { def: (typeof BLOCKS)[number]; saved: HomeText | undefined; onChange: () => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [d, setD] = useState<HomeText>(saved ?? blank(def.key));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(d) !== JSON.stringify(saved ?? blank(def.key));
  const noLang = !d.showPt && !d.showEn;

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true); setMsg('');
    try { await fn(); after?.(); onChange(); setMsg(T('saved')); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <section className="sr-card ht-card">
      <h3 className="mk-h2">{def.icon} {def.name[lang]}</h3>
      <p className="mk-muted">{def.where[lang]}</p>
      <div className="ht-langs" role="group" aria-label={T('showIn')}>
        <b>{T('showIn')}</b>
        <label className="mk-news-chk"><input type="checkbox" checked={d.showPt} onChange={(e) => setD({ ...d, showPt: e.target.checked })} /> 🇧🇷 Português</label>
        <label className="mk-news-chk"><input type="checkbox" checked={d.showEn} onChange={(e) => setD({ ...d, showEn: e.target.checked })} /> 🇬🇧 English</label>
      </div>
      <div className="ht-grid">
        {(['pt', 'en'] as const).map((l) => (
          <div key={l} className="ht-col">
            <label className="mk-news-langfield">
              <span>{l === 'pt' ? '🇧🇷' : '🇬🇧'} {T('title')}</span>
              <input value={l === 'pt' ? d.titlePt : d.titleEn} placeholder={dictText(def.titleKey, l)}
                onChange={(e) => setD(l === 'pt' ? { ...d, titlePt: e.target.value } : { ...d, titleEn: e.target.value })} />
            </label>
            <RichTextEditor label={`${l === 'pt' ? '🇧🇷' : '🇬🇧'} ${T('body')}`} rows={7} value={l === 'pt' ? d.bodyPt : d.bodyEn} placeholder={dictText(def.bodyKey, l)}
              onChange={(v) => setD(l === 'pt' ? { ...d, bodyPt: v } : { ...d, bodyEn: v })} />
          </div>
        ))}
      </div>
      {noLang && <p className="mk-warn">{T('none')}</p>}
      <div className="ht-actions">
        <button type="button" className="mk-btn primary" disabled={busy || !dirty || noLang} onClick={() => run(() => saveHomeText(d))}>{busy ? '⏳' : T('save')}</button>
        {saved && <button type="button" className="mk-btn danger" disabled={busy} onClick={() => run(() => resetHomeText(def.key), () => setD(blank(def.key)))}>{T('reset')}</button>}
        {msg && <span className="mk-muted">{msg}</span>}
      </div>
    </section>
  );
}

export function HomeTextsAdmin() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [rows, setRows] = useState<Partial<Record<HomeTextKey, HomeText>> | null>(null);
  const [err, setErr] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!BACKEND_ENABLED) { setErr(T('noBackend')); return; }
    let cancelled = false;
    fetchHomeTexts()
      .then((r) => { if (!cancelled) { setRows(r); setErr(''); } })
      .catch((e: { message?: string }) => { if (!cancelled) setErr(/home_texts|relation|schema cache/i.test(e?.message ?? '') ? T('notReady') : (e?.message ?? 'erro')); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return (
    <div className="ht">
      <p className="mk-muted">{T('hint')}</p>
      {err && <p className="mk-warn">{err}</p>}
      {!rows && !err && <Loading />}
      {rows && BLOCKS.map((b) => <Block key={b.key} def={b} saved={rows[b.key]} onChange={() => setVersion((v) => v + 1)} />)}
    </div>
  );
}
