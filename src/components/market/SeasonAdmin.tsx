// Admin > Temporada: edit the private /season page, in Portuguese and English: its title and opening text, and the FAQ topics
// (add, edit with formatting, reorder, hide, delete). An empty English field makes the page show the Portuguese text to English visitors.
import { useEffect, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import {
  deleteSeasonItem, fetchSeason, moveId, nextPosition, saveSeasonItem, saveSeasonOrder, saveSeasonPage,
  type SeasonItem, type SeasonPage,
} from '../../lib/season';
import { Loading } from '../Loading';
import { RichTextEditor } from './RichTextEditor';

const LINK = 'https://www.pristonzone.com/season';
const FLAG = { pt: '🇧🇷', en: '🇬🇧' } as const;

/** A topic being edited; `id` is null while it has not been saved yet. */
type Draft = Omit<SeasonItem, 'id'> & { key: string; id: string | null };

const toDraft = (i: SeasonItem): Draft => ({ key: i.id, ...i });

function PageCard({ page, onSaved }: { page: SeasonPage; onSaved: () => void }) {
  const [d, setD] = useState(page);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(d) !== JSON.stringify(page);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    setBusy(true); setMsg('');
    try { await saveSeasonPage(d); onSaved(); setMsg('Salvo.'); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <section className="sr-card ht-card">
      <h3 className="mk-h2">📄 Página</h3>
      <p className="mk-muted">
        Endereço (sem link no site, só quem receber): <code>{LINK}</code>{' '}
        <button type="button" className="mk-btn sm" onClick={() => { void navigator.clipboard?.writeText(LINK); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copiado!' : 'Copiar link'}</button>{' '}
        <a href="/season" target="_blank" rel="noopener noreferrer">Abrir a página ↗</a>
      </p>
      <div className="ht-grid">
        {(['pt', 'en'] as const).map((l) => (
          <div key={l} className="ht-col">
            <label className="mk-news-langfield">
              <span>{FLAG[l]} Título da página</span>
              <input value={l === 'pt' ? d.title : d.titleEn} maxLength={120} onChange={(e) => setD(l === 'pt' ? { ...d, title: e.target.value } : { ...d, titleEn: e.target.value })} />
            </label>
            <RichTextEditor label={`${FLAG[l]} Texto de abertura (opcional)`} rows={4} value={l === 'pt' ? d.intro : d.introEn}
              onChange={(v) => setD(l === 'pt' ? { ...d, intro: v } : { ...d, introEn: v })} />
          </div>
        ))}
      </div>
      <div className="ht-actions">
        <button type="button" className="mk-btn primary" disabled={busy || !dirty} onClick={save}>{busy ? '⏳' : 'Salvar página'}</button>
        {msg && <span className="mk-muted">{msg}</span>}
      </div>
    </section>
  );
}

function TopicCard({ item, first, last, onMove, onChanged, onDiscard }: {
  item: Draft; first: boolean; last: boolean; onMove: (dir: -1 | 1) => void; onChanged: () => void; onDiscard: () => void;
}) {
  const [d, setD] = useState(item);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState(false);
  const dirty = item.id === null || (['section', 'question', 'answer', 'sectionEn', 'questionEn', 'answerEn', 'visible'] as const).some((k) => d[k] !== item[k]);
  const noEnglish = !d.questionEn.trim() && !d.answerEn.trim();

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); onChanged(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const field = (l: 'pt' | 'en', k: 'section' | 'question' | 'answer'): 'section' | 'question' | 'answer' | 'sectionEn' | 'questionEn' | 'answerEn' =>
    (l === 'pt' ? k : `${k}En`) as 'sectionEn' | 'questionEn' | 'answerEn';

  return (
    <section className={`sr-card ht-card season-card${d.visible ? '' : ' hidden'}`}>
      <div className="season-card-head">
        <b>{item.id === null ? 'Novo tópico' : `Tópico ${item.position}`}</b>
        {!d.visible && <span className="season-hidden-tag">escondido</span>}
        {noEnglish && <span className="season-hidden-tag" title="Quem acessa em inglês vê o texto em português">sem inglês</span>}
        <span className="season-card-tools">
          {item.id !== null && <button type="button" className="mk-btn sm" disabled={busy || first} onClick={() => onMove(-1)} title="Subir">↑</button>}
          {item.id !== null && <button type="button" className="mk-btn sm" disabled={busy || last} onClick={() => onMove(1)} title="Descer">↓</button>}
        </span>
      </div>
      <div className="ht-grid">
        {(['pt', 'en'] as const).map((l) => (
          <div key={l} className="ht-col">
            <label className="mk-news-langfield">
              <span>{FLAG[l]} Seção (título do grupo; tópicos seguidos com a mesma seção ficam juntos)</span>
              <input value={d[field(l, 'section')]} maxLength={120} placeholder={l === 'pt' ? 'Ex.: 1. INFORMAÇÕES GERAIS' : 'Ex.: 1. GENERAL INFORMATION'}
                onChange={(e) => setD({ ...d, [field(l, 'section')]: e.target.value })} />
            </label>
            <label className="mk-news-langfield">
              <span>{FLAG[l]} Pergunta</span>
              <input value={d[field(l, 'question')]} maxLength={300} onChange={(e) => setD({ ...d, [field(l, 'question')]: e.target.value })} />
            </label>
            <RichTextEditor label={`${FLAG[l]} Resposta`} rows={7} value={d[field(l, 'answer')]} onChange={(v) => setD({ ...d, [field(l, 'answer')]: v })} />
          </div>
        ))}
      </div>
      <label className="mk-news-chk"><input type="checkbox" checked={d.visible} onChange={(e) => setD({ ...d, visible: e.target.checked })} /> Mostrar na página</label>
      <div className="ht-actions">
        <button type="button" className="mk-btn primary" disabled={busy || !dirty || !d.question.trim()}
          onClick={() => run(() => saveSeasonItem({ ...d, id: item.id }), 'Salvo.')}>
          {busy ? '⏳' : item.id === null ? 'Adicionar' : 'Salvar'}
        </button>
        {item.id === null && <button type="button" className="mk-btn" onClick={onDiscard}>Cancelar</button>}
        {item.id !== null && !ask && <button type="button" className="mk-btn danger" disabled={busy} onClick={() => setAsk(true)}>Excluir</button>}
        {item.id !== null && ask && (
          <>
            <span className="mk-warn">Excluir este tópico para sempre?</span>
            <button type="button" className="mk-btn danger" disabled={busy} onClick={() => run(() => deleteSeasonItem(item.id!))}>Sim, excluir</button>
            <button type="button" className="mk-btn" onClick={() => setAsk(false)}>Não</button>
          </>
        )}
        {msg && <span className="mk-muted">{msg}</span>}
      </div>
    </section>
  );
}

export function SeasonAdmin() {
  const [data, setData] = useState<{ page: SeasonPage; items: SeasonItem[] } | null>(null);
  const [err, setErr] = useState('');
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [orderMsg, setOrderMsg] = useState('');

  useEffect(() => {
    if (!BACKEND_ENABLED) { setErr('Sem conexão com o banco neste ambiente.'); return; }
    let cancelled = false;
    fetchSeason()
      .then((r) => { if (!cancelled) { setData(r); setErr(''); } })
      .catch((e: { message?: string }) => {
        if (cancelled) return;
        const m = e?.message ?? 'erro';
        setErr(/_en|season|relation|schema cache/i.test(m) ? 'Ainda não está ativo: rode os arquivos supabase/44_season_faq.sql e supabase/45_season_faq_en.sql no Supabase.' : m);
      });
    return () => { cancelled = true; };
  }, [version]);

  const reload = () => { setDraft(null); setVersion((v) => v + 1); };

  const move = async (id: string, dir: -1 | 1) => {
    if (!data) return;
    setOrderMsg('');
    try { await saveSeasonOrder(moveId(data.items.map((i) => i.id), id, dir)); reload(); } catch (e) { setOrderMsg(e instanceof Error ? e.message : String(e)); }
  };

  const newDraft = (items: SeasonItem[]): Draft => {
    const last = items[items.length - 1];
    return {
      key: 'new', id: null, position: nextPosition(items), visible: true, question: '', answer: '', questionEn: '', answerEn: '',
      section: last?.section ?? '', sectionEn: last?.sectionEn ?? '',
    };
  };

  return (
    <div className="ht">
      <p className="mk-muted">A página <b>/season</b> não tem link em lugar nenhum do site: só entra quem receber o endereço. Aqui você escreve tudo, em português 🇧🇷 e em inglês 🇬🇧: o título, o texto de abertura e os tópicos do FAQ. Quem acessa o site em inglês vê o texto em inglês; se um campo em inglês ficar vazio, aparece o português. O texto aceita negrito, itálico, sublinhado, listas e links.</p>
      {err && <p className="mk-warn">{err}</p>}
      {!data && !err && <Loading />}
      {data && (
        <>
          <PageCard key={JSON.stringify(data.page)} page={data.page} onSaved={reload} />
          <div className="ht-actions">
            <button type="button" className="mk-btn primary" disabled={!!draft} onClick={() => setDraft(newDraft(data.items))}>＋ Adicionar tópico</button>
            {orderMsg && <span className="mk-warn">{orderMsg}</span>}
          </div>
          {draft && <TopicCard key="new" item={draft} first last onMove={() => {}} onChanged={reload} onDiscard={() => setDraft(null)} />}
          {data.items.length === 0 && !draft && <p className="mk-muted">Nenhum tópico ainda. Toque em “Adicionar tópico”.</p>}
          {data.items.map((it, idx) => (
            <TopicCard key={JSON.stringify(it)} item={toDraft(it)} first={idx === 0} last={idx === data.items.length - 1}
              onMove={(dir) => move(it.id, dir)} onChanged={reload} onDiscard={() => {}} />
          ))}
        </>
      )}
    </div>
  );
}
