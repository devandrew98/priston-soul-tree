// Settings of the pain diary: time zone and doctor, warning criteria, trash, private access and backup.
import { useState } from 'react';
import { deriveSecret, storeSecret } from '../../lib/dor/api';
import type { DorStore } from '../../lib/dor/store';
import { dayKey, fmtDate, fmtDateTime } from '../../lib/dor/time';
import type { AlertRule, Rec } from '../../lib/dor/types';
import { download } from './Reports';
import { Field, Sheet, useSaver } from './ui';

const ZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Fortaleza', 'America/Rio_Branco', 'America/Noronha', 'UTC'];

export function describe(store: DorStore, r: Rec): string {
  const tz = store.settings.tz;
  const d = r.data as Record<string, unknown>;
  const when = (iso: unknown) => (typeof iso === 'string' ? fmtDateTime(new Date(iso).getTime(), tz) : '');
  switch (r.kind) {
    case 'crisis': return `Crise de ${when(d.start)}`;
    case 'intensity': return `Dor ${d.value}/10 — ${when(d.at)}`;
    case 'symptom': return `Sintomas — ${when(d.at)}`;
    case 'med_admin': return `${d.name} — ${when(d.at)}`;
    case 'med': return `Medicamento ${d.name}`;
    case 'therapy': return `Tratamento: ${d.name} (${fmtDate(String(d.date))})`;
    case 'sleep': return `Sono de ${fmtDate(String(d.date))}`;
    case 'physio': return `Fisioterapia — ${when(d.at)}`;
    case 'nopain': return `Dia sem cefaleia ${fmtDate(String(d.date))}`;
    case 'alert_rule': return `Critério de aviso ${d.name}`;
    default: return 'Registro';
  }
}

