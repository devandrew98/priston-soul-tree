import type { ClassSlug } from '../../lib/skilltree/types';

/** The in-game class emblem (37x32) shown next to the class name. */
export const classIcon = (slug: ClassSlug): string => `/skilltree/classes/${slug}.png`;
