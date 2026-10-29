// Personal follow-along page (pristonzone.com/pessoalhadder): a guide made of sections, each with text and check-off items.
// The owner (administrator) edits it inside the page itself; everybody else only reads it and ticks their own items.
// Content lives in public.personal_pages (supabase/34_personal_page.sql); the ticks of each visitor stay in that browser.
import { supabase } from '../market/supabase';

export type BlockKind = 'text' | 'check' | 'step' | 'tip';
export interface Block { id: string; kind: BlockKind; text: string; level: 0 | 1 }
export interface Section { id: string; title: string; blocks: Block[] }
export interface PersonalPage { title: string; intro: string; sections: Section[] }

export const BLOCK_KINDS: BlockKind[] = ['text', 'check', 'step', 'tip'];
export const LIMITS = { title: 120, intro: 1000, sectionTitle: 120, text: 3000, sections: 40, blocks: 200 } as const;

/** Items the visitor can tick. */
export const isCheckable = (b: Block) => b.kind === 'check' || b.kind === 'step';

let counter = 0;
export const newId = (): string => {
  try { return crypto.randomUUID().slice(0, 8); } catch { return `${Date.now().toString(36)}${(counter++).toString(36)}`; }
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Accepts anything (the database, an old save, a typo) and returns a valid page; never throws. */
export function sanitizePage(raw: unknown): PersonalPage {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const uniqueId = (v: unknown) => { let id = typeof v === 'string' && v.trim() ? v.slice(0, 40) : newId(); while (seen.has(id)) id = newId(); seen.add(id); return id; };
  const sections: Section[] = (Array.isArray(o.sections) ? o.sections : []).slice(0, LIMITS.sections).map((s) => {
    const so = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const blocks: Block[] = (Array.isArray(so.blocks) ? so.blocks : []).slice(0, LIMITS.blocks).map((b) => {
      const bo = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      return { id: uniqueId(bo.id), kind: BLOCK_KINDS.includes(bo.kind as BlockKind) ? (bo.kind as BlockKind) : 'text', text: str(bo.text, LIMITS.text), level: bo.level === 1 ? 1 : 0 };
    });
    return { id: uniqueId(so.id), title: str(so.title, LIMITS.sectionTitle), blocks };
  });
  return { title: str(o.title, LIMITS.title), intro: str(o.intro, LIMITS.intro), sections };
}

/** Ticked / total items, ignoring ticks of items that no longer exist. */
export function progressOf(blocks: Block[], marks: Record<string, boolean>): { done: number; total: number } {
  const items = blocks.filter(isCheckable);
  return { done: items.filter((b) => marks[b.id]).length, total: items.length };
}
export const pageBlocks = (p: PersonalPage): Block[] => p.sections.flatMap((s) => s.blocks);

/** Number of each numbered step: 1, 2, 3 ... among the main-level steps of a section; null for everything else. A text or tip in between restarts the count. */
export function stepNumbers(blocks: Block[]): (number | null)[] {
  let n = 0;
  return blocks.map((b) => {
    if (b.level === 1) return null;
    if (b.kind === 'step') return ++n;
    n = 0;
    return null;
  });
}

export interface Piece { text: string; bold: boolean }
/** **bold** and *bold* (the second form is what most chat apps paste) become bold pieces; everything else is plain text. */
export function inlinePieces(text: string): Piece[] {
  const out: Piece[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1] ?? m[2], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

// ---------- persistence ----------
export const PAGE_SLUG = 'hadder';

export interface PageRepo {
  /** The saved page, or null when none was saved yet (the screen then shows the default text). */
  load(slug: string): Promise<PersonalPage | null>;
  save(slug: string, page: PersonalPage): Promise<void>;
}

const supabaseRepo: PageRepo = {
  async load(slug) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('personal_pages').select('content').eq('slug', slug).maybeSingle();
    if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return null; throw new Error(error.message); }
    return data ? sanitizePage((data as { content: unknown }).content) : null;
  },
  async save(slug, page) {
    if (!supabase) throw new Error('Sem conexão com o banco.');
    const { error } = await supabase.from('personal_pages').upsert({ slug, content: sanitizePage(page) });
    if (!error) return;
    if (error.code === '42P01' || error.code === 'PGRST205') throw new Error('A tabela ainda não existe: rode o SQL 34_personal_page.sql no Supabase.');
    if (error.code === '42501') throw new Error('Sem permissão: entre com a conta de administrador para editar.');
    throw new Error(error.message);
  },
};

