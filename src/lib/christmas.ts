// Christmas decoration: only small details (snow, a garland under the menu, a Santa hat on the logo, a line in the home footer).
// It turns itself on from 15 November and off after 6 January, so nobody has to remember to remove it; the administrator can also switch it off (Admin > Site).

/** Whether `d` falls in the Christmas season: 15 Nov – 6 Jan (local time). */
export function isChristmasSeason(d: Date = new Date()): boolean {
  const m = d.getMonth(); // 0 = Jan
  const day = d.getDate();
  return (m === 10 && day >= 15) || m === 11 || (m === 0 && day <= 6);
}

/** Site flag the administrator flips to hide the decoration even inside the season. */
export const CHRISTMAS_FLAG = 'christmas_theme';
/** Fired by the admin switch (detail = new value) so the decoration changes without a reload. */
export const CHRISTMAS_EVENT = 'pz-christmas';

/** How many snowflakes for a screen of this size (fewer on phones, never many). */
export function flakeCount(width: number, height: number): number {
  return Math.max(18, Math.min(60, Math.round((width * height) / 30000)));
}
