// Client for the /api/player endpoint (per-player cloud save via a short code).
// The code is remembered in localStorage so the player stays "logged in".

const API = '/api/player';
const CODE_KEY = 'priston-player-code';

const FRIENDLY: Record<string, string> = {
  cloud_not_configured: 'A sincronização na nuvem não está configurada neste servidor.',
  not_found: 'Código de jogador não encontrado.',
  invalid_data: 'Dados inválidos.',
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

export function getPlayerCode(): string | null {
  return localStorage.getItem(CODE_KEY);
}

export function setPlayerCode(code: string | null) {
  if (code) localStorage.setItem(CODE_KEY, code);
  else localStorage.removeItem(CODE_KEY);
}

/** Create a new player from the given state; returns and remembers the code. */
export async function createPlayer(data: unknown): Promise<string> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw await errorFrom(r);
  const { code } = (await r.json()) as { code: string };
  setPlayerCode(code);
  return code;
}

/** Overwrite a player's saved state. */
export async function savePlayer(code: string, data: unknown): Promise<void> {
  const r = await fetch(API, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, data }),
  });
  if (!r.ok) throw await errorFrom(r);
}

/** Load a player's saved state (null if the code has no data). */
export async function loadPlayer(code: string): Promise<unknown | null> {
  const r = await fetch(`${API}?code=${encodeURIComponent(code.toUpperCase().trim())}`);
  if (r.status === 404) return null;
  if (!r.ok) throw await errorFrom(r);
  const { data } = (await r.json()) as { data: unknown };
  return data;
}