/** Dev only (?fakedb): keeps the page in this browser so the editor can be tried without the database. */
export const PERSONAL_FAKE: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try { return sessionStorage.getItem('pz-fakedb') === '1' || new URLSearchParams(window.location.search).has('fakedb'); } catch { return false; }
})();
const memoryRepo: PageRepo = {
  async load(slug) { try { const t = localStorage.getItem(`pz-personal-dev-${slug}`); return t ? sanitizePage(JSON.parse(t)) : null; } catch { return null; } },
  async save(slug, page) { localStorage.setItem(`pz-personal-dev-${slug}`, JSON.stringify(sanitizePage(page))); },
};
export const getPageRepo = (): PageRepo => (PERSONAL_FAKE ? memoryRepo : supabaseRepo);

// ---------- the visitor's own ticks (this browser only) ----------
const marksKey = (slug: string) => `pz-personal-marks-v1-${slug}`;
export function loadMarks(slug: string): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(marksKey(slug)) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v === true)) as Record<string, boolean>;
  } catch { return {}; }
}
export function saveMarks(slug: string, marks: Record<string, boolean>): void {
  try { localStorage.setItem(marksKey(slug), JSON.stringify(marks)); } catch { /* private mode: the ticks just last until the page closes */ }
}

// ---------- default text (what shows until the owner saves a version) ----------
/** The ids are fixed ('d1', 'd2'...) so the ticks survive a reload while no saved version exists yet. */
export function defaultPage(): PersonalPage {
  let n = 0;
  const b = (kind: BlockKind, text: string, level: 0 | 1 = 0): Block => ({ id: `d${++n}`, kind, text, level });
  let sn = 0;
  const sid = () => `ds${++sn}`;
  return {
    title: 'Rota para o leveling perfeito',
    intro: 'Marque cada item conforme for fazendo. As suas marcações ficam salvas só neste navegador.',
    sections: [
      {
        id: sid(), title: '1. Preparação — antes do aumento de level',
        blocks: [
          b('text', 'Deixe todas as **10 quests prontas para entrega**, incluindo:'),
          b('check', '**Dayane:** Boss Quest.'),
          b('check', '**Whispering Vale:** Solo Quest.'),
          b('check', '**Quests de monstros:**'),
          b('check', '1.000 mobs — Land of Neuren [H]', 1),
          b('check', '750 mobs — Crystal Nest [H]', 1),
          b('check', '500 mobs — Forge of the Ancients [H]', 1),
          b('check', '**Quests H:** Whispering Vale (incluindo Vale Geist), LoN, CN e FoA.'),
        ],
      },
      {
        id: sid(), title: '2. Entrega das quests — após o anúncio',
        blocks: [
          b('text', 'Assim que o aumento de level for anunciado, siga esta ordem:'),
          b('step', '**Cidade:** entregue a Solo Quest e a Boss Quest.'),
          b('step', '**FoA H:** entregue a quest de 500 mobs e depois a quest H de FoA no mapa AoE.'),
          b('step', '**CN H:** entregue a quest de 750 mobs e depois a quest H de CN no mapa AoE.'),
          b('step', '**Pillai → LoN:** entregue as quests de LoN e LoN H.'),
          b('step', '**Whispering Vale:** entregue as quests disponíveis e concentre-se em completar o restante do mapa.'),
        ],
      },
      {
        id: sid(), title: '3. Preparação do grupo e meta de EXP',
        blocks: [
          b('text', '**A partir das 19h30 (ou antes, se possível):**'),
          b('check', 'Organize um grupo para revezar a hunt entre os 3 spots disponíveis.'),
          b('check', 'O objetivo é garantir pelo menos **1 spot H e o Red Spot ao redor**.'),
          b('check', 'Priorize completar o equivalente a **165% de EXP em Whispering Vale**.'),
          b('text', '**Exemplo prático:** se todos começarem no level 210, após a entrega dos ciclos de quests, a meta será atingir pelo menos **level 211 + 65% de EXP**.'),
          b('text', 'Caso as quests não sejam suficientes, continue o grind em Whispering até alcançar essa porcentagem.'),
        ],
      },
      {
        id: sid(), title: '4. Finalização da rota',
        blocks: [
          b('text', 'Após atingir a meta de EXP:'),
          b('step', 'Desça para **LoN** e complete as quests restantes.'),
          b('step', 'Antes de seguir para CN, vá até **FoA** e finalize a última quest H pendente.'),
          b('step', 'Siga para **CN** e conclua as quests restantes.'),
        ],
      },
      {
        id: sid(), title: '5. Dica extra — otimização com Union Cores',
        blocks: [
          b('tip', 'Caso o grupo tenha **Union Cores** e uma pessoa extra disponível:'),
          b('check', 'Peça para esse jogador adiantar o boss de **CN das 21h30**.'),
          b('check', 'Utilize os Union Cores para levar o grupo diretamente até o boss.'),
          b('text', 'Dessa forma, será possível adiantar mais uma quest e acelerar ainda mais o leveling.'),
        ],
      },
    ],
  };
}
