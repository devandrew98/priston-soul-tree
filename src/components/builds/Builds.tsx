// "Builds da Comunidade": my saved builds + the public gallery, for Skills and Souls.
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { requestLogin } from '../../lib/builds/account';
import {
  BuildsUnavailableError, getBuildsRepo, openUrlFor, type BuildKind, type GallerySort, type UserBuild,
} from '../../lib/builds/userBuilds';
import { ALL_CLASSES } from '../../lib/skilltree/classes';
import type { ClassSlug } from '../../lib/skilltree/types';
import { Loading } from '../Loading';
import { useBuildsAccount } from './useBuildsAccount';

type LoadState = { status: 'loading' } | { status: 'ready'; items: UserBuild[] } | { status: 'unavailable' } | { status: 'error' };

function useBuildList(load: () => Promise<UserBuild[]>, deps: unknown[]): [LoadState, (fn: (items: UserBuild[]) => UserBuild[]) => void, () => void] {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load()
      .then((items) => { if (!cancelled) setState({ status: 'ready', items }); })
      .catch((e) => { if (!cancelled) setState({ status: e instanceof BuildsUnavailableError ? 'unavailable' : 'error' }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const update = (fn: (items: UserBuild[]) => UserBuild[]) => setState((cur) => (cur.status === 'ready' ? { status: 'ready', items: fn(cur.items) } : cur));
  return [state, update, () => setNonce((n) => n + 1)];
}

const KINDS: { kind: BuildKind; icon: string; nameKey: string; descKey: string }[] = [
  { kind: 'souls', icon: '🌳', nameKey: 'nav.soultree', descKey: 'bd.kind.souls.desc' },
  { kind: 'skills', icon: '🌟', nameKey: 'nav.skilltree', descKey: 'bd.kind.skills.desc' },
];

export function Builds() {
  const { t } = useI18n();
  const [kind, setKind] = useState<BuildKind>('souls'); // Soul Tree first, Skill Builder second
  const [version, setVersion] = useState(0); // bumped when my builds change, so the gallery below reloads
  return (
    <div className="bd-tool">
      <header className="sk-head">
        <h1 className="mk-h1">🏆 {t('bd.title')}</h1>
        <p className="mk-muted">{t('bd.subtitle')}</p>
      </header>
      <div className="bd-kinds" role="tablist" aria-label={t('bd.kind.label')}>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            className={`bd-kind${kind === k.kind ? ' on' : ''}`}
            onClick={() => setKind(k.kind)}
          >
            <span className="bd-kind-icon" aria-hidden="true">{k.icon}</span>
            <span className="bd-kind-text">
              <b>{t(k.nameKey)}</b>
              <em>{t(k.descKey)}</em>
            </span>
          </button>
        ))}
      </div>
      <p className="bd-viewing">{t('bd.viewing')} <b>{t(kind === 'souls' ? 'nav.soultree' : 'nav.skilltree')}</b></p>
      <MyBuilds kind={kind} onChanged={() => setVersion((v) => v + 1)} />
      <Gallery kind={kind} version={version} />
    </div>
  );
}

function Notice({ state }: { state: LoadState }) {
  const { t } = useI18n();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'unavailable') return <p className="sk-notice">{t('bd.unavailable')}</p>;
  if (state.status === 'error') return <p className="sk-notice">{t('bd.error')}</p>;
  return null;
}

