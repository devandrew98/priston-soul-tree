import type { SlotState } from './types';

// Talks to the /api/build serverless function (Upstash Redis backed).
// Stores the creator's edit token locally so only the creator can later edit a
// private build, while still letting the build be opened by code anywhere.

const API = '/api/build';
const TOKENS_KEY = 'priston-soul-cloud-tokens';

export interface CloudMeta {
  code: string;
  editToken: string; // '' when this client only opened the build (not the creator)
  publicEdit: boolean;
}

type TokenMap = Record<string, CloudMeta>; // keyed by local build id

function loadTokens(): TokenMap {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}') as TokenMap;
  } catch {
    return {};
  }
}

function persist(buildId: string, meta: CloudMeta) {
  const all = loadTokens();
  all[buildId] = meta;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
}

export function getCloudMeta(buildId: string): CloudMeta | null {
  return loadTokens()[buildId] ?? null;
}

function onlyFilled(slots: Record<string, SlotState>): Record<string, SlotState> {
  const out: Record<string, SlotState> = {};
  for (const [id, s] of Object.entries(slots)) if (s.soulId) out[id] = s;
  return out;
}

const FRIENDLY: Record<string, string> = {
  cloud_not_configured: 'O compartilhamento por código ainda não foi configurado neste servidor.',
  not_found: 'Código não encontrado (pode ter expirado).',
  forbidden: 'Esta build é privada — só quem a criou pode editá-la.',
  invalid_build: 'Build inválida.',
  missing_code: 'Informe um código.',
};

async function errorFrom(r: Response): Promise<Error> {
  let code = '';
  try {
    code = (await r.json())?.error ?? '';
  } catch {
    /* ignore */
  }
  return new Error(FRIENDLY[code] || `Falha na requisição (${r.status}).`);
}

export async function shareBuild(
  buildId: string,
  name: string,
  slots: Record<string, SlotState>,
  publicEdit: boolean,
): Promise<CloudMeta> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, slots: onlyFilled(slots), publicEdit }),
  });
  if (!r.ok) throw await errorFrom(r);
  const data = (await r.json()) as { code: string; editToken: string };
  const meta: CloudMeta = { code: data.code, editToken: data.editToken, publicEdit };
  persist(buildId, meta);
  return meta;
}

export async function openByCode(
  code: string,
): Promise<{ code: string; name: string; slots: Record<string, SlotState>; publicEdit: boolean }> {
  const r = await fetch(`${API}?code=${encodeURIComponent(code.toUpperCase().trim())}`);
  if (!r.ok) throw await errorFrom(r);
  return r.json();
}

/** Remember a code that was opened (not created here) so it can be edited if public. */
export function rememberOpened(buildId: string, code: string, publicEdit: boolean) {
  persist(buildId, { code, editToken: '', publicEdit });
}

export async function updateShared(
  buildId: string,
  name: string,
  slots: Record<string, SlotState>,
  publicEdit: boolean,
): Promise<void> {
  const meta = getCloudMeta(buildId);
  if (!meta) throw new Error('Esta build ainda não tem um código.');
  const r = await fetch(API, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: meta.code, editToken: meta.editToken, name, slots: onlyFilled(slots), publicEdit }),
  });
  if (!r.ok) throw await errorFrom(r);
  persist(buildId, { ...meta, publicEdit });
}
