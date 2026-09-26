// Standalone public page at /char/<slug> — read-only, no login required.
// Rendered outside the normal app shell (see App.tsx's pathname check).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { fetchCharacterBySlug } from '../../lib/wardrobe/characters';
import { fetchWardrobeItems } from '../../lib/wardrobe/items';
import type { WardrobeCharacter, WardrobeItem } from '../../lib/wardrobe/types';
import { CharacterSummary } from './CharacterSummary';

export function CharacterPublicPage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const [character, setCharacter] = useState<WardrobeCharacter | null | undefined>(undefined); // undefined = loading
  const [itemsById, setItemsById] = useState<Map<number, WardrobeItem>>(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCharacterBySlug(slug), fetchWardrobeItems()]).then(([c, items]) => {
      if (cancelled) return;
      setCharacter(c);
      setItemsById(new Map(items.map((i) => [i.id, i])));
    }).catch(() => { if (!cancelled) setCharacter(null); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="wd-public-page">
      <a className="wd-public-brand" href="/">⚔️ PristonZONE</a>
      {character === undefined ? (
        <p className="mk-empty">⏳ {t('mk.loading')}</p>
      ) : character === null ? (
        <p className="mk-empty">{t('wd.notfound')}</p>
      ) : (
        <CharacterSummary character={character} itemsById={itemsById} full />
      )}
    </div>
  );
}
