// pristonzone.com/balance: class balance tests. No link on the site (whoever gets the address can read and change the data, no login),
// kept out of search engines. Add tests (class, mobs killed, time, who tested, where...) and the report at the top ranks the classes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NO_FILTERS, buildReport, distinct, filterTests, fmtPct, fmtRate, formatDuration, parseDuration, testRate,
  type BalanceTest, type Filters,
} from '../../lib/balance';
import { deleteBalance, fetchBalance, saveBalance } from '../../lib/balanceApi';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { getSkillClass } from '../../lib/skilltree/classes';
import { CLASS_SLUGS, type ClassSlug } from '../../lib/skilltree/types';
import { Loading } from '../Loading';

const NAME_KEY = 'pz-balance-tester';
const POLL_MS = 25000;
const className = (c: ClassSlug) => getSkillClass(c).name;
const icon = (c: ClassSlug) => `/skilltree/classes/${c}.png`;
const today = () => new Date().toISOString().slice(0, 10);

function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);
}

const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const saveName = (v: string) => { try { localStorage.setItem(NAME_KEY, v); } catch { /* ignore */ } };

interface Form { tester: string; cls: ClassSlug | ''; mobs: string; time: string; place: string; level: string; on: string; notes: string }
const emptyForm = (): Form => ({ tester: readName(), cls: '', mobs: '', time: '', place: '', level: '', on: today(), notes: '' });

function ClassTag({ cls }: { cls: ClassSlug }) {
  return <span className="bal-class"><img src={icon(cls)} alt="" width={22} height={22} /> {className(cls)}</span>;
}

