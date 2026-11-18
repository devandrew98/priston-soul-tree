// Admin > Rifa: create the raffle (item, prices in coins and/or gold, how many numbers, limit per person), confirm the payments the players
// made in the game, and draw the winner. The draw is made by the database at random among the PAID numbers: nobody picks it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadToBucket } from '../../lib/market/auth';
import { fmtGold, soldCount, type HistoryItem, type Raffle, type TakenNumber } from '../../lib/raffle';
import {
  cancelRaffle, createRaffle, drawRaffle, fetchAdminNumbers, fetchRaffle, fetchRaffleHistory, markPaid, releaseNumber,
  type AdminNumber,
} from '../../lib/raffleApi';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import { SOULS } from '../../lib/souls';
import { errText } from '../raffle/RafflePage';
import { Loading } from '../Loading';
import { useAuth } from './store';
import { RichTextEditor } from './RichTextEditor';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const toInt = (s: string): number | null => { const n = Number(s.replace(/\D/g, '')); return Number.isInteger(n) && n > 0 ? n : null; };

// ---------- item image: upload from the computer ----------
const MAX_FILE_MB = 8;

/** Scales the picture down (longest side 600 px, keeps transparency) so the raffle page stays light. */
async function shrink(file: File, max = 600): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.92));
  return blob ? new File([blob], 'item.webp', { type: 'image/webp' }) : file;
}

