import type { Build, SlotState } from './types';

// Compact, URL-safe encoding of a build so it can be shared via a link.
// Only filled slots are stored to keep the link short.
// Node rarity is fixed by tree position, so it is not encoded.
// Tuple layout: [slotId, soulId, soulLevel, nodeLevel]
type SlotTuple = [string, string, number, number];
interface SharePayload {
  n: string;
  s: SlotTuple[];
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeBuild(build: Build): string {
  const s: SlotTuple[] = [];
  for (const [id, slot] of Object.entries(build.slots)) {
    if (!slot.soulId) continue;
    s.push([id, slot.soulId, slot.soulLevel, slot.nodeLevel]);
  }
  const payload: SharePayload = { n: build.name, s };
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeBuild(code: string): { name: string; slots: Record<string, SlotState> } | null {
  try {
    const p = JSON.parse(base64UrlDecode(code)) as SharePayload;
    if (!p || !Array.isArray(p.s)) return null;
    const slots: Record<string, SlotState> = {};
    for (const [id, soulId, soulLevel, nodeLevel] of p.s) {
      slots[id] = {
        soulId,
        soulLevel: (soulLevel === 2 || soulLevel === 3 ? soulLevel : 1) as 1 | 2 | 3,
        nodeLevel: Math.max(1, Number(nodeLevel) || 1),
      };
    }
    return { name: p.n || 'Build importada', slots };
  } catch {
    return null;
  }
}

export function buildShareUrl(build: Build): string {
  return `${location.origin}${location.pathname}#b=${encodeBuild(build)}`;
}
