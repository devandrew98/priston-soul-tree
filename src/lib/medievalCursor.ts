// Lets the medieval theme swap the mouse pointer on anything clickable.
//
// The site marks clickable things in dozens of places with `cursor: pointer` (links, buttons, cards...),
// so instead of listing selectors we ask the browser: when the mouse enters an element, if its own
// cursor is "pointer" we tag <html> with `mv-link`, and theme-medieval.css swaps in the pointing hand.
// The class is removed first so we always read the element's real (author) cursor, not our own.
const CLASS = 'mv-link';

export function initMedievalCursor(): void {
  const root = document.documentElement;
  const update = (target: EventTarget | null) => {
    root.classList.remove(CLASS);
    if (!(target instanceof Element)) return;
    if (getComputedStyle(target).cursor.startsWith('pointer')) root.classList.add(CLASS);
  };
  document.addEventListener('pointerover', (e) => update(e.target), { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove(CLASS), { passive: true });
}