/** Picture of the item: send a file from the computer (goes to the site's image storage) or type a path/link. */
function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const auth = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [bad, setBad] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('image/')) return setErr('Escolha um arquivo de imagem (png, jpg, webp...).');
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setErr(`A imagem passa de ${MAX_FILE_MB} MB. Escolha uma menor.`);
    if (!auth.userId) return setErr('Entre na sua conta de administrador para enviar imagens.');
    setBusy(true);
    try {
      const url = await uploadToBucket('item-images', auth.userId, await shrink(file));
      setBad(false); onChange(url);
    } catch (e) { setErr(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  return (
    <div className="rf-upload">
      <span className="rf-upload-label">Imagem do item (opcional)</span>
      <div className="rf-upload-row">
        {value && !bad ? <img className="rf-upload-prev" src={value} alt="" onError={() => setBad(true)} /> : <span className="rf-upload-prev rf-upload-empty" aria-hidden="true">🎁</span>}
        <div className="rf-upload-ctl">
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          <button type="button" className="mk-btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? '⏳ Enviando…' : '📁 Enviar do computador'}</button>
          {value && <button type="button" className="mk-btn sm" disabled={busy} onClick={() => { onChange(''); setBad(false); }}>Remover</button>}
          <input className="rf-upload-url" value={value} maxLength={300} onChange={(e) => { setBad(false); onChange(e.target.value); }} placeholder="ou cole um link / caminho (ex.: /fusion/LufiaSoul.png)" />
        </div>
      </div>
      {err && <p className="mk-warn" role="alert">{err}</p>}
    </div>
  );
}

// ---------- create ----------
function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({ itemName: '', itemNote: '', imageUrl: '', coins: '', goldKk: '', total: '30', max: '3', hold: '48', payTo: '', payText: '', endsAt: '', rules: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<typeof f>) => setF((c) => ({ ...c, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const coins = f.coins.trim() ? toInt(f.coins) : null;
    const gold = f.goldKk.trim() ? toInt(f.goldKk) : null;
    const total = toInt(f.total), max = toInt(f.max), hold = toInt(f.hold);
    if (!f.itemName.trim()) return setErr('Informe o item da rifa.');
    if (coins === null && gold === null) return setErr('Informe o preço em coins, em gold, ou nos dois.');
    if ((f.coins.trim() && coins === null) || (f.goldKk.trim() && gold === null)) return setErr('Os preços precisam ser números inteiros.');
    if (!total || total < 2 || total > 500) return setErr('A quantidade de números vai de 2 a 500.');
    if (!max || max > total) return setErr('O máximo por pessoa precisa ser pelo menos 1 e não pode passar da quantidade de números.');
    if (!hold || hold > 720) return setErr('A validade da reserva vai de 1 a 720 horas.');
    setBusy(true);
    try {
      await createRaffle({
        itemName: f.itemName, itemNote: f.itemNote, imageUrl: f.imageUrl, priceCoins: coins, priceGoldKk: gold,
        totalNumbers: total, maxPerPerson: max, holdHours: hold, payTo: f.payTo, payText: f.payText, rules: f.rules,
        endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:00`).toISOString() : null,
      });
      onCreated();
    } catch (x) { setErr(errText(x, 'pt')); } finally { setBusy(false); }
  };

  return (
    <form className="sr-card ht-card" onSubmit={submit}>
      <h3 className="mk-h2">➕ Nova rifa</h3>
      <p className="mk-muted">Só pode haver uma rifa aberta por vez. Depois de criada, o item e os preços não mudam (se errar, cancele e crie outra); o personagem que recebe, o prazo e as regras você ainda pode editar.</p>
      <label className="mk-news-langfield"><span>Usar uma soul como item (opcional)</span>
        <select value="" onChange={(e) => { const s = SOULS.find((x) => x.id === e.target.value); if (s) set({ itemName: `${s.name}`, imageUrl: s.img ?? '' }); }}>
          <option value="">— escolher —</option>
          {[...SOULS].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
      <div className="ht-grid">
        <div className="ht-col">
          <label className="mk-news-langfield"><span>Item</span><input value={f.itemName} maxLength={80} onChange={(e) => set({ itemName: e.target.value })} placeholder="Ex.: Lufia Soul" /></label>
          <label className="mk-news-langfield"><span>Observação do item (opcional)</span><input value={f.itemNote} maxLength={120} onChange={(e) => set({ itemNote: e.target.value })} /></label>
          <ImageUploader value={f.imageUrl} onChange={(url) => set({ imageUrl: url })} />
        </div>
        <div className="ht-col">
          <label className="mk-news-langfield"><span>Preço por número em Coins (opcional)</span><input inputMode="numeric" value={f.coins} onChange={(e) => set({ coins: e.target.value.replace(/\D/g, '') })} placeholder="1000" /></label>
          <label className="mk-news-langfield"><span>Preço por número em Gold, em kk (opcional)</span><input inputMode="numeric" value={f.goldKk} onChange={(e) => set({ goldKk: e.target.value.replace(/\D/g, '') })} placeholder="350 (= 350kk)" /></label>
          <label className="mk-news-langfield"><span>Personagem que recebe (opcional, só para a frase padrão)</span><input value={f.payTo} maxLength={40} onChange={(e) => set({ payTo: e.target.value })} /></label>
        </div>
        <div className="ht-col">
          <label className="mk-news-langfield"><span>Quantidade de números</span><input inputMode="numeric" value={f.total} onChange={(e) => set({ total: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="mk-news-langfield"><span>Máximo de números por pessoa</span><input inputMode="numeric" value={f.max} onChange={(e) => set({ max: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="mk-news-langfield"><span>Validade da reserva (horas)</span><input inputMode="numeric" value={f.hold} onChange={(e) => set({ hold: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="mk-news-langfield"><span>Data prevista do fim (só informativa, não encerra sozinha)</span><input type="date" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></label>
        </div>
      </div>
      <RichTextEditor label="Como o jogador paga (opcional): texto que aparece depois da reserva. Pode ser no jogo, pelo Discord..." rows={4} value={f.payText} onChange={(v) => set({ payText: v })} placeholder="Vazio = frase padrão. Ex.: Combine o pagamento comigo pelo Discord (usuario#0000), informando o seu nick e os números." />
      <RichTextEditor label="Regras extras (opcional)" rows={4} value={f.rules} onChange={(v) => set({ rules: v })} />
      {err && <p className="mk-warn" role="alert">{err}</p>}
      <div className="ht-actions"><button type="submit" className="mk-btn primary" disabled={busy}>{busy ? '⏳' : 'Abrir a rifa'}</button></div>
    </form>
  );
}

// ---------- open raffle ----------
function OpenRaffle({ raffle, taken, onChanged }: { raffle: Raffle; taken: TakenNumber[]; onChanged: () => void }) {
  const [nums, setNums] = useState<AdminNumber[] | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<'draw' | 'cancel' | null>(null);
  const [result, setResult] = useState<{ number: number; nick: string; paid: number } | null>(null);
  const [info, setInfo] = useState({ payTo: raffle.payTo, payText: raffle.payText, imageUrl: raffle.imageUrl, rules: raffle.rules, endsAt: raffle.endsAt ? raffle.endsAt.slice(0, 10) : '' });

  const load = useCallback(async () => { try { setNums(await fetchAdminNumbers()); setErr(''); } catch (e) { setErr(errText(e, 'pt')); } }, []);
  useEffect(() => { void load(); }, [load, taken]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true); setErr(''); setMsg('');
    try { await fn(); if (ok) setMsg(ok); await load(); onChanged(); } catch (e) { setErr(errText(e, 'pt')); } finally { setBusy(false); }
  };

  const saveInfo = () => run(async () => {
    if (!supabase) throw new Error('backend_not_configured');
    const { error } = await supabase.from('raffles').update({
      pay_to: info.payTo.trim(), image_url: info.imageUrl.trim(), rules: info.rules.trim(), ends_at: info.endsAt ? new Date(`${info.endsAt}T23:59:00`).toISOString() : null,
      ...(info.payText.trim() !== raffle.payText.trim() ? { pay_text: info.payText.trim() } : {}), // only when changed (needs supabase/50)
    }).eq('id', raffle.id);
    if (error) throw error;
  }, 'Salvo.');

  const doDraw = async () => {
    setBusy(true); setErr(''); setAsk(null);
    try { setResult(await drawRaffle()); onChanged(); } catch (e) { setErr(errText(e, 'pt')); } finally { setBusy(false); }
  };

  const paid = nums?.filter((n) => n.status === 'paid').length ?? soldCount(taken);

  if (result) {
    return (
      <section className="sr-card ht-card rf-draw-result">
        <h3 className="mk-h2">🎉 Sorteio feito!</h3>
        <p className="rf-draw-big">Número <b>{result.number}</b> — <b>{result.nick}</b></p>
        <p className="mk-muted">Foi escolhido ao acaso entre os {result.paid} números pagos. O resultado já aparece na aba Ganhadores e não pode ser alterado. Entregue o item ao jogador no jogo.</p>
      </section>
    );
  }

  return (
    <>
      <section className="sr-card ht-card">
        <h3 className="mk-h2">🎁 {raffle.itemName} <small className="mk-muted">(rifa aberta)</small></h3>
        <p className="mk-muted">
          {raffle.priceCoins !== null && <>{raffle.priceCoins.toLocaleString('pt-BR')} Coins</>}
          {raffle.priceCoins !== null && raffle.priceGoldKk !== null && ' ou '}
          {raffle.priceGoldKk !== null && <>{fmtGold(raffle.priceGoldKk)} Gold</>} por número · {raffle.totalNumbers} números · máx. {raffle.maxPerPerson} por pessoa · reserva de {raffle.holdHours} h
        </p>
        <p><b>{paid}</b> pagos · <b>{(nums?.length ?? 0) - paid}</b> aguardando pagamento · <b>{raffle.totalNumbers - (nums?.length ?? 0)}</b> livres</p>
      </section>

      <section className="sr-card ht-card">
        <h3 className="mk-h2">💳 Pagamentos</h3>
        <p className="mk-muted">Confira no jogo se o pagamento chegou (o nick de quem pagou aparece abaixo) e toque em “Marcar pago”. Reservas sem pagamento vencem sozinhas no prazo.</p>
        {!nums && !err && <Loading />}
        {nums && nums.length === 0 && <p className="mk-muted">Ninguém reservou número ainda.</p>}
        {nums && nums.length > 0 && (
          <div className="bal-table-wrap">
            <table className="af-table">
              <thead><tr><th>Nº</th><th>Nick no jogo</th><th>Conta do site</th><th>Situação</th><th>Reservado em</th><th>Vence em</th><th /></tr></thead>
              <tbody>
                {nums.map((n) => (
                  <tr key={n.n}>
                    <td><b>{n.n}</b></td>
                    <td>{n.nick}</td>
                    <td>{n.siteNick ?? '—'}</td>
                    <td>{n.status === 'paid' ? <span className="rf-paid-tag">pago ✓ {when(n.paidAt)}</span> : <span className="rf-wait-tag">aguardando</span>}</td>
                    <td>{when(n.reservedAt)}</td>
                    <td>{n.status === 'paid' ? '—' : when(n.expiresAt)}</td>
                    <td className="bal-row-actions">
                      {n.status === 'reserved' && <button type="button" className="mk-btn sm primary" disabled={busy} onClick={() => run(() => markPaid(n.n))}>Marcar pago</button>}{' '}
                      <button type="button" className="mk-btn sm danger" disabled={busy} onClick={() => { if (window.confirm(`Liberar o número ${n.n} de ${n.nick}?`)) void run(() => releaseNumber(n.n)); }}>Liberar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card ht-card">
        <h3 className="mk-h2">✏️ Informações da rifa</h3>
        <div className="ht-col">
          <ImageUploader value={info.imageUrl} onChange={(url) => setInfo({ ...info, imageUrl: url })} />
          <label className="mk-news-langfield"><span>Personagem que recebe (opcional, só para a frase padrão)</span><input value={info.payTo} maxLength={40} onChange={(e) => setInfo({ ...info, payTo: e.target.value })} /></label>
          <label className="mk-news-langfield"><span>Data prevista do fim (só informativa)</span><input type="date" value={info.endsAt} onChange={(e) => setInfo({ ...info, endsAt: e.target.value })} /></label>
        </div>
        <RichTextEditor label="Como o jogador paga: texto que aparece depois da reserva (no jogo, pelo Discord...). Vazio = frase padrão." rows={4} value={info.payText} onChange={(v) => setInfo({ ...info, payText: v })} />
        <RichTextEditor label="Regras extras" rows={4} value={info.rules} onChange={(v) => setInfo({ ...info, rules: v })} />
        <div className="ht-actions"><button type="button" className="mk-btn" disabled={busy} onClick={saveInfo}>Salvar informações</button></div>
      </section>

      <section className="sr-card ht-card">
        <h3 className="mk-h2">🎲 Encerrar a rifa</h3>
        <p className="mk-muted">Você decide quando encerrar: com todos os números vendidos ou antes. O sorteio é feito pelo banco de dados, ao acaso, <b>só entre os números pagos</b>. Nem você escolhe o número nem a pessoa, e depois nada mais pode ser alterado.</p>
        {ask === 'draw' ? (
          <div className="ht-actions">
            <span className="mk-warn">Sortear agora entre {paid} número(s) pago(s) e encerrar a rifa? Não dá para desfazer.</span>
            <button type="button" className="mk-btn primary" disabled={busy} onClick={doDraw}>Sim, sortear</button>
            <button type="button" className="mk-btn" onClick={() => setAsk(null)}>Não</button>
          </div>
        ) : ask === 'cancel' ? (
          <div className="ht-actions">
            <span className="mk-warn">Cancelar a rifa sem sortear? Os números reservados são liberados e você terá que devolver os pagamentos no jogo.</span>
            <button type="button" className="mk-btn danger" disabled={busy} onClick={() => run(() => cancelRaffle())}>Sim, cancelar</button>
            <button type="button" className="mk-btn" onClick={() => setAsk(null)}>Não</button>
          </div>
        ) : (
          <div className="ht-actions">
            <button type="button" className="mk-btn primary" disabled={busy || paid === 0} onClick={() => setAsk('draw')}>🎲 Sortear e encerrar</button>
            <button type="button" className="mk-btn danger" disabled={busy} onClick={() => setAsk('cancel')}>Cancelar a rifa</button>
            {paid === 0 && <span className="mk-muted">Precisa de pelo menos 1 número pago.</span>}
          </div>
        )}
      </section>
      {err && <p className="mk-warn" role="alert">{err}</p>}
      {msg && <p className="mk-muted">{msg}</p>}
    </>
  );
}

export function RaffleAdmin() {
  const [state, setState] = useState<{ raffle: Raffle | null; taken: TakenNumber[] } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [err, setErr] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!BACKEND_ENABLED) { setErr('Sem conexão com o banco neste ambiente.'); return; }
    let cancelled = false;
    Promise.all([fetchRaffle(), fetchRaffleHistory()])
      .then(([s, h]) => { if (!cancelled) { setState(s); setHistory(h); setErr(''); } })
      .catch((e: { message?: string }) => {
        if (cancelled) return;
        const m = e?.message ?? 'erro';
        setErr(/raffle|relation|schema cache/i.test(m) ? 'Ainda não está ativo: rode o arquivo supabase/49_raffle.sql no Supabase.' : m);
      });
    return () => { cancelled = true; };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);

  return (
    <div className="ht">
      <p className="mk-muted">A rifa aparece para todos em <b>/rifa</b> (com link no menu). O jogador reserva o número no site e paga no jogo; você confirma o pagamento aqui e faz o sorteio quando quiser.</p>
      {err && <p className="mk-warn">{err}</p>}
      {!state && !err && <Loading />}
      {state && (state.raffle ? <OpenRaffle key={state.raffle.id} raffle={state.raffle} taken={state.taken} onChanged={reload} /> : <CreateForm onCreated={reload} />)}
      {state && history.length > 0 && (
        <section className="sr-card ht-card">
          <h3 className="mk-h2">📜 Rifas encerradas</h3>
          <ul className="rf-admin-past">
            {history.map((h) => (
              <li key={h.id}>
                <b>{h.itemName}</b> — {h.status === 'cancelled' ? 'cancelada' : <>ganhador <b>{h.winnerNick}</b> (nº {h.winnerNumber}), sorteada em {when(h.drawnAt)}</>} · {h.sold}/{h.totalNumbers} vendidos
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