export function SettingsSheet({ store, secret, onClose, onRotated, onLeave }: { store: DorStore; secret: string; onClose: () => void; onRotated: (s: string) => void; onLeave: () => void }) {
  const [tz, setTz] = useState(store.settings.tz);
  const [doctor, setDoctor] = useState(store.settings.doctor);
  const [physio, setPhysio] = useState(store.settings.physio);
  const [rule, setRule] = useState<{ rec?: Rec<AlertRule> } | null>(null);
  const [pw1, setPw1] = useState('');
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmRotate, setConfirmRotate] = useState(false);
  const saver = useSaver(store, () => setMsg('Configurações salvas.'));

  const rotate = async () => {
    setMsg('');
    if (pw1.length < 8) { setMsg('Use uma senha com pelo menos 8 caracteres.'); return; }
    try {
      const n = await deriveSecret(pw1);
      await store.api.rotate(n);
      storeSecret(n);
      setDone(true); setConfirmRotate(false); setPw1('');
      onRotated(n);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Sheet title="Configurações" onClose={onClose} wide>
      <section className="dor-sect">
        <h3>Geral</h3>
        <Field label="Fuso horário"><select value={tz} onChange={(e) => setTz(e.target.value)}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></Field>
        <Field label="Médica responsável"><input value={doctor} onChange={(e) => setDoctor(e.target.value)} maxLength={80} /></Field>
        <Field label="Fisioterapeuta responsável"><input value={physio} onChange={(e) => setPhysio(e.target.value)} maxLength={80} /></Field>
        <button className="dor-btn primary" disabled={saver.busy} onClick={() => saver.submit('settings', { tz, doctor, physio }, null, store.settingsRec)}>{saver.busy ? 'Salvando…' : 'Salvar'}</button>
        {saver.node}
        {msg && <div className="dor-alert info" role="status">{msg}</div>}
      </section>

      <section className="dor-sect">
        <h3>Critérios de aviso sobre uso de medicamentos</h3>
        <p className="dor-muted dor-small">Os critérios devem ser definidos com a médica responsável: o sistema não traz nenhum limite pronto. Cada critério conta em quantos dias de uma janela houve medicamento de crise. O aviso é só informativo.</p>
        <ul className="dor-list">
          {store.alertRules.map((r) => (
            <li key={r.id}>
              <div><strong>{r.data.name}</strong><small>{r.data.scope === 'any_crisis_med' ? 'qualquer medicamento de crise' : store.meds.find((m) => m.id === r.data.medId)?.data.name ?? 'medicamento'} · {r.data.maxDays} ou mais dias em {r.data.windowDays} · {r.data.active ? 'ativo' : 'desativado'}</small></div>
              <button className="dor-btn small" onClick={() => setRule({ rec: r })}>Editar</button>
            </li>
          ))}
        </ul>
        <button className="dor-btn small" onClick={() => setRule({})}>+ Novo critério</button>
        {rule && <RuleForm store={store} rec={rule.rec} onClose={() => setRule(null)} />}
      </section>

      <section className="dor-sect">
        <h3>Lixeira (30 dias)</h3>
        {store.trash.length === 0 ? <p className="dor-muted">Vazia.</p> : (
          <ul className="dor-list">
            {store.trash.map((r) => (
              <li key={r.id}><div><strong>{describe(store, r)}</strong><small>excluído em {fmtDate(dayKey(new Date(r.deletedAt!).getTime(), store.settings.tz))}</small></div>
                <button className="dor-btn small" onClick={() => store.restore(r.id)}>Restaurar</button></li>
            ))}
          </ul>
        )}
      </section>

      <section className="dor-sect">
        <h3>Senha de acesso</h3>
        <p className="dor-muted dor-small">Quem sabe a senha vê e edita o diário. Ao trocar, a senha antiga para de valer em todos os aparelhos e eles pedem a nova.</p>
        {!confirmRotate && <button className="dor-btn" onClick={() => { setConfirmRotate(true); setDone(false); }}>Trocar senha</button>}
        {confirmRotate && <div className="dor-alert info"><Field label="Nova senha (mín. 8 caracteres)"><input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" /></Field><div className="dor-row"><button className="dor-btn" onClick={() => setConfirmRotate(false)}>Cancelar</button><button className="dor-btn primary" onClick={rotate}>Salvar nova senha</button></div></div>}
        {done && <div className="dor-alert info" role="status">Senha trocada.</div>}
        <button className="dor-btn small" onClick={onLeave}>Sair deste aparelho</button>
        <small className="dor-muted" hidden>{secret.length}</small>
      </section>

      <section className="dor-sect">
        <h3>Backup</h3>
        <p className="dor-muted dor-small">Baixa todos os registros e o histórico de versões num arquivo. O Supabase também mantém os backups do banco conforme o plano do projeto; confira lá a retenção.</p>
        <button className="dor-btn" onClick={async () => { try { download(`diario-de-dor-backup-${dayKey(Date.now(), store.settings.tz)}.json`, JSON.stringify(await store.api.exportAll(), null, 2), 'application/json'); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } }}>Baixar backup (JSON)</button>
      </section>

      <section className="dor-sect">
        <details className="dor-details"><summary>Como os números são calculados</summary>
          <ul className="dor-small">
            <li><strong>Dia com cefaleia:</strong> existe crise naquele dia (crise que passa da meia-noite conta em todos os dias). <strong>Sem cefaleia:</strong> só se você confirmar. Caso contrário, <strong>não informado</strong>.</li>
            <li><strong>Média simples:</strong> soma das intensidades registradas ÷ quantidade de avaliações. O que não foi registrado não vira zero.</li>
            <li><strong>Média por tempo (estimada):</strong> liga as avaliações em linha reta e pondera pelo tempo entre elas. Só entre a primeira e a última avaliação, e só quando elas cobrem ao menos 60% da crise; senão, não é calculada.</li>
            <li><strong>Crises sobrepostas</strong> não somam o tempo duas vezes. Cada administração de medicamento é um registro e entra uma vez nos totais.</li>
            <li><strong>Dias de uso</strong> de um medicamento contam uma vez por dia, mesmo com várias doses.</li>
          </ul>
        </details>
      </section>
    </Sheet>
  );
}

function RuleForm({ store, rec, onClose }: { store: DorStore; rec?: Rec<AlertRule>; onClose: () => void }) {
  const [name, setName] = useState(rec?.data.name ?? '');
  const [scope, setScope] = useState<AlertRule['scope']>(rec?.data.scope ?? 'any_crisis_med');
  const [medId, setMedId] = useState(rec?.data.medId ?? '');
  const [win, setWin] = useState(String(rec?.data.windowDays ?? ''));
  const [max, setMax] = useState(String(rec?.data.maxDays ?? ''));
  const [active, setActive] = useState(rec?.data.active ?? true);
  const [err, setErr] = useState('');
  const saver = useSaver(store, () => onClose());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const w = Number(win), m = Number(max);
    if (!name.trim() || !Number.isInteger(w) || !Number.isInteger(m) || w < 1 || w > 365 || m < 1 || m > w) { setErr('Informe um nome, a janela em dias (1 a 365) e a quantidade de dias de uso (de 1 até o tamanho da janela).'); return; }
    if (scope === 'med' && !medId) { setErr('Escolha o medicamento.'); return; }
    await saver.submit('alert_rule', { name: name.trim(), scope, medId: scope === 'med' ? medId : undefined, windowDays: w, maxDays: m, active } satisfies AlertRule, null, rec);
  };
  return (
    <form onSubmit={submit} className="dor-subform">
      <Field label="Nome do critério"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <Field label="Vale para"><select value={scope} onChange={(e) => setScope(e.target.value as AlertRule['scope'])}><option value="any_crisis_med">Qualquer medicamento de crise</option><option value="med">Um medicamento</option></select></Field>
      {scope === 'med' && <Field label="Medicamento"><select value={medId} onChange={(e) => setMedId(e.target.value)}><option value="">Escolher…</option>{store.meds.filter((m) => m.data.category === 'crisis').map((m) => <option key={m.id} value={m.id}>{m.data.name}</option>)}</select></Field>}
      <div className="dor-row"><Field label="Janela (dias)"><input value={win} onChange={(e) => setWin(e.target.value)} inputMode="numeric" /></Field><Field label="Avisar a partir de (dias de uso)"><input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" /></Field></div>
      <label className="dor-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
      {err && <div className="dor-alert err" role="alert">{err}</div>}
      {saver.node}
      <div className="dor-actions"><button type="button" className="dor-btn" onClick={onClose}>Cancelar</button><button type="submit" className="dor-btn primary" disabled={saver.busy}>Salvar critério</button></div>
    </form>
  );
}
