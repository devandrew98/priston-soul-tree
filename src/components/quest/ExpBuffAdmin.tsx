// EXP Buff Manager (administrators): the bonuses players can turn on, which quest categories each one affects, and how bonuses
// combine. Nothing about the real server is assumed: the combination, the rounding and the optional limit rules are choices.
import { useState } from 'react';
import { getQuestRepo } from '../../lib/quest/repo';
import type { CombineMode, ExpBonus, QuestSettings, RoundingMode } from '../../lib/quest/types';
import { Loading } from '../Loading';
import { AdminLog, errText, useAdminData } from './adminShared';

const parseDec = (t: string): number => Number(t.trim().replace(',', '.'));

export function ExpBuffAdmin() {
  const { data, state, reload } = useAdminData();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [logKey, setLogKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [nb, setNb] = useState({ id: '', name: '', kind: 'toggle' as ExpBonus['kind'], percent: '' });
  const [cap, setCap] = useState<string | null>(null);

  if (state === 'loading') return <Loading />;
  if (state === 'unavailable') return <p className="sk-notice">O Quest Tracker ainda não foi ativado no banco de dados (rode o SQL 30_quest_tracker.sql).</p>;
  if (state === 'error' || !data) return <p className="ag-warning" role="alert">Não foi possível carregar os dados.</p>;

  const s = data.settings;
  const run = async (what: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await what(); setMsg({ kind: 'ok', text: ok }); reload(); setLogKey((k) => k + 1); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); } finally { setBusy(false); }
  };
  const saveSettings = (patch: Partial<QuestSettings>, ok = 'Configuração salva.') => run(() => getQuestRepo().saveSettings({ ...s, ...patch, rules: { ...s.rules, ...(patch.rules ?? {}) } }), ok);
  const saveBonus = (b: ExpBonus, ok = 'Bônus salvo.') => run(() => getQuestRepo().saveBonus(b), ok);
  const bonuses = [...data.bonuses].sort((a, b) => a.sort - b.sort);
  const capText = cap ?? (s.rules.capPercentPerQuest === null ? '' : String(s.rules.capPercentPerQuest));
  const idOk = /^[a-z0-9_-]{2,40}$/.test(nb.id) && !data.bonuses.some((b) => b.id === nb.id);
  const pctNew = nb.percent === '' ? 0 : parseDec(nb.percent);

  return (
    <div className="qa">
      {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}

      <section className="sr-card cl-box">
        <h3>Como os bônus se combinam</h3>
        <p className="mk-muted">Escolha conforme a mecânica real do servidor. Os dois jeitos dão resultados diferentes, então valide com um caso conhecido antes de divulgar. Exemplo com +30%, +5% e +8%: aditivo = +43%; multiplicativo = 1,30 × 1,05 × 1,08 = +47,42%.</p>
        <div className="qa-bar">
          <select value={s.combineMode} disabled={busy} aria-label="Combinação" onChange={(e) => void saveSettings({ combineMode: e.target.value as CombineMode })}>
            <option value="additive">Aditiva: base × (1 + soma dos bônus)</option>
            <option value="multiplicative">Multiplicativa: base × (1 + bônus₁) × (1 + bônus₂) …</option>
          </select>
          <select value={s.rounding} disabled={busy} aria-label="Arredondamento" onChange={(e) => void saveSettings({ rounding: e.target.value as RoundingMode })}>
            <option value="floor">Arredondar a EXP final para baixo</option>
            <option value="round">Arredondar a EXP final para o mais próximo</option>
            <option value="ceil">Arredondar a EXP final para cima</option>
          </select>
        </div>
      </section>

      <section className="sr-card cl-box">
        <h3>Bônus de EXP</h3>
        <p className="mk-muted">"Liga/desliga" usa o percentual definido aqui. "Percentual do jogador" (como a Soul Tree) deixa cada jogador informar o próprio valor. As categorias marcadas são as afetadas (nenhuma marcada = todas).</p>
        <div className="qt-scroll">
          <table className="ag-table qt-table">
            <thead><tr><th>Bônus</th><th>Tipo</th><th>%</th><th>Ativo</th><th>Afeta as categorias</th><th>Ordem</th><th /></tr></thead>
            <tbody>
              {bonuses.map((b) => (
                <tr key={b.id}>
                  <td><input defaultValue={b.name} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value !== b.name && void saveBonus({ ...b, name: e.target.value.trim() })} /><br /><small className="mk-muted">{b.id}</small></td>
                  <td>
                    <select value={b.kind} disabled={b.builtin || busy} onChange={(e) => void saveBonus({ ...b, kind: e.target.value as ExpBonus['kind'] })}>
                      <option value="toggle">Liga/desliga</option><option value="manual">Percentual do jogador</option>
                    </select>
                  </td>
                  <td>{b.kind === 'manual' ? <small className="mk-muted">definido pelo jogador</small> : <input defaultValue={String(b.percent).replace('.', ',')} inputMode="decimal" style={{ width: 80 }} onBlur={(e) => { const n = parseDec(e.target.value); if (Number.isFinite(n) && n >= 0 && n <= 1000 && n !== b.percent) void saveBonus({ ...b, percent: n }); }} />}</td>
                  <td><input type="checkbox" checked={b.enabled} onChange={(e) => void saveBonus({ ...b, enabled: e.target.checked })} /></td>
                  <td>
                    <div className="qt-actions">
                      {data.categories.map((c) => (
                        <label key={c.id} className="qt-check"><input type="checkbox" checked={b.appliesTo.includes(c.id)} onChange={(e) => void saveBonus({ ...b, appliesTo: e.target.checked ? [...b.appliesTo, c.id] : b.appliesTo.filter((x) => x !== c.id) })} /> <span>{c.name}</span></label>
                      ))}
                    </div>
                  </td>
                  <td><input defaultValue={b.sort} inputMode="numeric" style={{ width: 60 }} onBlur={(e) => Number(e.target.value) !== b.sort && void saveBonus({ ...b, sort: Number(e.target.value) || 0 })} /></td>
                  <td><button type="button" className="mk-btn cl-danger" disabled={b.builtin || busy} title={b.builtin ? 'Os bônus iniciais não podem ser excluídos (desative-os)' : ''} onClick={() => void run(() => getQuestRepo().deleteBonus(b.id), 'Bônus removido.')}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>Novo tipo de bônus</h4>
        <div className="qa-bar">
          <input value={nb.id} onChange={(e) => setNb({ ...nb, id: e.target.value.toLowerCase() })} placeholder="id (a-z, 0-9, - _)" aria-label="ID do bônus" />
          <input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="Nome do bônus" aria-label="Nome do bônus" />
          <select value={nb.kind} onChange={(e) => setNb({ ...nb, kind: e.target.value as ExpBonus['kind'] })} aria-label="Tipo"><option value="toggle">Liga/desliga</option><option value="manual">Percentual do jogador</option></select>
          {nb.kind === 'toggle' && <input value={nb.percent} onChange={(e) => setNb({ ...nb, percent: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="% (ex.: 10)" aria-label="Percentual" style={{ maxWidth: 110 }} />}
          <button type="button" className="mk-btn primary" disabled={busy || !idOk || !nb.name.trim() || !(Number.isFinite(pctNew) && pctNew >= 0 && pctNew <= 1000)}
            onClick={() => void run(async () => { await getQuestRepo().saveBonus({ id: nb.id, name: nb.name.trim(), kind: nb.kind, percent: nb.kind === 'toggle' ? pctNew : 0, enabled: true, appliesTo: [], sort: bonuses.length + 1, builtin: false }); setNb({ id: '', name: '', kind: 'toggle', percent: '' }); }, 'Bônus criado (vale para todas as categorias; marque categorias para limitar).')}>➕ Adicionar bônus</button>
        </div>
      </section>

      <section className="sr-card cl-box">
        <h3>Regras especiais <small>(não confirmadas, desligadas por padrão)</small></h3>
        <p className="mk-muted">Só use se a regra for confirmada no jogo. Desligadas, as quests dão sempre a EXP cadastrada com os bônus, e a EXP que passa do fim do level vai para o level seguinte.</p>
        <div className="qa-bar">
          <label className="mk-field"><span>Limite de EXP por quest (% da EXP do level em que ela é entregue; vazio = sem limite)</span>
            <input value={capText} inputMode="decimal" placeholder="sem limite" onChange={(e) => setCap(e.target.value.replace(/[^\d.,]/g, '').slice(0, 8))}
              onBlur={() => { const t = capText.trim(); const n = parseDec(t); if (cap !== null) { void saveSettings({ rules: { ...s.rules, capPercentPerQuest: t === '' ? null : Number.isFinite(n) && n > 0 ? n : s.rules.capPercentPerQuest } }); setCap(null); } }} />
          </label>
          <label className="mk-field"><span>EXP que passa do fim do level</span>
            <select value={s.rules.overflow} disabled={busy} onChange={(e) => void saveSettings({ rules: { ...s.rules, overflow: e.target.value as 'carry' | 'lose' } })}>
              <option value="carry">Passa para o level seguinte (padrão)</option>
              <option value="lose">É perdida</option>
            </select>
          </label>
        </div>
      </section>

      <AdminLog entities={['exp_bonuses', 'quest_settings']} refreshKey={logKey} />
    </div>
  );
}
