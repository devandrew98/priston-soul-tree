// pristonzone.com/balance: class balance tests. No link on the site (whoever gets the address can read and change the data, no login),
// kept out of search engines. Add tests (class, mobs killed, time, who tested, where...) and the report at the top ranks the classes.
// Follows the site language (the flags in the top bar): Portuguese or English.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BULK_FIELDS, MODES, NO_FILTERS, buildReport, distinct, filterTests, fmtPct, fmtRate, formatDuration, isStale, needRetest, parseDuration, rankTests, sortPatches, testRate, toggleValue, withField,
  type BalanceChange, type BulkField, type BalanceTest, type Filters, type Mode, type TestRank,
} from '../../lib/balance';
import { DEMO_CHANGES, DEMO_TESTS } from '../../lib/balanceDemo';
import { addChange, deleteBalance, deleteChange, fetchBalance, fetchChanges, saveBalance } from '../../lib/balanceApi';
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
  patch: { pt: 'Versão do patch', en: 'Patch version' },
  noPatchesYet: { pt: 'Nenhum teste com patch ainda. Informe o patch ao adicionar um teste e ele aparece aqui.', en: 'No test has a patch yet. Enter the patch when adding a test and it shows up here.' },
  stale: { pt: 'desatualizado', en: 'out of date' },
  staleHint: { pt: 'A classe foi alterada depois deste teste', en: 'The class was changed after this test' },
  staleCount: { pt: 'desatualizados', en: 'out of date' },
  viewTests: { pt: 'Quais testes mostrar', en: 'Which tests to show' },
  viewCurrent: { pt: 'Só os atuais', en: 'Only up-to-date' },
  viewAll: { pt: 'Todos (com os desatualizados)', en: 'All (with out-of-date ones)' },
  needRetest: { pt: 'Precisam de novo teste:', en: 'Need a new test:' },
  changedOn: { pt: 'alterada em {d}', en: 'changed on {d}' },
  allStale: { pt: 'Todos os testes dessa seleção estão desatualizados. Refaça os testes ou escolha “Todos”.', en: 'Every test in this selection is out of date. Test again or pick “All”.' },
  changesTitle: { pt: 'Alterações no jogo', en: 'Game changes' },
  changesHint: { pt: 'Anote quando uma classe (ou o jogo todo) foi alterada. Os testes feitos antes da alteração ficam “desatualizados” e saem do ranking; os das outras classes continuam valendo.', en: 'Note when a class (or the whole game) was changed. Tests made before the change become “out of date” and leave the ranking; the other classes’ tests stay valid.' },
  generalChange: { pt: 'Alteração geral (todas as classes)', en: 'General change (all classes)' },
  changeDate: { pt: 'Data da alteração', en: 'Change date' },
  changeNote: { pt: 'O que mudou (opcional)', en: 'What changed (optional)' },
  changesNotReady: { pt: 'As alterações no jogo ainda não estão ativas: falta rodar o arquivo supabase/52_balance_changes.sql no Supabase.', en: 'Game changes are not active yet: supabase/52_balance_changes.sql still has to be run in Supabase.' },
  addChange: { pt: 'Registrar alteração', en: 'Add change' },
  noPatch: { pt: 'sem patch', en: 'no patch' },
  vLong: { pt: 'Texto muito longo.', en: 'Text too long.' },
  selectAll: { pt: 'Selecionar todos', en: 'Select all' },
  selected1: { pt: 'teste selecionado', en: 'test selected' },
  selectedN: { pt: 'testes selecionados', en: 'tests selected' },
  bulkTitle: { pt: 'Alterar vários testes', en: 'Change several tests' },
  bulkWhat: { pt: 'O que alterar', en: 'What to change' },
  bulkNew: { pt: 'Novo valor', en: 'New value' },
  bulkApply: { pt: 'Aplicar aos selecionados', en: 'Apply to the selected' },
  clearSel: { pt: 'Limpar seleção', en: 'Clear selection' },
  bulkEmptyHint: { pt: 'Deixando o valor vazio, esse campo é limpo nos testes selecionados.', en: 'Leaving the value empty clears that field on the selected tests.' },
  bulkDone: { pt: '{n} teste(s) alterado(s).', en: '{n} test(s) changed.' },
  bulkPartial: { pt: '{n} já alterado(s)', en: '{n} already changed' },
  pickMany: { pt: 'escolha quantos quiser', en: 'pick as many as you like' },
  patchOpt: { pt: 'Versão do patch (opcional)', en: 'Patch version (optional)' },
  mixedPatches: { pt: 'patches diferentes', en: 'different patches' },
  onePatch: { pt: 'um patch', en: 'one patch' },
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
  mobsWord: { pt: 'mobs', en: 'mobs' },
  totalMobs: { pt: 'Total de mobs mortos neste teste', en: 'Total mobs killed in this test' },
  mixedPlaces: { pt: 'mapas diferentes', en: 'different maps' },
  mixedLevels: { pt: 'níveis diferentes', en: 'different levels' },
  mixedWarn: { pt: '⚠ Há testes de {x} misturados. Para comparar de forma justa, filtre por {y}.', en: '⚠ The selection mixes tests from {x}. To compare fairly, filter by {y}.' },
  oneMap: { pt: 'um mapa', en: 'one map' },
  oneLevelRange: { pt: 'uma faixa de nível', en: 'a level range' },
  test1: { pt: 'teste', en: 'test' },
  roundFirst: { pt: '🥇 Melhor teste de cada classe', en: '🥇 Best test of each class' },
  roundN: { pt: '{n}º melhor teste de cada classe', en: '#{n} best test of each class' },
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
  levelOpt: { pt: 'Nível (opcional)', en: 'Level (optional)' },
  mode: { pt: 'Modo', en: 'Mode' },
  modeAoe: { pt: 'AoE', en: 'AoE' },
  modeSingle: { pt: '1v1', en: '1v1' },
  modeHintAoe: { pt: 'vários mobs de uma vez', en: 'several mobs at once' },
  modeHintSingle: { pt: 'um alvo só', en: 'a single target' },
  noMap: { pt: 'Sem mapa', en: 'No map' },
  moreDetails: { pt: 'Mostrar mais detalhes', en: 'Show more details' },
  lessDetails: { pt: 'Mostrar menos detalhes', en: 'Show fewer details' },
  overallPos: { pt: 'Posição entre todos os testes', en: 'Position among all the tests' },
  fastestTest: { pt: 'Teste mais rápido:', en: 'Fastest test:' },
  slowestTest: { pt: 'Teste mais lento:', en: 'Slowest test:' },
  ofAverageTests: { pt: 'da média dos testes', en: 'vs the average of the tests' },
  avgOfTests: { pt: 'Média dos testes:', en: 'Average of the tests:' },
  oneTest: { pt: 'Só há um teste:', en: 'There is only one test:' },
  addMoreTests: { pt: 'Adicione mais testes para comparar.', en: 'Add more tests to compare.' },
  mixedWarnTests: { pt: '⚠ Há testes de {x} misturados. Veja o modo e o patch em cada linha, ou filtre por {y}.', en: '⚠ The selection mixes tests from {x}. Check the mode and the patch on each row, or filter by {y}.' },
  methodTests: {
    pt: 'Cada teste é calculado sozinho (mobs ÷ minutos) e nunca é somado a outro, mesmo da mesma classe e do mesmo mapa. As classes aparecem na ordem do teste mais rápido de cada uma, e o número ao lado de cada teste é a posição dele entre todos.',
    en: 'Each test is calculated on its own (mobs ÷ minutes) and is never added to another one, even for the same class on the same map. The classes appear in the order of their fastest test, and the number next to each test is its position among all of them.',
  },
  noModeSection: { pt: 'Sem modo (testes antigos)', en: 'No mode (older tests)' },
  mixedModes: { pt: 'modos diferentes (AoE e 1v1)', en: 'different modes (AoE and 1v1)' },
  oneMode: { pt: 'um modo', en: 'one mode' },
  vMode: { pt: 'Escolha o modo: AoE ou 1v1.', en: 'Pick the mode: AoE or 1v1.' },
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
  [/modo inválido/i, { pt: 'Modo inválido.', en: 'Invalid mode.' }],
  [/patch inválido/i, { pt: 'Patch inválido (até 30 caracteres).', en: 'Invalid patch (up to 30 characters).' }],
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
const modeLabel = (m: Mode | null, lang: Lang) => (m === 'aoe' ? TXT.modeAoe[lang] : m === 'single' ? TXT.modeSingle[lang] : '—');
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

