import type { VercelRequest, VercelResponse } from '@vercel/node';

// Link previews. PristonZONE is a single-page app, so every URL answers with the same index.html
// and chat apps (Discord, WhatsApp, Telegram...) — which don't run JavaScript — would show the same
// generic card for every link. vercel.json sends only *crawler* requests here; we return the same
// index.html with page-specific <title>/Open Graph tags injected. Normal visitors never touch this.
//
// Kept self-contained on purpose (no imports from src/): the functions are ES modules and a
// relative import without an extension would break at runtime.

const SITE = 'PristonZONE';

export interface PageMeta {
  title: string;
  description: string;
  /** Path (starting with "/") of the preview image on this site. */
  image: string;
  /** Canonical path of the page. */
  path: string;
}

const HOME_DESC = 'Timer de bosses, árvore de souls, construtor de skills, mixing, armário e muito mais. Feito por jogadores, para jogadores do PristonTale EU.';

const PAGES: Record<string, { title: string; description: string }> = {
  '/': { title: `${SITE} — Ferramentas para o PristonTale EU`, description: HOME_DESC },
  '/timers/boss': { title: `Timer Boss — ${SITE}`, description: 'Saiba quando cada boss vai nascer no PristonTale EU.' },
  '/timers/fury': { title: `Timer Fury — ${SITE}`, description: 'Acompanhe o horário dos Furys do PristonTale EU.' },
  '/souls': { title: `Árvore de Souls — ${SITE}`, description: 'Monte e otimize a sua build de souls do PristonTale EU.' },
  '/skills': { title: `Construtor de Skills — ${SITE}`, description: 'Distribua Skill Points e Elite Points, monte a barra de skills e compartilhe a sua build.' },
  '/mixing': { title: `Fórmulas de Mixing — ${SITE}`, description: 'Fórmulas de mixing do PristonTale EU sempre à mão.' },
  '/sod': { title: `Survive or Die — ${SITE}`, description: 'Meça o seu desempenho no Survive or Die do PristonTale EU.' },
  '/wardrobe': { title: `Armário — ${SITE}`, description: 'Guarde e compartilhe os seus personagens do PristonTale EU.' },
  '/builds': { title: `Builds da Comunidade — ${SITE}`, description: 'Salve as suas builds de skills e souls na conta, compartilhe com a comunidade e veja o que os outros jogadores montaram.' },
    '/aging': { title: `Calculadora de Aging — ${SITE}`, description: 'Calcule quantos sheltoms e quanto gold você vai gastar para envelhecer armas, armaduras, robes, escudos e orbs.' },
  '/sharing': { title: `Compartilhamento de Tela — ${SITE}`, description: 'Mostre o seu jogo para os amigos, direto pelo navegador, de graça e sem instalar nada.' },
  '/marketplace': { title: `Marketplace — ${SITE}`, description: 'Compre e venda itens do PristonTale EU com a comunidade.' },
  '/guides': { title: `Guias — ${SITE}`, description: 'Vídeos e guias para o seu jogo no PristonTale EU.' },
  '/streamers': { title: `Streamers — ${SITE}`, description: 'Veja quem está transmitindo o PristonTale EU.' },
};

const CLASS_NAMES: Record<string, string> = {
  fighter: 'Fighter', archer: 'Archer', mechanician: 'Mechanician', assassin: 'Assassin', pikeman: 'Pikeman',
  knight: 'Knight', shaman: 'Shaman', priestess: 'Priestess', magician: 'Magician', atalanta: 'Atalanta',
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Sum of skill ranks in a build code (see lib/skilltree/buildCode.ts): 1 byte of quest bits, then 4 bits per skill. */
export function buildStats(encoded: string): { sp: number; ep: number } | null {
  if (!/^[A-Za-z0-9_-]{2,24}$/.test(encoded)) return null; // Buffer would happily decode garbage
  try {
    const bytes = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (bytes.length < 2 || bytes.length > 12) return null;
    const ranks: number[] = [];
    for (let i = 1; i < bytes.length; i++) ranks.push(bytes[i] >> 4, bytes[i] & 0xf);
    // Every class has 12 Tier 1-3 skills (Skill Points) followed by 4 Tier 4 skills (Elite Points).
    const sp = ranks.slice(0, 12).reduce((a, b) => a + b, 0);
    const ep = ranks.slice(12, 16).reduce((a, b) => a + b, 0);
    return { sp: Math.min(sp, 120), ep: Math.min(ep, 40) };
  } catch {
    return null;
  }
}

function clean(text: unknown, max: number): string {
  return typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function buildMeta(rawPath: string, query: Record<string, unknown> = {}): PageMeta {
  const lower = (rawPath.split('?')[0] || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const page = (path: string, image = '/pristonzone-logo.png'): PageMeta => ({ ...(PAGES[path] ?? PAGES['/']), image, path });

  // A shared skill build: /skill-tree/<class>?level=&build=&name=
  const skill = lower.match(/^\/skill-tree\/([a-z]+)$/);
  if (skill && CLASS_NAMES[skill[1]]) {
    const className = CLASS_NAMES[skill[1]];
    const level = Math.max(1, Math.min(120, Math.floor(Number(query.level)) || 1));
    const name = clean(query.name, 40);
    const stats = typeof query.build === 'string' ? buildStats(query.build) : null;
    const points = stats ? ` ${stats.sp} Skill Points e ${stats.ep} Elite Points distribuídos.` : '';
    return {
      title: `${name ? `${name} — ` : ''}Build de ${className} nível ${level} — ${SITE}`,
      description: `Build de ${className} (nível ${level}) no Construtor de Skills.${points} Abra, ajuste e monte a sua.`,
      image: `/wardrobe/classes/${skill[1]}.png`,
      path: `/skill-tree/${skill[1]}`,
    };
  }

  // A shared screen room: don't reveal anything about it, just invite.
  if (/^\/sala\/[a-z0-9]+$/.test(lower)) {
    return { title: `Sala de Compartilhamento de Tela — ${SITE}`, description: 'Você foi convidado para assistir a um jogo ao vivo. Entre direto pelo navegador, sem instalar nada.', image: '/pristonzone-logo.png', path: lower };
  }

  if (lower.startsWith('/char/')) {
    return { title: `Personagem — ${SITE}`, description: 'Ficha de personagem do PristonTale EU: equipamentos e souls.', image: '/pristonzone-logo.png', path: lower };
  }

  return page(PAGES[lower] ? lower : '/');
}

/** Puts the page's own title and Open Graph tags into the app's index.html. */
export function injectMeta(html: string, meta: PageMeta, origin: string): string {
  const url = `${origin}${meta.path}`;
  const image = `${origin}${meta.image}`;
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const tags = [
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="pt_BR" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join('\n    ');
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${t}</title>`)
    : html.replace('</head>', () => `<title>${t}</title></head>`);
  return withTitle.replace('</head>', () => `    ${tags}\n  </head>`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proto = String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0];
  const origin = `${proto}://${host}`;
  const { path, ...query } = req.query as Record<string, unknown>;
  const meta = buildMeta(typeof path === 'string' ? path : '/', query);
  try {
    const page = await fetch(`${origin}/index.html`);
    if (!page.ok) throw new Error(`index.html ${page.status}`);
    const html = injectMeta(await page.text(), meta, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch {
    // Never leave a crawler without a page. The static file is not routed back here (it has a dot in its name).
    res.setHeader('Location', `${origin}/index.html`);
    return res.status(302).end();
  }
}
