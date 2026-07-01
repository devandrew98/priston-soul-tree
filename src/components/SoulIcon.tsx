import type { Soul } from '../lib/types';

const CAT_COLOR: Record<string, string> = {
  attack: 'var(--attack)',
  defense: 'var(--defense)',
  support: 'var(--support)',
  pvp: 'var(--pvp)',
};

export function SoulIcon({ soul, size = 32 }: { soul: Soul; size?: number }) {
  if (soul.img) {
    return (
      <img
        src={soul.img}
        alt={soul.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: CAT_COLOR[soul.category] ?? '#555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: '#fff',
      }}
    >
      {soul.name[0]}
    </div>
  );
}
