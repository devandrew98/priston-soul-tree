// Draws the "Sugestão da Barra de Skill" as a PNG the player can post on Discord/WhatsApp.
// The game's skill icons are fetched with CORS enabled (pristonzone.eu's CDN allows it), so the
// canvas stays exportable; if an icon can't be loaded its slot is drawn empty rather than failing.
import { getSkill } from './classes';
import { SKILL_BAR_KEYS, type SkillBar } from './skillBar';
import type { ClassSlug } from './types';

const PER_ROW = 9;
const SLOT = 72;
const GAP = 8;
const PAD = 36;
const HEADER = 92;
const FOOTER = 44;

export interface BarImageInfo {
  classSlug: ClassSlug;
  className: string;
  level: number;
  buildName: string;
  bar: SkillBar;
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('30px "IM Fell English SC"'),
      document.fonts.load('18px "IM Fell English"'),
    ]);
  } catch { /* fall back to Georgia */ }
}

export async function renderSkillBarImage(info: BarImageInfo): Promise<Blob | null> {
  await fontsReady();
  const rows = Math.ceil(SKILL_BAR_KEYS.length / PER_ROW);
  const width = PAD * 2 + PER_ROW * SLOT + (PER_ROW - 1) * GAP;
  const height = HEADER + rows * SLOT + (rows - 1) * GAP + FOOTER + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // background + double gold frame
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#1d1611');
  bg.addColorStop(1, '#0b0806');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#a88a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.strokeStyle = 'rgba(168,138,74,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  const [emblem, frame] = await Promise.all([loadImage(`/skilltree/classes/${info.classSlug}.png`, false), loadImage('/skilltree/skillbar-slot.png', false)]);

  // header: emblem + title + subtitle
  if (emblem) ctx.drawImage(emblem, PAD, 30, 56, 48);
  const textX = PAD + (emblem ? 72 : 0);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f0d28a';
  ctx.font = '30px "IM Fell English SC", Georgia, serif';
  ctx.fillText((info.buildName.trim() || 'Sugestão da barra de skill').slice(0, 44), textX, 54);
  ctx.fillStyle = '#a89878';
  ctx.font = '19px "IM Fell English", Georgia, serif';
  ctx.fillText(`${info.className} — Nível ${info.level}`, textX, 80);

  // icons (CORS) loaded in parallel
  const icons = await Promise.all(info.bar.map(async (id) => {
    const skill = id ? getSkill(id) : undefined;
    return skill ? loadImage(skill.icon, true) : null;
  }));

  SKILL_BAR_KEYS.forEach((key, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = PAD + col * (SLOT + GAP);
    const y = HEADER + row * (SLOT + GAP);
    ctx.fillStyle = 'rgba(10,9,8,0.7)';
    ctx.fillRect(x, y, SLOT, SLOT);
    const icon = icons[i];
    if (icon) ctx.drawImage(icon, x + 8, y + 8, SLOT - 16, SLOT - 16);
    if (frame) ctx.drawImage(frame, x, y, SLOT, SLOT);
    else { ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, SLOT - 2, SLOT - 2); }
    // key label, top-left, readable on any icon
    ctx.font = 'bold 14px "Trebuchet MS", Verdana, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(key, x + 7, y + 17);
    ctx.fillStyle = '#fff';
    ctx.fillText(key, x + 7, y + 17);
  });

  ctx.fillStyle = '#a88a4a';
  ctx.font = '17px "IM Fell English", Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('pristonzone.com', width - PAD, height - PAD + 6);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null); // tainted canvas
    }
  });
}