interface Form { tester: string; cls: ClassSlug | ''; mode: Mode | ''; mobs: string; time: string; place: string; level: string; on: string; notes: string; patch: string }
const PATCH_KEY = 'pz-balance-patch';
const readPatch = () => { try { return localStorage.getItem(PATCH_KEY) ?? ''; } catch { return ''; } };
const savePatch = (v: string) => { try { localStorage.setItem(PATCH_KEY, v); } catch { /* ignore */ } };
const emptyForm = (): Form => ({ tester: readName(), cls: '', mode: '', mobs: '', time: '', place: '', level: '', on: today(), notes: '', patch: readPatch() });

/** A heading that folds/unfolds its block when clicked. */
function Fold({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="bal-fold" aria-expanded={open} onClick={onClick}>
      <span className="bal-chev" aria-hidden="true">{open ? '▾' : '▸'}</span>{children}
    </button>
  );
}

function ClassTag({ cls }: { cls: ClassSlug }) {
  return <span className="bal-class"><img src={icon(cls)} alt="" width={22} height={22} /> {className(cls)}</span>;
}

// ---------- report ----------
/**
 * The tests grouped by class. Nothing is ever added up: every test keeps its own speed (mobs / minutes), its own bar and its own row,
 * even two tests of the same class on the same map. The classes are ordered by their fastest single test.
 */