// ---------- report ----------
function Report({ tests, all, filters, onFilters }: { tests: BalanceTest[]; all: BalanceTest[]; filters: Filters; onFilters: (f: Filters) => void }) {
  const r = useMemo(() => buildReport(tests, CLASS_SLUGS), [tests]);
  const places = useMemo(() => distinct(all.map((t) => t.place)), [all]);
  const testers = useMemo(() => distinct(all.map((t) => t.tester)), [all]);
  const dirty = filters.place || filters.tester || filters.minLevel !== null || filters.maxLevel !== null;
  const top = r.strongest?.rate ?? 1;
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))) || null);

  return (
    <section className="sr-card bal-report">
      <h2 className="mk-h2">📊 Relatório</h2>
      <div className="bal-filters">
        <label className="af-field"><span className="af-label">Mapa</span>
          <select value={filters.place} onChange={(e) => onFilters({ ...filters, place: e.target.value })}>
            <option value="">Todos</option>{places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="af-field"><span className="af-label">Quem testou</span>
          <select value={filters.tester} onChange={(e) => onFilters({ ...filters, tester: e.target.value })}>
            <option value="">Todos</option>{testers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="af-field bal-narrow"><span className="af-label">Nível de</span>
          <input inputMode="numeric" value={filters.minLevel ?? ''} placeholder="mín." onChange={(e) => onFilters({ ...filters, minLevel: num(e.target.value) })} /></label>
        <label className="af-field bal-narrow"><span className="af-label">até</span>
          <input inputMode="numeric" value={filters.maxLevel ?? ''} placeholder="máx." onChange={(e) => onFilters({ ...filters, maxLevel: num(e.target.value) })} /></label>
        {dirty && <button type="button" className="mk-btn sm" onClick={() => onFilters(NO_FILTERS)}>Limpar filtros</button>}
      </div>

      {r.ranking.length === 0 ? (
        <p className="mk-muted">{all.length === 0 ? 'Ainda não há testes. Adicione o primeiro abaixo e o relatório aparece aqui.' : 'Nenhum teste com esses filtros.'}</p>
      ) : (
        <>
          <p className="bal-summary">
            {r.ranking.length === 1 ? (
              <>Só a classe <b>{className(r.ranking[0].cls)}</b> tem testes ({fmtRate(r.ranking[0].rate)} mobs/min). Adicione outras classes para comparar.</>
            ) : (
              <>
                🏆 <b>Mais forte:</b> {className(r.strongest!.cls)} ({fmtRate(r.strongest!.rate)} mobs/min, {fmtPct(r.strongest!.vsAverage)} da média).{' '}
                🐢 <b>Mais fraca:</b> {className(r.weakest!.cls)} ({fmtRate(r.weakest!.rate)} mobs/min, {fmtPct(r.weakest!.vsAverage)} da média).{' '}
                A mais forte mata <b>{fmtRate(r.spread!)}×</b> mais rápido que a mais fraca. Média das classes: {fmtRate(r.average)} mobs/min.
              </>
            )}
          </p>
          {(r.mixedPlaces || r.mixedLevels) && (
            <p className="mk-note">⚠ Há testes de {r.mixedPlaces ? 'mapas diferentes' : 'níveis diferentes'} misturados. Para comparar de forma justa, filtre por {r.mixedPlaces ? 'um mapa' : 'uma faixa de nível'}.</p>
          )}
          <ol className="bal-rank">
            {r.ranking.map((c, i) => (
              <li key={c.cls} className={i === 0 && r.ranking.length > 1 ? 'top' : i === r.ranking.length - 1 && r.ranking.length > 1 ? 'low' : ''}>
                <span className="bal-pos">{i + 1}º</span>
                <ClassTag cls={c.cls} />
                <span className="bal-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (c.rate / top) * 100)}%` }} /></span>
                <b className="bal-rate">{fmtRate(c.rate)}<small> mobs/min</small></b>
                <span className={`bal-vs ${c.vsAverage >= 0 ? 'up' : 'down'}`}>{r.ranking.length > 1 ? fmtPct(c.vsAverage) : '—'}</span>
                <small className="bal-meta">
                  {c.tests} {c.tests === 1 ? 'teste' : 'testes'} · {c.testers} {c.testers === 1 ? 'testador' : 'testadores'} · {c.mobs.toLocaleString('pt-BR')} mobs em {formatDuration(c.seconds)}
                  {c.tests > 1 && <> · melhor {fmtRate(c.best)} / pior {fmtRate(c.worst)}</>}
                  {c.tests < 3 && <span className="bal-few"> · poucos testes</span>}
                </small>
              </li>
            ))}
          </ol>
          {r.untested.length > 0 && <p className="mk-muted bal-untested">Sem testes: {r.untested.map(className).join(', ')}.</p>}
          <p className="mk-muted bal-note">A velocidade de cada classe é o total de mobs mortos dividido pelo total de minutos de todos os testes dela (teste longo pesa mais). “% da média” compara com a média das classes que têm testes.</p>
        </>
      )}
    </section>
  );
}

// ---------- form ----------
function TestForm({ editing, places, onSaved, onCancel }: { editing: BalanceTest | null; places: string[]; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (editing) {
      setF({ tester: editing.tester, cls: editing.cls, mobs: String(editing.mobs), time: formatDuration(editing.seconds), place: editing.place, level: editing.level === null ? '' : String(editing.level), on: editing.testedOn, notes: editing.notes });
      setErr(''); setOk('');
    }
  }, [editing]);

  const set = (p: Partial<Form>) => setF((cur) => ({ ...cur, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk('');
    const mobs = Number(f.mobs);
    const seconds = parseDuration(f.time);
    if (!f.tester.trim()) return setErr('Informe o nome de quem testou.');
    if (!f.cls) return setErr('Escolha a classe.');
    if (!Number.isInteger(mobs) || mobs < 1) return setErr('Informe a quantidade de mobs mortos (um número inteiro).');
    if (seconds === null) return setErr('Informe o tempo no formato mm:ss (ex.: 12:30) ou só os minutos (ex.: 12,5).');
    const level = f.level.trim() === '' ? null : Number(f.level);
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 300)) return setErr('O nível precisa ser um número de 1 a 300.');
    setBusy(true);
    try {
      await saveBalance(editing?.id ?? null, { cls: f.cls, mobs, seconds, tester: f.tester.trim(), level, place: f.place.trim(), notes: f.notes.trim(), testedOn: f.on || today() });
      saveName(f.tester.trim());
      if (editing) { onSaved(); setF(emptyForm()); onCancel(); setOk('Alterações salvas.'); }
      else { setOk('Teste adicionado!'); set({ mobs: '', time: '', notes: '' }); onSaved(); }
    } catch (x) {
      setErr(x instanceof Error ? x.message : String((x as { message?: string })?.message ?? x));
    } finally { setBusy(false); }
  };

  return (
    <section className="sr-card bal-form" id="bal-form">
      <h2 className="mk-h2">{editing ? '✏️ Editar teste' : '➕ Adicionar teste'}</h2>
      <form onSubmit={submit}>
        <div className="af-field">
          <span className="af-label">Classe</span>
          <div className="af-chips" role="group" aria-label="Classe">
            {CLASS_SLUGS.map((c) => (
              <button key={c} type="button" className={`af-chip${f.cls === c ? ' on' : ''}`} aria-pressed={f.cls === c} onClick={() => set({ cls: c })}>
                <img src={icon(c)} alt="" width={20} height={20} /> {className(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="bal-grid">
          <label className="af-field"><span className="af-label">Quem testou</span>
            <input value={f.tester} maxLength={40} onChange={(e) => set({ tester: e.target.value })} placeholder="Seu nome" autoComplete="nickname" /></label>
          <label className="af-field"><span className="af-label">Mobs mortos</span>
            <input inputMode="numeric" value={f.mobs} onChange={(e) => set({ mobs: e.target.value.replace(/\D/g, '') })} placeholder="ex.: 120" /></label>
          <label className="af-field"><span className="af-label">Tempo (mm:ss)</span>
            <input value={f.time} onChange={(e) => set({ time: e.target.value })} placeholder="ex.: 12:30" /></label>
          <label className="af-field"><span className="af-label">Mapa / mob (opcional)</span>
            <input list="bal-places" value={f.place} maxLength={80} onChange={(e) => set({ place: e.target.value })} placeholder="ex.: Oasis" />
            <datalist id="bal-places">{places.map((p) => <option key={p} value={p} />)}</datalist></label>
          <label className="af-field"><span className="af-label">Nível do personagem (opcional)</span>
            <input inputMode="numeric" value={f.level} onChange={(e) => set({ level: e.target.value.replace(/\D/g, '') })} placeholder="ex.: 120" /></label>
          <label className="af-field"><span className="af-label">Data do teste</span>
            <input type="date" value={f.on} onChange={(e) => set({ on: e.target.value })} /></label>
        </div>
        <label className="af-field"><span className="af-label">Observações (opcional)</span>
          <textarea rows={2} maxLength={500} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Build, buffs, equipamentos, party ou qualquer detalhe do teste" /></label>
        {err && <p className="mk-warn" role="alert">{err}</p>}
        {ok && <p className="bal-ok" role="status">{ok}</p>}
        <div className="bal-actions">
          <button type="submit" className="mk-btn primary" disabled={busy}>{busy ? '⏳' : editing ? 'Salvar alterações' : 'Adicionar teste'}</button>
          {editing && <button type="button" className="mk-btn" onClick={() => { onCancel(); setF(emptyForm()); }}>Cancelar</button>}
        </div>
      </form>
    </section>
  );
}

// ---------- list ----------
function TestList({ tests, onEdit, onChanged }: { tests: BalanceTest[]; onEdit: (t: BalanceTest) => void; onChanged: () => void }) {
  const [cls, setCls] = useState<ClassSlug | ''>('');
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const shown = cls ? tests.filter((t) => t.cls === cls) : tests;

  const remove = async (id: string) => {
    setErr('');
    try { await deleteBalance(id); setAsk(null); onChanged(); } catch (x) { setErr(x instanceof Error ? x.message : String((x as { message?: string })?.message ?? x)); }
  };

  return (
    <section className="sr-card bal-list">
      <h2 className="mk-h2">🗒️ Testes registrados <small className="mk-muted">({shown.length})</small></h2>
      <div className="af-chips" role="group" aria-label="Filtrar a lista por classe">
        <button type="button" className={`af-chip${cls === '' ? ' on' : ''}`} onClick={() => setCls('')}>Todas</button>
        {CLASS_SLUGS.map((c) => <button key={c} type="button" className={`af-chip${cls === c ? ' on' : ''}`} onClick={() => setCls(c)}><img src={icon(c)} alt="" width={18} height={18} /> {className(c)}</button>)}
      </div>
      {err && <p className="mk-warn" role="alert">{err}</p>}
      {shown.length === 0 ? <p className="mk-muted">Nenhum teste aqui.</p> : (
        <div className="bal-table-wrap">
          <table className="af-table bal-table">
            <thead><tr><th>Data</th><th>Classe</th><th>Mobs</th><th>Tempo</th><th>Mobs/min</th><th>Quem testou</th><th>Mapa</th><th>Nível</th><th /></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>{t.testedOn.split('-').reverse().join('/')}</td>
                  <td><ClassTag cls={t.cls} /></td>
                  <td>{t.mobs.toLocaleString('pt-BR')}</td>
                  <td>{formatDuration(t.seconds)}</td>
                  <td><b>{fmtRate(testRate(t))}</b></td>
                  <td>{t.tester}</td>
                  <td>{t.place || '—'}{t.notes && <small className="bal-notes" title={t.notes}>📝 {t.notes}</small>}</td>
                  <td>{t.level ?? '—'}</td>
                  <td className="bal-row-actions">
                    {ask === t.id ? (
                      <>
                        <span className="mk-warn">Apagar?</span>{' '}
                        <button type="button" className="mk-btn sm danger" onClick={() => remove(t.id)}>Sim</button>{' '}
                        <button type="button" className="mk-btn sm" onClick={() => setAsk(null)}>Não</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="mk-btn sm" onClick={() => onEdit(t)}>Editar</button>{' '}
                        <button type="button" className="mk-btn sm danger" onClick={() => setAsk(t.id)}>Apagar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function BalancePage() {
  useNoIndex();
  const [tests, setTests] = useState<BalanceTest[] | null>(null);
  const [err, setErr] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<BalanceTest | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!BACKEND_ENABLED) { setErr('Sem conexão com o banco neste ambiente.'); return; }
    try { const r = await fetchBalance(); if (alive.current) { setTests(r); setErr(''); } }
    catch (e) {
      if (!alive.current) return;
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setErr(/balance_|schema cache|function/i.test(m) ? 'A página ainda não está ativa: falta rodar o arquivo supabase/46_balance.sql no Supabase.' : m);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const id = window.setInterval(() => { void load(); }, POLL_MS); // so changes from other people show up
    return () => { alive.current = false; window.clearInterval(id); };
  }, [load]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Balanceamento de classes — PristonZONE';
    return () => { document.title = prev; };
  }, []);

  const all = tests ?? [];
  const filtered = useMemo(() => filterTests(all, filters), [all, filters]);
  const places = useMemo(() => distinct(all.map((t) => t.place)), [all]);

  const edit = (t: BalanceTest) => { setEditing(t); window.setTimeout(() => document.getElementById('bal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  return (
    <div className="mk bal">
      <h1 className="mk-h1">⚖️ Balanceamento de classes</h1>
      <p className="mk-muted">Anote quantos mobs cada classe matou e em quanto tempo. O relatório abaixo mostra sozinho quem está mais forte e quem está mais fraca. Quem tem este link pode adicionar, editar e apagar testes; cada teste guarda o nome de quem testou.</p>

      {err && <p className="mk-warn" role="alert">{err}</p>}
      {!tests && !err && <Loading />}
      {tests && (
        <>
          <Report tests={filtered} all={all} filters={filters} onFilters={setFilters} />
          <TestForm editing={editing} places={places} onSaved={() => void load()} onCancel={() => setEditing(null)} />
          <TestList tests={filtered} onEdit={edit} onChanged={() => void load()} />
        </>
      )}
    </div>
  );
}
