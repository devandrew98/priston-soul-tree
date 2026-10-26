// A tiny, safe rich-text format for news bodies.
//
//   **bold**   *italic*   __underline__   ~~strikethrough~~   ==highlight==
//   [text](https://link)
//   # Title      ## Subtitle
//   - bullet     1. numbered
//   ---          (divider line)
//
// The text is stored as-is in the existing `body` column. It is turned into React elements by
// <RichText> — never into HTML — so there is nothing to inject, and old plain-text news keep working
// (a "- item" line simply becomes a real bullet now).

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'b' | 'i' | 'u' | 's' | 'mark'; c: Inline[] }
  | { t: 'a'; href: string; c: Inline[] };

export type Block =
  | { t: 'p' | 'h1' | 'h2'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'hr' };

type InlineType = 'a' | 'b' | 'u' | 's' | 'mark' | 'i';
const RULES: { type: InlineType; re: RegExp }[] = [
  { type: 'a', re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/ },
  { type: 'b', re: /\*\*([^\n]+?)\*\*/ },
  { type: 'u', re: /__([^\n]+?)__/ },
  { type: 's', re: /~~([^\n]+?)~~/ },
  { type: 'mark', re: /==([^\n]+?)==/ },
  { type: 'i', re: /\*([^\s*][^\n*]*?)\*/ },
];

const MAX_DEPTH = 6;

/** Inline markup of ONE line (no newlines). The earliest marker wins; its inside is parsed again. */
export function parseInline(src: string, depth = 0): Inline[] {
  if (!src) return [];
  if (depth > MAX_DEPTH) return [{ t: 'text', v: src }];

  let best: { index: number; m: RegExpExecArray; type: InlineType } | null = null;
  for (const rule of RULES) {
    const m = rule.re.exec(src);
    if (m && (!best || m.index < best.index)) best = { index: m.index, m, type: rule.type };
  }
  if (!best) return [{ t: 'text', v: src }];

  const out: Inline[] = [];
  if (best.index > 0) out.push({ t: 'text', v: src.slice(0, best.index) });
  const inner = parseInline(best.m[1], depth + 1);
  if (best.type === 'a') out.push({ t: 'a', href: best.m[2], c: inner });
  else out.push({ t: best.type, c: inner });
  out.push(...parseInline(src.slice(best.index + best.m[0].length), depth));
  return out;
}

function joinLines(lines: string[]): Inline[] {
  const out: Inline[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ t: 'br' });
    out.push(...parseInline(line));
  });
  return out;
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let openList: 'ul' | 'ol' | null = null; // the list the previous line belonged to

  const flush = () => {
    if (paragraph.length) blocks.push({ t: 'p', c: joinLines(paragraph) });
    paragraph = [];
  };

  for (const line of lines) {
    const text = line.trim();
    if (!text) { flush(); openList = null; continue; }

    if (/^-{3,}$/.test(text)) { flush(); openList = null; blocks.push({ t: 'hr' }); continue; }

    const heading = /^(#{1,2})\s+(.+)$/.exec(text);
    if (heading) {
      flush(); openList = null;
      blocks.push({ t: heading[1].length === 1 ? 'h1' : 'h2', c: parseInline(heading[2]) });
      continue;
    }

    const bullet = /^[-•]\s+(.+)$/.exec(text) ?? /^\*\s+(.+)$/.exec(text);
    const numbered = bullet ? null : /^\d+[.)]\s+(.+)$/.exec(text);
    const listType: 'ul' | 'ol' | null = bullet ? 'ul' : numbered ? 'ol' : null;
    if (listType) {
      flush();
      const item = parseInline((bullet ?? numbered)![1]);
      const last = blocks[blocks.length - 1];
      if (openList === listType && last && (last.t === 'ul' || last.t === 'ol') && last.t === listType) last.items.push(item);
      else blocks.push({ t: listType, items: [item] });
      openList = listType;
      continue;
    }

    openList = null;
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** True for addresses we are willing to link to. */
export function isSafeUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

// ---- editing helpers (the toolbar of the admin editor) ---------------------------------

export interface Edit { text: string; start: number; end: number }

/** Wraps the selection in `before`/`after` (or removes them when it is already wrapped). */
export function wrapSelection(text: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
  const selected = text.slice(start, end);
  const around = text.slice(Math.max(0, start - before.length), start) === before && text.slice(end, end + after.length) === after;
  if (around) {
    const next = text.slice(0, start - before.length) + selected + text.slice(end + after.length);
    return { text: next, start: start - before.length, end: end - before.length };
  }
  const inner = selected || placeholder;
  const next = text.slice(0, start) + before + inner + after + text.slice(end);
  return { text: next, start: start + before.length, end: start + before.length + inner.length };
}

/** Adds (or, if every selected line already has it, removes) a line prefix such as "- " or "# ". */
export function toggleLinePrefix(text: string, start: number, end: number, prefix: string | ((index: number) => string), strip: RegExp): Edit {
  // A selection that ends right at the start of a line does not include that line.
  const effectiveEnd = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', effectiveEnd);
  if (lineEnd === -1) lineEnd = text.length;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  const allHave = nonEmpty.length > 0 && nonEmpty.every((l) => strip.test(l));
  let n = 0;
  const changed = lines.map((line) => {
    if (!line.trim()) return line;
    const bare = line.replace(strip, '');
    if (allHave) return bare;
    const p = typeof prefix === 'function' ? prefix(n) : prefix;
    n += 1;
    return p + bare;
  });
  const replaced = changed.join('\n');
  return { text: text.slice(0, lineStart) + replaced + text.slice(lineEnd), start: lineStart, end: lineStart + replaced.length };
}

/** Turns the selection into [selection](url), or inserts a placeholder link. */
export function insertLink(text: string, start: number, end: number, url: string): Edit {
  const label = text.slice(start, end) || 'texto do link';
  const md = `[${label}](${url})`;
  return { text: text.slice(0, start) + md + text.slice(end), start: start + 1, end: start + 1 + label.length };
}

/** Puts a divider on its own line after the cursor. */
export function insertDivider(text: string, pos: number): Edit {
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const insert = `${lead}---\n\n`;
  const at = before.length + insert.length;
  return { text: before + insert + after, start: at, end: at };
}