function MyBuilds({ kind, onChanged }: { kind: BuildKind; onChanged: () => void }) {
  const { t } = useI18n();
  const { loggedIn } = useBuildsAccount();
  const [state, update] = useBuildList(() => (loggedIn ? getBuildsRepo().listMine(kind) : Promise.resolve([])), [kind, loggedIn]);

  const togglePublic = async (b: UserBuild) => {
    update((items) => items.map((x) => (x.id === b.id ? { ...x, isPublic: !x.isPublic } : x)));
    try { await getBuildsRepo().setPublic(b.id, !b.isPublic); onChanged(); } catch { update((items) => items.map((x) => (x.id === b.id ? { ...x, isPublic: b.isPublic } : x))); }
  };
  const remove = async (b: UserBuild) => {
    if (!window.confirm(t('bd.delete.confirm', { name: b.name }))) return;
    try { await getBuildsRepo().remove(b.id); update((items) => items.filter((x) => x.id !== b.id)); onChanged(); } catch { /* the list stays as it was */ }
  };

  return (
    <section className="bd-section">
      <h2 className="mk-h2">📁 {t('bd.mine.title')}</h2>
      {!loggedIn ? (
        <div className="sr-card">
          <p className="mk-muted">{t('bd.mine.login')}</p>
          <button type="button" className="mk-btn primary" onClick={requestLogin}>👤 {t('mk.auth.login')}</button>
        </div>
      ) : (
        <>
          <Notice state={state} />
          {state.status === 'ready' && (state.items.length === 0
            ? <p className="mk-muted">{kind === 'skills' ? t('bd.mine.empty.skills') : t('bd.mine.empty.souls')}</p>
            : (
              <ul className="bd-list">
                {state.items.map((b) => (
                  <BuildRow key={b.id} build={b}>
                    <button type="button" className="mk-btn sm" onClick={() => togglePublic(b)} title={b.isPublic ? t('bd.public.on.hint') : t('bd.public.off.hint')}>
                      {b.isPublic ? `🌐 ${t('bd.public.on')}` : `🔒 ${t('bd.public.off')}`}
                    </button>
                    <button type="button" className="mk-btn sm" onClick={() => remove(b)}>🗑 {t('bd.delete')}</button>
                  </BuildRow>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  );
}

function Gallery({ kind, version }: { kind: BuildKind; version: number }) {
  const { t } = useI18n();
  const { loggedIn } = useBuildsAccount();
  const [classSlug, setClassSlug] = useState<ClassSlug | ''>('');
  const [sort, setSort] = useState<GallerySort>('likes');
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const repo = getBuildsRepo();
    const items = await repo.listPublic(kind, { classSlug: kind === 'skills' && classSlug ? classSlug : undefined, sort });
    const ids = loggedIn ? await repo.likedIds(items.map((b) => b.id)).catch(() => new Set<string>()) : new Set<string>();
    setLiked(ids);
    return items;
  }, [kind, classSlug, sort, loggedIn, version]);
  const [state, update] = useBuildList(load, [load]);

  const toggleLike = async (b: UserBuild) => {
    if (!loggedIn) { requestLogin(); return; }
    const on = !liked.has(b.id);
    setLiked((cur) => { const next = new Set(cur); if (on) next.add(b.id); else next.delete(b.id); return next; });
    update((items) => items.map((x) => (x.id === b.id ? { ...x, likes: Math.max(0, x.likes + (on ? 1 : -1)) } : x)));
    try { await getBuildsRepo().setLiked(b.id, on); } catch {
      setLiked((cur) => { const next = new Set(cur); if (on) next.delete(b.id); else next.add(b.id); return next; });
      update((items) => items.map((x) => (x.id === b.id ? { ...x, likes: Math.max(0, x.likes + (on ? -1 : 1)) } : x)));
    }
  };

  return (
    <section className="bd-section">
      <h2 className="mk-h2">🌐 {t('bd.gallery.title')}</h2>
      <div className="bd-filters">
        {kind === 'skills' && (
          <label className="mk-field">
            <span>{t('sk.class')}</span>
            <select value={classSlug} onChange={(e) => setClassSlug(e.target.value as ClassSlug | '')}>
              <option value="">{t('bd.gallery.allclasses')}</option>
              {ALL_CLASSES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="mk-field">
          <span>{t('bd.gallery.sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as GallerySort)}>
            <option value="likes">{t('bd.gallery.sort.likes')}</option>
            <option value="new">{t('bd.gallery.sort.new')}</option>
          </select>
        </label>
      </div>
      <Notice state={state} />
      {state.status === 'ready' && (state.items.length === 0
        ? <p className="mk-muted">{t('bd.gallery.empty')}</p>
        : (
          <ul className="bd-list">
            {state.items.map((b) => (
              <BuildRow key={b.id} build={b} showAuthor>
                <button type="button" className={`mk-btn sm bd-like${liked.has(b.id) ? ' on' : ''}`} aria-pressed={liked.has(b.id)} onClick={() => toggleLike(b)} title={t('bd.like')}>
                  {liked.has(b.id) ? '♥' : '♡'} {b.likes}
                </button>
              </BuildRow>
            ))}
          </ul>
        ))}
    </section>
  );
}

function BuildRow({ build, showAuthor = false, children }: { build: UserBuild; showAuthor?: boolean; children?: React.ReactNode }) {
  const { t } = useI18n();
  const url = openUrlFor(build);
  const cls = build.classSlug ? ALL_CLASSES.find((c) => c.slug === build.classSlug) : undefined;
  return (
    <li className="bd-item">
      {build.classSlug ? <img className="sk-class-icon" src={`/skilltree/classes/${build.classSlug}.png`} alt="" /> : <span className="bd-item-glyph" aria-hidden="true">🌳</span>}
      <span className="bd-item-info">
        <b>{build.name}</b>
        <em>
          {[cls?.name, build.level ? `${t('sk.level')} ${build.level}` : '', build.summary, showAuthor && build.authorNick ? `${t('bd.by')} ${build.authorNick}` : ''].filter(Boolean).join(' · ')}
        </em>
      </span>
      <span className="bd-item-actions">
        {children}
        {url && <a className="mk-btn sm primary" href={url}>▶ {t('bd.open')}</a>}
      </span>
    </li>
  );
}
