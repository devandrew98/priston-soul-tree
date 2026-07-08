// Editable avatar: shows the current avatar with a 📷 badge; uploading a
// PNG/BMP/JPG/WebP center-crops it to a 256×256 PNG, stores it and refreshes.
import { useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { updateAvatar, uploadToBucket } from '../../lib/market/auth';
import { squareThumbnail } from '../../lib/market/image';
import { refreshProfile } from './session';
import { Avatar } from './parts';

export function AvatarEditor({ userId, avatar, size = 'xxl' }: { userId: string; avatar: string; size?: 'lg' | 'xxl' | '' }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [override, setOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (file?: File) => {
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) { setErr(t('mk.profile.avatarerr')); return; }
    setErr(''); setBusy(true);
    try {
      const square = await squareThumbnail(file, 256);
      const url = await uploadToBucket('avatars', userId, square);
      await updateAvatar(userId, url);
      setOverride(url);
      refreshProfile();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mk-profile-avatar editable">
      <Avatar value={override || avatar} size={size} />
      <button className="mk-avatar-edit" onClick={() => fileRef.current?.click()} disabled={busy} title={t('mk.profile.changeavatar')}>
        {busy ? '⏳' : '📷'}
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/bmp,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {err && <div className="mk-profile-avatar-hint"><span className="mk-auth-err">✕ {err}</span></div>}
    </div>
  );
}
