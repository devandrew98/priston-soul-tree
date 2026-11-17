// pristonzone.com/balance: class balance tests. No link on the site (whoever gets the address can read and change the data, no login),
// kept out of search engines. Add tests (class, mobs killed, time, who tested, where...) and the report at the top ranks the classes.
// Follows the site language (the flags in the top bar): Portuguese or English.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NO_FILTERS, buildReport, distinct, filterTests, fmtPct, fmtRate, formatDuration, parseDuration, testRate,
  type BalanceTest, type Filters,
} from '../../lib/balance';
import { deleteBalance, fetchBalance, saveBalance } from '../../lib/balanceApi';
import { useI18n } from '../../lib/i18n';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { getSkillClass } from '../../lib/skilltree/classes';
import { CLASS_SLUGS, type ClassSlug } from '../../lib/skilltree/types';
import { Loading } from '../Loading';

type Lang = 'pt' | 'en';
type L = { pt: string; en: string };

const TXT = {
  title: { pt: 'Balanceamento de classes', en: 'Class balance' },
  docTitle: { pt: 'Balanceamento de classes — PristonZONE', en: 'Class balance — PristonZONE' },
  intro: {
    pt: 'Anote quantos mobs cada classe matou e em quanto tempo. O relatório abaixo mostra sozinho quem está mais forte e quem está mais fraca. Quem tem este link pode adicionar, editar e apagar testes; cada teste guarda o nome de quem testou.',
    en: 'Note how many mobs each class killed and in how much time. The report below shows by itself which class is the strongest and which is the weakest. Anyone with this link can add, edit and delete tests; each test keeps the name of who tested it.',
  },
  noBackend: { pt: 'Sem conexão com o banco neste ambiente.', en: 'No database connection in this environment.' },
  notReady: { pt: 'A página ainda não está ativa: falta rodar o arquivo supabase/46_balance.sql no Supabase.', en: 'The page is not active yet: supabase/46_balance.sql still has to be run in Supabase.' },
  report: { pt: 'Relatório', en: 'Report' },
  map: { pt: 'Mapa', en: 'Map' },
  testedBy: { pt: 'Quem testou', en: 'Tested by' },
  levelFrom: { pt: 'Nível de', en: 'Level from' },
  levelTo: { pt: 'até', en: 'to' },
  min: { pt: 'mín.', en: 'min.' },
  max: { pt: 'máx.', en: 'max.' },
  all: { pt: 'Todos', en: 'All' },
  allF: { pt: 'Todas', en: 'All' },
  clearFilters: { pt: 'Limpar filtros', en: 'Clear filters' },
  noTestsYet: { pt: 'Ainda não há testes. Adicione o primeiro abaixo e o relatório aparece aqui.', en: 'There are no tests yet. Add the first one below and the report appears here.' },
  noMatch: { pt: 'Nenhum teste com esses filtros.', en: 'No test matches these filters.' },
  onlyOne1: { pt: 'Só a classe', en: 'Only the class' },
  onlyOne2: { pt: 'tem testes', en: 'has tests' },
  onlyOne3: { pt: 'Adicione outras classes para comparar.', en: 'Add other classes to compare.' },
  strongest: { pt: 'Mais forte:', en: 'Strongest:' },
  weakest: { pt: 'Mais fraca:', en: 'Weakest:' },
  ofAverage: { pt: 'da média', en: 'vs the average' },
  fasterPre: { pt: 'A mais forte mata', en: 'The strongest kills' },
  fasterPost: { pt: 'mais rápido que a mais fraca.', en: 'faster than the weakest.' },
  avgOfClasses: { pt: 'Média das classes:', en: 'Average of the classes:' },
  mobsMin: { pt: 'mobs/min', en: 'mobs/min' },
  mixedPlaces: { pt: 'mapas diferentes', en: 'different maps' },
  mixedLevels: { pt: 'níveis diferentes', en: 'different levels' },
  mixedWarn: { pt: '⚠ Há testes de {x} misturados. Para comparar de forma justa, filtre por {y}.', en: '⚠ The selection mixes tests from {x}. To compare fairly, filter by {y}.' },
  oneMap: { pt: 'um mapa', en: 'one map' },
  oneLevelRange: { pt: 'uma faixa de nível', en: 'a level range' },
  test1: { pt: 'teste', en: 'test' },
  tests: { pt: 'testes', en: 'tests' },
  tester1: { pt: 'testador', en: 'tester' },
  testers: { pt: 'testadores', en: 'testers' },
  mobsIn: { pt: 'mobs em', en: 'mobs in' },
  best: { pt: 'melhor', en: 'best' },
  worst: { pt: 'pior', en: 'worst' },
  few: { pt: 'poucos testes', en: 'few tests' },
  noTests: { pt: 'Sem testes:', en: 'No tests:' },
  method: {
    pt: 'A velocidade de cada classe é o total de mobs mortos dividido pelo total de minutos de todos os testes dela (teste longo pesa mais). “% da média” compara com a média das classes que têm testes.',
    en: 'Each class speed is the total mobs killed divided by the total minutes of all its tests (a long test weighs more). “vs the average” compares with the average of the classes that have tests.',
  },
  addTest: { pt: 'Adicionar teste', en: 'Add test' },
  editTest: { pt: 'Editar teste', en: 'Edit test' },
  cls: { pt: 'Classe', en: 'Class' },
  yourName: { pt: 'Seu nome', en: 'Your name' },
  mobsKilled: { pt: 'Mobs mortos', en: 'Mobs killed' },
  time: { pt: 'Tempo (mm:ss)', en: 'Time (mm:ss)' },
  mapOpt: { pt: 'Mapa / mob (opcional)', en: 'Map / mob (optional)' },
  levelOpt: { pt: 'Nível do personagem (opcional)', en: 'Character level (optional)' },
  testDate: { pt: 'Data do teste', en: 'Test date' },
  notesOpt: { pt: 'Observações (opcional)', en: 'Notes (optional)' },
  notesPh: { pt: 'Build, buffs, equipamentos, party ou qualquer detalhe do teste', en: 'Build, buffs, equipment, party or any detail of the test' },
  saveChanges: { pt: 'Salvar alterações', en: 'Save changes' },
  cancel: { pt: 'Cancelar', en: 'Cancel' },
  vTester: { pt: 'Informe o nome de quem testou.', en: 'Enter the name of who tested.' },
  vClass: { pt: 'Escolha a classe.', en: 'Pick the class.' },
  vMobs: { pt: 'Informe a quantidade de mobs mortos (um número inteiro).', en: 'Enter how many mobs were killed (a whole number).' },
  vTime: { pt: 'Informe o tempo no formato mm:ss (ex.: 12:30) ou só os minutos (ex.: 12,5).', en: 'Enter the time as mm:ss (e.g. 12:30) or just the minutes (e.g. 12.5).' },
  vLevel: { pt: 'O nível precisa ser um número de 1 a 300.', en: 'The level must be a number from 1 to 300.' },
  added: { pt: 'Teste adicionado!', en: 'Test added!' },
  savedOk: { pt: 'Alterações salvas.', en: 'Changes saved.' },
  recorded: { pt: 'Testes registrados', en: 'Recorded tests' },
  filterByClass: { pt: 'Filtrar a lista por classe', en: 'Filter the list by class' },
  noneHere: { pt: 'Nenhum teste aqui.', en: 'No tests here.' },
  thDate: { pt: 'Data', en: 'Date' },
  thMobs: { pt: 'Mobs', en: 'Mobs' },
  thTime: { pt: 'Tempo', en: 'Time' },
  thLevel: { pt: 'Nível', en: 'Level' },
  edit: { pt: 'Editar', en: 'Edit' },
  del: { pt: 'Apagar', en: 'Delete' },
  delAsk: { pt: 'Apagar?', en: 'Delete?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
} as const satisfies Record<string, L>;

/** Messages the database raises (in Portuguese) shown in the visitor's language. */
const DB_ERRORS: [RegExp, L][] = [
  [/classe inválida/i, { pt: 'Classe inválida.', en: 'Invalid class.' }],
  [/quantidade de mobs inválida/i, { pt: 'Quantidade de mobs inválida.', en: 'Invalid number of mobs.' }],
  [/tempo inválido/i, { pt: 'Tempo inválido.', en: 'Invalid time.' }],
  [/informe o nome de quem testou/i, { pt: 'Informe o nome de quem testou (até 40 letras).', en: 'Enter the name of who tested (up to 40 characters).' }],
  [/nível inválido/i, { pt: 'Nível inválido.', en: 'Invalid level.' }],
  [/texto muito longo/i, { pt: 'Texto muito longo.', en: 'Text too long.' }],
  [/data inválida/i, { pt: 'Data inválida.', en: 'Invalid date.' }],
  [/muitos registros/i, { pt: 'Muitos registros ao mesmo tempo, tente de novo em instantes.', en: 'Too many records at once, try again in a moment.' }],
  [/teste não encontrado/i, { pt: 'Teste não encontrado (talvez já tenha sido apagado).', en: 'Test not found (it may have been deleted already).' }],
];

const NAME_KEY = 'pz-balance-tester';
const POLL_MS = 25000;
const className = (c: ClassSlug) => getSkillClass(c).name;
const icon = (c: ClassSlug) => `/skilltree/classes/${c}.png`;
const today = () => new Date().toISOString().slice(0, 10);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

const fmtDate = (iso: string, lang: Lang) => (lang === 'pt'
  ? iso.split('-').reverse().join('/')
  : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)));