function Ranking({ tests, lang, more, staleIds }: { tests: BalanceTest[]; lang: Lang; more: boolean; staleIds: Set<string> }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const rate = (n: number) => fmtRate(n, lang);
  const ranks = useMemo(() => rankTests(tests), [tests]);
  const r = useMemo(() => buildReport(tests, CLASS_SLUGS), [tests]);
  const top = ranks[0]?.rate ?? 1;
  const avg = ranks.length ? ranks.reduce((a, x) => a + x.rate, 0) / ranks.length : 0;
  const best = ranks[0];
  const worst = ranks.length > 1 ? ranks[ranks.length - 1] : null;
  const label = (x: TestRank) => `${className(x.test.cls)} (${x.test.tester})`;
  const num = lang === 'pt' ? 'pt-BR' : 'en-US';
  const position = useMemo(() => new Map(ranks.map((x, i) => [x.test.id, i + 1])), [ranks]);
  // Round 1 = the best test of every class (fastest first), round 2 = the second best of every class, and so on —
  // so a class with several tests never crowds out the other classes.
  const groups = useMemo(() => {
    const seen = new Map<ClassSlug, number>();
    const rounds: TestRank[][] = [];
    for (const x of ranks) {
      const n = seen.get(x.test.cls) ?? 0;
      seen.set(x.test.cls, n + 1);
      (rounds[n] ??= []).push(x);
    }
    return rounds.map((list, i) => ({ round: i + 1, list }));
  }, [ranks]);

  return (
    <>
      <p className="bal-summary">
        {!worst ? (
          <>{T('oneTest')} <b>{label(best)}</b> ({rate(best.rate)} {T('mobsMin')}). {T('addMoreTests')}</>
        ) : (
          <>
            🏆 <b>{T('fastestTest')}</b> {label(best)} ({rate(best.rate)} {T('mobsMin')}, {fmtPct(best.vsAverage)} {T('ofAverageTests')}).{' '}
            🐢 <b>{T('slowestTest')}</b> {label(worst)} ({rate(worst.rate)} {T('mobsMin')}, {fmtPct(worst.vsAverage)} {T('ofAverageTests')}).{' '}
            {T('avgOfTests')} {rate(avg)} {T('mobsMin')} ({ranks.length} {T('tests')}).
          </>
        )}
      </p>
      {(r.mixedPatches || r.mixedModes) && (
        <p className="mk-note">{fill(T('mixedWarnTests'), r.mixedModes ? { x: T('mixedModes'), y: T('oneMode') } : { x: T('mixedPatches'), y: T('onePatch') })}</p>
      )}
      {groups.map(({ round, list }) => (
        <section key={round} className="bal-class-group">
          {groups.length > 1 && (
            <h3 className="bal-class-h">
              {round === 1 ? T('roundFirst') : fill(T('roundN'), { n: String(round) })}
              <small>{list.length} {list.length === 1 ? T('test1') : T('tests')}</small>
            </h3>
          )}
          <ol className="bal-rank">
            {list.map((x) => {
              const p = list.indexOf(x) + 1; // position inside this table (1..number of classes)
              const overall = position.get(x.test.id) ?? 0;
              return (
                <li key={x.test.id} className={`${overall === 1 && ranks.length > 1 ? 'top' : overall === ranks.length && ranks.length > 1 ? 'low' : ''}${staleIds.has(x.test.id) ? ' stale' : ''}`} title={x.test.notes || undefined}>
                  <span className="bal-pos">{lang === 'pt' ? `${p}º` : `#${p}`}</span>
                  <span className="bal-cls"><ClassTag cls={x.test.cls} /></span>
                  <span className="bal-mode">{modeLabel(x.test.mode, lang)}</span>
                  <span className="bal-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (x.rate / top) * 100)}%` }} /></span>
                  <span className="bal-total" title={T('totalMobs')}><b>{x.test.mobs.toLocaleString(num)}</b><small> {T('mobsWord')}</small></span>
                  <b className="bal-rate">{rate(x.rate)}<small> {T('mobsMin')}</small></b>
                  <span className={`bal-vs ${x.vsAverage >= 0 ? 'up' : 'down'}`}>{ranks.length > 1 ? fmtPct(x.vsAverage) : '—'}</span>
                  <small className="bal-meta">
                    {staleIds.has(x.test.id) && <b className="bal-stale-tag" title={T('staleHint')}>{T('stale')} </b>}
                    {fmtDate(x.test.testedOn, lang)} · {x.test.place || T('noMap')} · {x.test.tester}{x.test.patch && <> · {T('patch')} {x.test.patch}</>}
                    {more && (
                      <>
                        {x.test.level !== null && <> · {T('thLevel')} {x.test.level}</>}
                        {' · '}{x.test.mobs.toLocaleString(num)} {T('mobsIn')} {formatDuration(x.test.seconds)}
                        {x.test.notes && <> · 📝 {x.test.notes}</>}
                      </>
                    )}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {r.untested.length > 0 && <p className="mk-muted bal-untested">{T('noTests')} {r.untested.map(className).join(', ')}.</p>}
    </>
  );
}

/** Changes made to the game (one class or everything): tests older than a change that touches their class count as out of date. */
interface ChangesApi { add: (c: Omit<BalanceChange, 'id'>) => Promise<void>; remove: (id: string) => Promise<void> }

function ChangesPanel({ changes, api, lang }: { changes: BalanceChange[]; api: ChangesApi; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [target, setTarget] = useState<ClassSlug | ''>(''); // '' = nothing picked yet; 'all' handled by `general`
  const [general, setGeneral] = useState(false);
  const [on, setOn] = useState(today());
  const [patch, setPatch] = useState('');
  const [note, setNote] = useState('');
  const sorted = [...changes].sort((a, b) => b.on.localeCompare(a.on));
  const run = async (fn: () => Promise<void>) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (x) { setErr(errText(x, lang)); } finally { setBusy(false); }
  };
  const add = () => {
    if (!general && !target) return;
    void run(async () => { await api.add({ cls: general ? null : (target as ClassSlug), on, patch: patch.trim(), note: note.trim() }); setNote(''); });
  };
  return (
    <div className="bal-changes">
      <h3 className="bal-sub"><Fold open={open} onClick={() => setOpen(!open)}>🛠️ {T('changesTitle')} <small className="mk-muted">({changes.length})</small></Fold></h3>
      {open && (
        <>
          <p className="mk-muted bal-note">{T('changesHint')}</p>
          <div className="af-chips" role="group" aria-label={T('changesTitle')}>
            <button type="button" className={`af-chip${general ? ' on' : ''}`} aria-pressed={general} onClick={() => setGeneral(!general)}>🌍 {T('generalChange')}</button>
            {CLASS_SLUGS.map((c) => (
              <button key={c} type="button" disabled={general} className={`af-chip${!general && target === c ? ' on' : ''}`} aria-pressed={!general && target === c} onClick={() => setTarget(c)}>
                <img src={icon(c)} alt="" width={18} height={18} /> {className(c)}
              </button>
            ))}
          </div>
          <div className="bal-grid">
            <label className="af-field"><span className="af-label">{T('changeDate')}</span><input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></label>
            <label className="af-field"><span className="af-label">{T('patch')}</span><input value={patch} maxLength={30} onChange={(e) => setPatch(e.target.value)} placeholder="1.2.3" /></label>
            <label className="af-field"><span className="af-label">{T('changeNote')}</span><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="bal-actions"><button type="button" className="mk-btn primary" disabled={busy || (!general && !target)} onClick={add}>{busy ? '⏳' : T('addChange')}</button></div>
          {err && <p className="mk-warn" role="alert">{err}</p>}
          <ul className="bal-change-list">
            {sorted.map((c) => (
              <li key={c.id}>
                <span>{fmtDate(c.on, lang)}</span>
                <b>{c.cls ? <ClassTag cls={c.cls} /> : <>🌍 {T('generalChange')}</>}</b>
                <small>{c.patch && <>{T('patch')} {c.patch} · </>}{c.note}</small>
                <button type="button" className="mk-btn sm danger" disabled={busy} onClick={() => void run(() => api.remove(c.id))}>{T('del')}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Report({ tests: filteredTests, all, filters, onFilters, lang, changes, changesApi }: { tests: BalanceTest[]; all: BalanceTest[]; filters: Filters; onFilters: (f: Filters) => void; lang: Lang; changes: BalanceChange[]; changesApi: ChangesApi | null }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [view, setView] = useState<'current' | 'all'>('current');
  const staleIds = useMemo(() => new Set(filteredTests.filter((t) => isStale(t, changes)).map((t) => t.id)), [filteredTests, changes]);
  // "current" leaves out the tests a later change made out of date; "all" keeps them (marked)
  const tests = useMemo(() => (view === 'current' ? filteredTests.filter((t) => !staleIds.has(t.id)) : filteredTests), [view, filteredTests, staleIds]);
  const retest = useMemo(() => needRetest(filteredTests, changes, CLASS_SLUGS), [filteredTests, changes]);
  const testers = useMemo(() => distinct(all.map((t) => t.tester)), [all]);
  const patches = useMemo(() => sortPatches(distinct(all.map((t) => t.patch))), [all]);
  const dirty = filters.testers.length > 0 || filters.patches.length > 0 || filters.mode;
  const picked = (list: string[], v: string) => list.some((x) => x.trim().toLowerCase() === v.toLowerCase());
  const [more, setMore] = useState(false);
  // AoE and 1v1 are different kinds of test, so each one gets its own statistics (summary + ranking); older tests with no mode go last.
  const sections = useMemo(() => ([
    { key: 'aoe', mode: 'aoe' as Mode | null, tests: tests.filter((t) => t.mode === 'aoe') },
    { key: 'single', mode: 'single' as Mode | null, tests: tests.filter((t) => t.mode === 'single') },
    { key: 'none', mode: null as Mode | null, tests: tests.filter((t) => t.mode === null) },
  ].filter((s) => s.tests.length > 0)), [tests]);

  const [open, setOpen] = useState(true);
  const [closedSections, setClosedSections] = useState<string[]>([]);

  return (
    <section className="sr-card bal-report">
      <h2 className="mk-h2"><Fold open={open} onClick={() => setOpen(!open)}>📊 {T('report')}</Fold></h2>
      {open && (<>
      <div className="bal-filters">
        <label className="af-field"><span className="af-label">{T('mode')}</span>
          <select value={filters.mode} onChange={(e) => onFilters({ ...filters, mode: e.target.value as Mode | '' })}>
            <option value="">{T('all')}</option>{MODES.map((m) => <option key={m} value={m}>{modeLabel(m, lang)}</option>)}
          </select></label>
        {dirty && <button type="button" className="mk-btn sm" onClick={() => onFilters(NO_FILTERS)}>{T('clearFilters')}</button>}
      </div>
      {/* pick as many as you want: the report shows only the tests that match a picked person AND a picked patch */}
      {testers.length > 0 && (
        <div className="af-field bal-pick">
          <span className="af-label">{T('testedBy')} <small>({T('pickMany')})</small></span>
          <div className="af-chips" role="group" aria-label={T('testedBy')}>
            <button type="button" className={`af-chip${filters.testers.length === 0 ? ' on' : ''}`} onClick={() => onFilters({ ...filters, testers: [] })}>{T('allF')}</button>
            {testers.map((p) => (
              <button key={p} type="button" className={`af-chip${picked(filters.testers, p) ? ' on' : ''}`} aria-pressed={picked(filters.testers, p)} onClick={() => onFilters({ ...filters, testers: toggleValue(filters.testers, p) })}>{p}</button>
            ))}
          </div>
        </div>
      )}
      <div className="af-field bal-pick">
        <span className="af-label">{T('patch')} <small>({T('pickMany')})</small></span>
        {patches.length === 0 ? (
          <p className="mk-muted bal-note">{T('noPatchesYet')}</p>
        ) : (
          <div className="af-chips" role="group" aria-label={T('patch')}>
            <button type="button" className={`af-chip${filters.patches.length === 0 ? ' on' : ''}`} onClick={() => onFilters({ ...filters, patches: [] })}>{T('all')}</button>
            {patches.map((p) => (
              <button key={p} type="button" className={`af-chip${picked(filters.patches, p) ? ' on' : ''}`} aria-pressed={picked(filters.patches, p)} onClick={() => onFilters({ ...filters, patches: toggleValue(filters.patches, p) })}>{p}</button>
            ))}
          </div>
        )}
      </div>
      {changesApi ? <ChangesPanel changes={changes} api={changesApi} lang={lang} /> : <p className="mk-muted bal-note">{T('changesNotReady')}</p>}
      {changes.length > 0 && (
        <div className="af-field bal-pick">
          <span className="af-label">{T('viewTests')}</span>
          <div className="af-chips" role="group" aria-label={T('viewTests')}>
            <button type="button" className={`af-chip${view === 'current' ? ' on' : ''}`} aria-pressed={view === 'current'} onClick={() => setView('current')}>{T('viewCurrent')}</button>
            <button type="button" className={`af-chip${view === 'all' ? ' on' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>{T('viewAll')} {staleIds.size > 0 && <small>({staleIds.size} {T('staleCount')})</small>}</button>
          </div>
        </div>
      )}
      {retest.length > 0 && (
        <p className="mk-note bal-retest">🔁 <b>{T('needRetest')}</b> {retest.map((x) => `${className(x.cls)} (${fill(T('changedOn'), { d: fmtDate(x.change.on, lang) })})`).join(', ')}</p>
      )}

      {tests.length === 0 ? (
        <p className="mk-muted">{all.length === 0 ? T('noTestsYet') : filteredTests.length > 0 ? T('allStale') : T('noMatch')}</p>
      ) : (
        <>
          <div className="bal-toolbar">
            <button type="button" className="mk-btn sm" aria-pressed={more} onClick={() => setMore(!more)}>{more ? T('lessDetails') : T('moreDetails')}</button>
          </div>
          {sections.map((s) => (
            <section key={s.key} className={`bal-mode-section ${s.key}`}>
              <h3 className="bal-mode-h">
                <Fold open={!closedSections.includes(s.key)} onClick={() => setClosedSections((c) => (c.includes(s.key) ? c.filter((k) => k !== s.key) : [...c, s.key]))}>
                  <span className="bal-mode-name">{s.mode === 'aoe' ? '⚔️' : s.mode === 'single' ? '🎯' : '📋'} {s.mode ? modeLabel(s.mode, lang) : T('noModeSection')}</span>
                  {s.mode && <small>{s.mode === 'aoe' ? T('modeHintAoe') : T('modeHintSingle')}</small>}
                  <small className="bal-mode-count">{s.tests.length} {s.tests.length === 1 ? T('test1') : T('tests')}</small>
                </Fold>
              </h3>
              {!closedSections.includes(s.key) && <Ranking tests={s.tests} lang={lang} more={more} staleIds={staleIds} />}
            </section>
          ))}
          <p className="mk-muted bal-note">{T('methodTests')}</p>
        </>
      )}
      </>)}
    </section>
  );
}

// ---------- form ----------
function TestForm({ editing, editSeq, places, patches, onSaved, onCancel, lang }: { editing: BalanceTest | null; editSeq: number; places: string[]; patches: string[]; onSaved: () => void; onCancel: () => void; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [f, setF] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [open, setOpen] = useState(false); // folded until the visitor opens it (or starts editing a test)

  useEffect(() => {
    if (editing) {
      setOpen(true);
      setF({ tester: editing.tester, cls: editing.cls, mode: editing.mode ?? '', mobs: String(editing.mobs), time: formatDuration(editing.seconds), place: editing.place, level: editing.level === null ? '' : String(editing.level), on: editing.testedOn, notes: editing.notes, patch: editing.patch });
      setErr(''); setOk('');
    }
  }, [editing, editSeq]);

  const set = (p: Partial<Form>) => setF((cur) => ({ ...cur, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk('');
    const mobs = Number(f.mobs);
    const seconds = parseDuration(f.time);
    if (!f.tester.trim()) return setErr(T('vTester'));
    if (!f.cls) return setErr(T('vClass'));
    if (!f.mode && !(editing && editing.mode === null)) return setErr(T('vMode'));
    if (!Number.isInteger(mobs) || mobs < 1) return setErr(T('vMobs'));
    if (seconds === null) return setErr(T('vTime'));
    const level = f.level.trim() === '' ? null : Number(f.level);
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 300)) return setErr(T('vLevel'));
    setBusy(true);
    try {
      await saveBalance(editing?.id ?? null, { cls: f.cls, mode: f.mode || null, mobs, seconds, tester: f.tester.trim(), level, place: f.place.trim(), notes: f.notes.trim(), patch: f.patch.trim(), testedOn: f.on || today() });
      saveName(f.tester.trim());
      savePatch(f.patch.trim());
      if (editing) { onSaved(); setF(emptyForm()); onCancel(); setOk(T('savedOk')); }
      else { setOk(T('added')); set({ mobs: '', time: '', notes: '' }); onSaved(); }
    } catch (x) {
      setErr(errText(x, lang));
    } finally { setBusy(false); }
  };

  return (
    <section className="sr-card bal-form" id="bal-form">
      <h2 className="mk-h2"><Fold open={open} onClick={() => setOpen(!open)}>{editing ? `✏️ ${T('editTest')}` : `➕ ${T('addTest')}`}</Fold></h2>
      {open && <form onSubmit={submit}>
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
        <div className="af-field">
          <span className="af-label">{T('mode')}</span>
          <div className="af-chips" role="group" aria-label={T('mode')}>
            {MODES.map((m) => (
              <button key={m} type="button" className={`af-chip${f.mode === m ? ' on' : ''}`} aria-pressed={f.mode === m} onClick={() => set({ mode: m })}>
                {modeLabel(m, lang)} <small>{m === 'aoe' ? T('modeHintAoe') : T('modeHintSingle')}</small>
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
          <label className="af-field"><span className="af-label">{T('patchOpt')}</span>
            <input list="bal-patches" value={f.patch} maxLength={30} onChange={(e) => set({ patch: e.target.value })} placeholder="1.2.3" />
            <datalist id="bal-patches">{patches.map((p) => <option key={p} value={p} />)}</datalist></label>
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
      </form>}
    </section>
  );
}

// ---------- list ----------
/** The recorded tests, grouped by day. Tick several to change one field of all of them at once (e.g. set the patch of ten tests to 1.0). */
function TestList({ tests, patches, places, onEdit, onChanged, lang }: { tests: BalanceTest[]; patches: string[]; places: string[]; onEdit: (t: BalanceTest) => void; onChanged: () => void; lang: Lang }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [cls, setCls] = useState<ClassSlug | ''>('');
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [field, setField] = useState<BulkField>('patch');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = cls ? tests.filter((t) => t.cls === cls) : tests;
  const num = lang === 'pt' ? 'pt-BR' : 'en-US';
  const picked = useMemo(() => new Set(sel), [sel]);
  const days = useMemo(() => {
    const m = new Map<string, BalanceTest[]>();
    for (const t of shown) (m.get(t.testedOn) ?? m.set(t.testedOn, []).get(t.testedOn)!).push(t);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [shown]);
  const allShownPicked = shown.length > 0 && shown.every((t) => picked.has(t.id));

  // ticks of tests that no longer exist (deleted by someone else) are dropped
  useEffect(() => { setSel((cur) => cur.filter((id) => tests.some((t) => t.id === id))); }, [tests]);

  const toggle = (id: string) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleDay = (list: BalanceTest[]) => setSel((cur) => (list.every((t) => cur.includes(t.id)) ? cur.filter((id) => !list.some((t) => t.id === id)) : [...new Set([...cur, ...list.map((t) => t.id)])]));
  const toggleAll = () => setSel(allShownPicked ? [] : shown.map((t) => t.id));

  const remove = async (id: string) => {
    setErr(''); setMsg('');
    try { await deleteBalance(id); setAsk(null); onChanged(); } catch (x) { setErr(errText(x, lang)); }
  };

  const apply = async () => {
    setErr(''); setMsg('');
    const chosen = tests.filter((t) => picked.has(t.id));
    const next: BalanceTest[] = [];
    for (const t of chosen) {
      const r = withField(t, field, value);
      if (!r.ok) return setErr(r.error === 'mode' ? T('vMode') : r.error === 'tester' ? T('vTester') : r.error === 'level' ? T('vLevel') : T('vLong'));
      next.push(r.test);
    }
    setBusy(true);
    let done = 0;
    try {
      for (const t of next) { await saveBalance(t.id, { cls: t.cls, mode: t.mode, mobs: t.mobs, seconds: t.seconds, tester: t.tester, level: t.level, place: t.place, notes: t.notes, patch: t.patch, testedOn: t.testedOn }); done++; }
      setMsg(fill(T('bulkDone'), { n: String(done) }));
      setSel([]); setValue('');
    } catch (x) {
      setErr(`${errText(x, lang)}${done > 0 ? ` (${fill(T('bulkPartial'), { n: String(done) })})` : ''}`);
    } finally { setBusy(false); onChanged(); }
  };

  const fieldLabel: Record<BulkField, string> = { patch: T('patch'), mode: T('mode'), place: T('map'), level: T('thLevel'), tester: T('testedBy') };

  return (
    <section className="sr-card bal-list">
      <h2 className="mk-h2"><Fold open={open} onClick={() => setOpen(!open)}>🗒️ {T('recorded')} <small className="mk-muted">({shown.length})</small></Fold></h2>
      {open && (<>
        <div className="af-chips" role="group" aria-label={T('filterByClass')}>
          <button type="button" className={`af-chip${cls === '' ? ' on' : ''}`} onClick={() => setCls('')}>{T('allF')}</button>
          {CLASS_SLUGS.map((c) => <button key={c} type="button" className={`af-chip${cls === c ? ' on' : ''}`} onClick={() => setCls(c)}><img src={icon(c)} alt="" width={18} height={18} /> {className(c)}</button>)}
        </div>
        {shown.length > 0 && (
          <label className="bal-selall"><input type="checkbox" checked={allShownPicked} onChange={toggleAll} /> {T('selectAll')}</label>
        )}
        {sel.length > 0 && (
          <div className="bal-bulk" role="group" aria-label={T('bulkTitle')}>
            <b>{sel.length} {sel.length === 1 ? T('selected1') : T('selectedN')}</b>
            <label className="af-field"><span className="af-label">{T('bulkWhat')}</span>
              <select value={field} onChange={(e) => { setField(e.target.value as BulkField); setValue(''); }}>
                {BULK_FIELDS.map((f) => <option key={f} value={f}>{fieldLabel[f]}</option>)}
              </select></label>
            <label className="af-field"><span className="af-label">{T('bulkNew')}</span>
              {field === 'mode' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">—</option>{MODES.map((m) => <option key={m} value={m}>{modeLabel(m, lang)}</option>)}
                </select>
              ) : (
                <>
                  <input value={value} list={field === 'patch' ? 'bal-bulk-patches' : field === 'place' ? 'bal-bulk-places' : undefined}
                    inputMode={field === 'level' ? 'numeric' : undefined} maxLength={field === 'tester' ? 40 : field === 'place' ? 80 : field === 'patch' ? 30 : 3}
                    placeholder={field === 'patch' ? '1.0' : ''} onChange={(e) => setValue(field === 'level' ? e.target.value.replace(/\D/g, '') : e.target.value)} />
                  <datalist id="bal-bulk-patches">{patches.map((p) => <option key={p} value={p} />)}</datalist>
                  <datalist id="bal-bulk-places">{places.map((p) => <option key={p} value={p} />)}</datalist>
                </>
              )}</label>
            <div className="bal-bulk-actions">
              <button type="button" className="mk-btn primary" disabled={busy} onClick={() => void apply()}>{busy ? '⏳' : T('bulkApply')}</button>
              <button type="button" className="mk-btn" disabled={busy} onClick={() => { setSel([]); setErr(''); }}>{T('clearSel')}</button>
            </div>
            {(field === 'patch' || field === 'place' || field === 'level') && <small className="bal-bulk-hint">{T('bulkEmptyHint')}</small>}
          </div>
        )}
        {err && <p className="mk-warn" role="alert">{err}</p>}
        {msg && <p className="bal-ok" role="status">{msg}</p>}
        {shown.length === 0 ? <p className="mk-muted">{T('noneHere')}</p> : (
          <div className="bal-days">
            {days.map(([day, list]) => (
              <section key={day} className="bal-day">
                <h3 className="bal-day-h">
                  <label><input type="checkbox" checked={list.every((t) => picked.has(t.id))} onChange={() => toggleDay(list)} aria-label={`${T('selectAll')} ${fmtDate(day, lang)}`} /> <b>{fmtDate(day, lang)}</b></label>
                  <small>{list.length} {list.length === 1 ? T('test1') : T('tests')}</small>
                </h3>
                <ul className="bal-tl">
                  {list.map((t) => (
                    <li key={t.id} className={picked.has(t.id) ? 'sel' : ''}>
                      <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} aria-label={`${className(t.cls)} ${fmtDate(t.testedOn, lang)}`} />
                      <span className="bal-tl-cls"><ClassTag cls={t.cls} /><span className="bal-mode">{modeLabel(t.mode, lang)}</span></span>
                      <span className="bal-tl-num"><b>{fmtRate(testRate(t), lang)}</b><small> {T('mobsMin')}</small><em>{t.mobs.toLocaleString(num)} {T('mobsIn')} {formatDuration(t.seconds)}</em></span>
                      <span className="bal-tl-who">{t.tester}{t.patch ? <span className="bal-patch">{T('patch')} {t.patch}</span> : <span className="bal-patch none">{T('noPatch')}</span>}</span>
                      <span className="bal-tl-where">{t.place || T('noMap')}{t.level !== null && <> · {T('thLevel')} {t.level}</>}{t.notes && <small title={t.notes}>📝 {t.notes}</small>}</span>
                      <span className="bal-tl-act">
                        {ask === t.id ? (
                          <>
                            <span className="mk-warn">{T('delAsk')}</span>
                            <button type="button" className="mk-btn sm danger" onClick={() => void remove(t.id)}>{T('yes')}</button>
                            <button type="button" className="mk-btn sm" onClick={() => setAsk(null)}>{T('no')}</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="mk-btn sm" onClick={() => onEdit(t)} title={T('edit')} aria-label={`${T('edit')} ${className(t.cls)}`}>✏️ {T('edit')}</button>
                            <button type="button" className="mk-btn sm danger" onClick={() => setAsk(t.id)} title={T('del')} aria-label={`${T('del')} ${className(t.cls)}`}>🗑️</button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </>)}
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

  // /balance?demo (local dev only): example tests + game changes kept in memory, to try the "out of date" rules without the database.
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
  const [changes, setChanges] = useState<BalanceChange[]>(demo ? DEMO_CHANGES : []);
  const [changesReady, setChangesReady] = useState(demo); // false while supabase/52 has not been run

  const load = useCallback(async () => {
    if (demo) { setTests(DEMO_TESTS); return; }
    if (!BACKEND_ENABLED) { setErr(TXT.noBackend[langRef.current]); return; }
    // the game changes are optional: without the table the page still works, with every test counted as up to date
    fetchChanges().then((c) => { if (alive.current) { setChanges(c); setChangesReady(true); } }).catch(() => { if (alive.current) setChangesReady(false); });
    try { const r = await fetchBalance(); if (alive.current) { setTests(r); setErr(''); } }
    catch (e) {
      if (!alive.current) return;
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setErr(/balance_|schema cache|function/i.test(m) ? TXT.notReady[langRef.current] : m);
    }
  }, [demo]);

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
  const patches = useMemo(() => sortPatches(distinct(all.map((t) => t.patch))), [all]);

  const changesApi = useMemo<ChangesApi | null>(() => {
    if (demo) {
      return {
        add: async (c) => { setChanges((cur) => [...cur, { ...c, id: `c${Date.now()}` }]); },
        remove: async (id) => { setChanges((cur) => cur.filter((x) => x.id !== id)); },
      };
    }
    if (!changesReady) return null;
    return {
      add: async (c) => { await addChange(c); setChanges(await fetchChanges()); },
      remove: async (id) => { await deleteChange(id); setChanges(await fetchChanges()); },
    };
  }, [demo, changesReady]);

  const [editSeq, setEditSeq] = useState(0); // bumps on every click on "Edit", so the form re-opens and re-fills even for the same test
  const edit = (t: BalanceTest) => { setEditing(t); setEditSeq((n) => n + 1); window.setTimeout(() => document.getElementById('bal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  return (
    <div className="mk bal">
      <h1 className="mk-h1">⚖️ {T('title')}</h1>
      <p className="mk-muted">{T('intro')}</p>

      {err && <p className="mk-warn" role="alert">{err}</p>}
      {!tests && !err && <Loading />}
      {tests && (
        <>
          <Report tests={filtered} all={all} filters={filters} onFilters={setFilters} lang={lang} changes={changes} changesApi={changesApi} />
          <TestForm editing={editing} editSeq={editSeq} places={places} patches={patches} onSaved={() => void load()} onCancel={() => setEditing(null)} lang={lang} />
          <TestList tests={filtered} patches={patches} places={places} onEdit={edit} onChanged={() => void load()} lang={lang} />
        </>
      )}
    </div>
  );
}