function errText(e: unknown, lang: Lang): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const hit = DB_ERRORS.find(([re]) => re.test(m));
  return hit ? hit[1][lang] : m;
}

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
function Report({ tests, all, filters, onFilters, lang }: { tests: BalanceTest[]; all: BalanceTest[]; filters: Filters; onFilters: (f: Filters) => void; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const rate = (n: number) => fmtRate(n, lang);
  const r = useMemo(() => buildReport(tests, CLASS_SLUGS), [tests]);
  const places = useMemo(() => distinct(all.map((t) => t.place)), [all]);
  const testers = useMemo(() => distinct(all.map((t) => t.tester)), [all]);
  const dirty = filters.place || filters.tester || filters.minLevel !== null || filters.maxLevel !== null;
  const top = r.strongest?.rate ?? 1;
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))) || null);

  return (
    <section className="sr-card bal-report">
      <h2 className="mk-h2">📊 {T('report')}</h2>
      <div className="bal-filters">
        <label className="af-field"><span className="af-label">{T('map')}</span>
          <select value={filters.place} onChange={(e) => onFilters({ ...filters, place: e.target.value })}>
            <option value="">{T('all')}</option>{places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="af-field"><span className="af-label">{T('testedBy')}</span>
          <select value={filters.tester} onChange={(e) => onFilters({ ...filters, tester: e.target.value })}>
            <option value="">{T('all')}</option>{testers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label className="af-field bal-narrow"><span className="af-label">{T('levelFrom')}</span>
          <input inputMode="numeric" value={filters.minLevel ?? ''} placeholder={T('min')} onChange={(e) => onFilters({ ...filters, minLevel: num(e.target.value) })} /></label>
        <label className="af-field bal-narrow"><span className="af-label">{T('levelTo')}</span>
          <input inputMode="numeric" value={filters.maxLevel ?? ''} placeholder={T('max')} onChange={(e) => onFilters({ ...filters, maxLevel: num(e.target.value) })} /></label>
        {dirty && <button type="button" className="mk-btn sm" onClick={() => onFilters(NO_FILTERS)}>{T('clearFilters')}</button>}
      </div>

      {r.ranking.length === 0 ? (
        <p className="mk-muted">{all.length === 0 ? T('noTestsYet') : T('noMatch')}</p>
      ) : (
        <>
          <p className="bal-summary">
            {r.ranking.length === 1 ? (
              <>{T('onlyOne1')} <b>{className(r.ranking[0].cls)}</b> {T('onlyOne2')} ({rate(r.ranking[0].rate)} {T('mobsMin')}). {T('onlyOne3')}</>
            ) : (
              <>
                🏆 <b>{T('strongest')}</b> {className(r.strongest!.cls)} ({rate(r.strongest!.rate)} {T('mobsMin')}, {fmtPct(r.strongest!.vsAverage)} {T('ofAverage')}).{' '}
                🐢 <b>{T('weakest')}</b> {className(r.weakest!.cls)} ({rate(r.weakest!.rate)} {T('mobsMin')}, {fmtPct(r.weakest!.vsAverage)} {T('ofAverage')}).{' '}
                {T('fasterPre')} <b>{rate(r.spread!)}×</b> {T('fasterPost')} {T('avgOfClasses')} {rate(r.average)} {T('mobsMin')}.
              </>
            )}
          </p>
          {(r.mixedPlaces || r.mixedLevels) && (
            <p className="mk-note">{fill(T('mixedWarn'), { x: r.mixedPlaces ? T('mixedPlaces') : T('mixedLevels'), y: r.mixedPlaces ? T('oneMap') : T('oneLevelRange') })}</p>
          )}
          <ol className="bal-rank">
            {r.ranking.map((c, i) => (
              <li key={c.cls} className={i === 0 && r.ranking.length > 1 ? 'top' : i === r.ranking.length - 1 && r.ranking.length > 1 ? 'low' : ''}>
                <span className="bal-pos">{lang === 'pt' ? `${i + 1}º` : `#${i + 1}`}</span>
                <ClassTag cls={c.cls} />
                <span className="bal-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (c.rate / top) * 100)}%` }} /></span>
                <b className="bal-rate">{rate(c.rate)}<small> {T('mobsMin')}</small></b>
                <span className={`bal-vs ${c.vsAverage >= 0 ? 'up' : 'down'}`}>{r.ranking.length > 1 ? fmtPct(c.vsAverage) : '—'}</span>
                <small className="bal-meta">
                  {c.tests} {c.tests === 1 ? T('test1') : T('tests')} · {c.testers} {c.testers === 1 ? T('tester1') : T('testers')} · {c.mobs.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')} {T('mobsIn')} {formatDuration(c.seconds)}
                  {c.tests > 1 && <> · {T('best')} {rate(c.best)} / {T('worst')} {rate(c.worst)}</>}
                  {c.tests < 3 && <span className="bal-few"> · {T('few')}</span>}
                </small>
              </li>
            ))}
          </ol>
          {r.untested.length > 0 && <p className="mk-muted bal-untested">{T('noTests')} {r.untested.map(className).join(', ')}.</p>}
          <p className="mk-muted bal-note">{T('method')}</p>
        </>
      )}
    </section>
  );
}

// ---------- form ----------
function TestForm({ editing, places, onSaved, onCancel, lang }: { editing: BalanceTest | null; places: string[]; onSaved: () => void; onCancel: () => void; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
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
    if (!f.tester.trim()) return setErr(T('vTester'));
    if (!f.cls) return setErr(T('vClass'));
    if (!Number.isInteger(mobs) || mobs < 1) return setErr(T('vMobs'));
    if (seconds === null) return setErr(T('vTime'));
    const level = f.level.trim() === '' ? null : Number(f.level);
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 300)) return setErr(T('vLevel'));
    setBusy(true);
    try {
      await saveBalance(editing?.id ?? null, { cls: f.cls, mobs, seconds, tester: f.tester.trim(), level, place: f.place.trim(), notes: f.notes.trim(), testedOn: f.on || today() });
      saveName(f.tester.trim());
      if (editing) { onSaved(); setF(emptyForm()); onCancel(); setOk(T('savedOk')); }
      else { setOk(T('added')); set({ mobs: '', time: '', notes: '' }); onSaved(); }
    } catch (x) {
      setErr(errText(x, lang));
    } finally { setBusy(false); }
  };

  return (
    <section className="sr-card bal-form" id="bal-form">
      <h2 className="mk-h2">{editing ? `✏️ ${T('editTest')}` : `➕ ${T('addTest')}`}</h2>
      <form onSubmit={submit}>
        <div className="af-field">
          <span className="af-label">{T('cls')}</span>
          <div className="af-chips" role="group" aria-label={T('cls')}>
            {CLASS_SLUGS.map((c) => (
              <button key={c} type="button" className={`af-chip${f.cls === c ? ' on' : ''}`} aria-pressed={f.cls === c} onClick={() => set({ cls: c })}>
                <img src={icon(c)} alt="" width={20} height={20} /> {className(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="bal-grid">
          <label className="af-field"><span className="af-label">{T('testedBy')}</span>
            <input value={f.tester} maxLength={40} onChange={(e) => set({ tester: e.target.value })} placeholder={T('yourName')} autoComplete="nickname" /></label>
          <label className="af-field"><span className="af-label">{T('mobsKilled')}</span>
            <input inputMode="numeric" value={f.mobs} onChange={(e) => set({ mobs: e.target.value.replace(/\D/g, '') })} placeholder="120" /></label>
          <label className="af-field"><span className="af-label">{T('time')}</span>
            <input value={f.time} onChange={(e) => set({ time: e.target.value })} placeholder="12:30" /></label>
          <label className="af-field"><span className="af-label">{T('mapOpt')}</span>
            <input list="bal-places" value={f.place} maxLength={80} onChange={(e) => set({ place: e.target.value })} placeholder="Oasis" />
            <datalist id="bal-places">{places.map((p) => <option key={p} value={p} />)}</datalist></label>
          <label className="af-field"><span className="af-label">{T('levelOpt')}</span>
            <input inputMode="numeric" value={f.level} onChange={(e) => set({ level: e.target.value.replace(/\D/g, '') })} placeholder="120" /></label>
          <label className="af-field"><span className="af-label">{T('testDate')}</span>
            <input type="date" value={f.on} onChange={(e) => set({ on: e.target.value })} /></label>
        </div>
        <label className="af-field"><span className="af-label">{T('notesOpt')}</span>
          <textarea rows={2} maxLength={500} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={T('notesPh')} /></label>
        {err && <p className="mk-warn" role="alert">{err}</p>}
        {ok && <p className="bal-ok" role="status">{ok}</p>}
        <div className="bal-actions">
          <button type="submit" className="mk-btn primary" disabled={busy}>{busy ? '⏳' : editing ? T('saveChanges') : T('addTest')}</button>
          {editing && <button type="button" className="mk-btn" onClick={() => { onCancel(); setF(emptyForm()); }}>{T('cancel')}</button>}
        </div>
      </form>
    </section>
  );
}

// ---------- list ----------
function TestList({ tests, onEdit, onChanged, lang }: { tests: BalanceTest[]; onEdit: (t: BalanceTest) => void; onChanged: () => void; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [cls, setCls] = useState<ClassSlug | ''>('');
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const shown = cls ? tests.filter((t) => t.cls === cls) : tests;

  const remove = async (id: string) => {
    setErr('');
    try { await deleteBalance(id); setAsk(null); onChanged(); } catch (x) { setErr(errText(x, lang)); }
  };

  return (
    <section className="sr-card bal-list">
      <h2 className="mk-h2">🗒️ {T('recorded')} <small className="mk-muted">({shown.length})</small></h2>
      <div className="af-chips" role="group" aria-label={T('filterByClass')}>
        <button type="button" className={`af-chip${cls === '' ? ' on' : ''}`} onClick={() => setCls('')}>{T('allF')}</button>
        {CLASS_SLUGS.map((c) => <button key={c} type="button" className={`af-chip${cls === c ? ' on' : ''}`} onClick={() => setCls(c)}><img src={icon(c)} alt="" width={18} height={18} /> {className(c)}</button>)}
      </div>
      {err && <p className="mk-warn" role="alert">{err}</p>}
      {shown.length === 0 ? <p className="mk-muted">{T('noneHere')}</p> : (
        <div className="bal-table-wrap">
          <table className="af-table bal-table">
            <thead><tr><th>{T('thDate')}</th><th>{T('cls')}</th><th>{T('thMobs')}</th><th>{T('thTime')}</th><th>{T('mobsMin')}</th><th>{T('testedBy')}</th><th>{T('map')}</th><th>{T('thLevel')}</th><th /></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.testedOn, lang)}</td>
                  <td><ClassTag cls={t.cls} /></td>
                  <td>{t.mobs.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</td>
                  <td>{formatDuration(t.seconds)}</td>
                  <td><b>{fmtRate(testRate(t), lang)}</b></td>
                  <td>{t.tester}</td>
                  <td>{t.place || '—'}{t.notes && <small className="bal-notes" title={t.notes}>📝 {t.notes}</small>}</td>
                  <td>{t.level ?? '—'}</td>
                  <td className="bal-row-actions">
                    {ask === t.id ? (
                      <>
                        <span className="mk-warn">{T('delAsk')}</span>{' '}
                        <button type="button" className="mk-btn sm danger" onClick={() => remove(t.id)}>{T('yes')}</button>{' '}
                        <button type="button" className="mk-btn sm" onClick={() => setAsk(null)}>{T('no')}</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="mk-btn sm" onClick={() => onEdit(t)}>{T('edit')}</button>{' '}
                        <button type="button" className="mk-btn sm danger" onClick={() => setAsk(t.id)}>{T('del')}</button>
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
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [tests, setTests] = useState<BalanceTest[] | null>(null);
  const [err, setErr] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [editing, setEditing] = useState<BalanceTest | null>(null);
  const alive = useRef(true);
  const langRef = useRef(lang);
  langRef.current = lang;

  const load = useCallback(async () => {
    if (!BACKEND_ENABLED) { setErr(TXT.noBackend[langRef.current]); return; }
    try { const r = await fetchBalance(); if (alive.current) { setTests(r); setErr(''); } }
    catch (e) {
      if (!alive.current) return;
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setErr(/balance_|schema cache|function/i.test(m) ? TXT.notReady[langRef.current] : m);
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
    document.title = TXT.docTitle[lang];
    return () => { document.title = prev; };
  }, [lang]);

  const all = tests ?? [];
  const filtered = useMemo(() => filterTests(all, filters), [all, filters]);
  const places = useMemo(() => distinct(all.map((t) => t.place)), [all]);

  const edit = (t: BalanceTest) => { setEditing(t); window.setTimeout(() => document.getElementById('bal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  return (
    <div className="mk bal">
      <h1 className="mk-h1">⚖️ {T('title')}</h1>
      <p className="mk-muted">{T('intro')}</p>

      {err && <p className="mk-warn" role="alert">{err}</p>}
      {!tests && !err && <Loading />}
      {tests && (
        <>
          <Report tests={filtered} all={all} filters={filters} onFilters={setFilters} lang={lang} />
          <TestForm editing={editing} places={places} onSaved={() => void load()} onCancel={() => setEditing(null)} lang={lang} />
          <TestList tests={filtered} onEdit={edit} onChanged={() => void load()} lang={lang} />
        </>
      )}
    </div>
  );
}
