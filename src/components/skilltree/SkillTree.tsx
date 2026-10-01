// Skill Tree / Skill Builder — entirely client-side (no login, no backend):
// the build lives in the URL/localStorage, never in a database.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { ALL_CLASSES, getSkillClass, isClassSlug } from '../../lib/skilltree/classes';
import { SKILL_POINT_QUESTS } from '../../lib/skilltree/config';
import { buildDisplayCode, buildShareUrl, decodeBuild, encodeBuild } from '../../lib/skilltree/buildCode';
import {
  applySkillChange, getAvailableElitePoints, getAvailableSkillPoints, getMaxAllowedSkillLevel, sanitizeBuild, splitUsedPoints, validateBuild,
} from '../../lib/skilltree/rules';
import type { ClassSlug, Skill, SkillLevels } from '../../lib/skilltree/types';
import {
  decodeSkillBar, emptySkillBar, encodeSkillBar, sanitizeSkillBar, type SkillBar as Bar,
} from '../../lib/skilltree/skillBar';
import { SkillBook } from './SkillBook';
import { SkillBar } from './SkillBar';
import { SkillDetail } from './SkillDetail';
import { BuildSummary } from './BuildSummary';
import { classIcon } from './classIcon';

const STORAGE_KEY = 'skilltree-build';
const BUILD_NAME_MAX_LENGTH = 40;

function sanitizeBuildName(raw: string): string {
  return raw.trim().slice(0, BUILD_NAME_MAX_LENGTH);
}

interface StoredBuild { classSlug: ClassSlug; level: number; questIds: string[]; skillLevels: SkillLevels; buildName?: string; skillBar?: Bar }

function readInitial(): StoredBuild {
  // 1) A shared link (/skill-tree/<slug>?level=&build=) always wins.
  const path = window.location.pathname;
  if (path.startsWith('/skill-tree/')) {
    const slugRaw = path.slice('/skill-tree/'.length).replace(/\/$/, '');
    if (isClassSlug(slugRaw)) {
      const params = new URLSearchParams(window.location.search);
      const level = Number(params.get('level')) || 1;
      const encoded = params.get('build') || '';
      const buildName = sanitizeBuildName(params.get('name') || '');
      const { questIds, skillLevels } = encoded ? decodeBuild(slugRaw, encoded) : { questIds: [], skillLevels: {} };
      const validated = validateBuild({ classSlug: slugRaw, level, questIds, skillLevels });
      const skillBar = sanitizeSkillBar(validated.classSlug, validated.skillLevels, decodeSkillBar(validated.classSlug, params.get('bar') || ''));
      return { ...validated, buildName, skillBar };
    }
  }
  // 2) Otherwise, resume whatever was being built locally last time.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredBuild;
      const validated = validateBuild(parsed);
      const skillBar = sanitizeSkillBar(validated.classSlug, validated.skillLevels, Array.isArray(parsed.skillBar) ? parsed.skillBar : emptySkillBar());
      return { ...validated, buildName: sanitizeBuildName(parsed.buildName || ''), skillBar };
    }
  } catch { /* ignore */ }
  return { classSlug: 'fighter', level: 1, questIds: [], skillLevels: {}, buildName: '' };
}

export function SkillTree() {
  const { t } = useI18n();
  const init = useMemo(readInitial, []);
  const [classSlug, setClassSlug] = useState<ClassSlug>(init.classSlug);
  const [level, setLevel] = useState(init.level);
  const [questIds, setQuestIds] = useState<string[]>(init.questIds);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(init.skillLevels);
  const [buildName, setBuildName] = useState(init.buildName ?? '');
  const [notice, setNotice] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skillBar, setSkillBar] = useState<Bar>(init.skillBar ?? emptySkillBar());

  const cls = getSkillClass(classSlug);
  const spAvailable = getAvailableSkillPoints(level, questIds);
  const epAvailable = getAvailableElitePoints(level);
  const { skillPointsUsed, elitePointsUsed } = splitUsedPoints(classSlug, skillLevels);
  const spLeft = Math.max(0, spAvailable - skillPointsUsed);
  const epLeft = Math.max(0, epAvailable - elitePointsUsed);
  const selectedSkill = cls.tiers.flatMap((tier) => tier.skills).find((s) => s.id === selectedId) ?? null;

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(''), 3200); };

  // Persist locally (skip while a share link's params are still in the URL,
  // so re-opening the same tool later doesn't fight with someone else's build).
  useEffect(() => {
    if (window.location.pathname.startsWith('/skill-tree/')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ classSlug, level, questIds, skillLevels, buildName, skillBar }));
  }, [classSlug, level, questIds, skillLevels, buildName, skillBar]);

  // A skill that loses its last point (or belongs to another class) leaves the bar.
  useEffect(() => {
    setSkillBar((cur) => {
      const fixed = sanitizeSkillBar(classSlug, skillLevels, cur);
      return fixed.every((id, i) => id === cur[i]) ? cur : fixed;
    });
  }, [classSlug, skillLevels]);

  // Re-sanitize whenever level/quests/class change (e.g. lowering the level
  // can make some invested skills illegal) — auto-fix instead of blocking.
  useEffect(() => {
    setSkillLevels((cur) => {
      const fixed = sanitizeBuild(classSlug, level, questIds, cur);
      const before = JSON.stringify(Object.entries(cur).filter(([, v]) => v > 0).sort());
      const after = JSON.stringify(Object.entries(fixed).filter(([, v]) => v > 0).sort());
      if (before !== after) { flash(t('sk.autofixed')); return fixed; }
      return cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classSlug, level, questIds]);

  const setSkillLevel = (skillId: string, next: number) => {
    const result = applySkillChange(classSlug, level, questIds, skillLevels, skillId, next);
    const filledPrereq = Object.keys(result).some(
      (id) => id !== skillId && (skillLevels[id] ?? 0) === 0 && (result[id] ?? 0) > 0,
    );
    if (filledPrereq) flash(t('sk.chainfilled'));
    setSkillLevels(result);
  };

  // Every +/−/MAX goes through here: clamp to what the level allows and
  // refuse to go up when the skill's pool (SP or EP) is empty.
  const changeSkill = (skill: Skill, next: number) => {
    const lvl = skillLevels[skill.id] ?? 0;
    const remaining = skill.tier === 4 ? epLeft : spLeft;
    if (next > lvl && remaining <= 0) return;
    setSkillLevel(skill.id, Math.max(0, Math.min(next, getMaxAllowedSkillLevel(skill, level))));
  };

  const resetBuild = () => setSkillLevels({});
  const toggleQuest = (id: string) => setQuestIds((cur) => (cur.includes(id) ? cur.filter((q) => q !== id) : [...cur, id]));

  const barCode = encodeSkillBar(classSlug, skillBar);
  const doShare = () => {
    const url = buildShareUrl(classSlug, level, questIds, skillLevels, buildName, barCode);
    setShareUrl(url);
    window.history.replaceState(null, '', url);
  };
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl || buildShareUrl(classSlug, level, questIds, skillLevels, buildName, barCode)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  const encoded = encodeBuild(classSlug, questIds, skillLevels);
  const displayCode = buildDisplayCode(classSlug, level, encoded);

  return (
    <div className="sk-tool">
      <header className="sk-head">
        <h1 className="mk-h1">🌟 {t('sk.title')}</h1>
        <p className="mk-muted">{t('sk.subtitle')}</p>
      </header>

      <div className="sk-topbar">
        <label className="mk-field">
          <span>{t('sk.buildname')}</span>
          <input
            type="text"
            value={buildName}
            maxLength={BUILD_NAME_MAX_LENGTH}
            placeholder={t('sk.buildname.placeholder')}
            onChange={(e) => setBuildName(e.target.value)}
          />
        </label>
        <label className="mk-field sk-class-field">
          <span>{t('sk.class')}</span>
          <span className="sk-class-select">
            <img src={classIcon(classSlug)} alt="" className="sk-class-icon" />
            <select value={classSlug} onChange={(e) => { setClassSlug(e.target.value as ClassSlug); setSelectedId(null); }}>
              {ALL_CLASSES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </span>
        </label>
        <label className="mk-field">
          <span>{t('sk.level')}</span>
          <input type="number" min={1} max={120} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
        </label>
        <div className="sk-quests">
          <span className="sk-quests-title">{t('sk.quests.title')}</span>
          {SKILL_POINT_QUESTS.map((q) => (
            <label key={q.id} className="sk-quest-check">
              <input type="checkbox" checked={questIds.includes(q.id)} onChange={() => toggleQuest(q.id)} />
              {t(q.nameKey)} (+{q.points})
            </label>
          ))}
        </div>
      </div>

      <div className="sk-points-row">
        <div className="sk-points-panel sp">
          <b>{t('sk.points.skill')}</b>
          <span>{t('sk.points.used')}: {skillPointsUsed}</span>
          <span>{t('sk.points.available')}: {spLeft}</span>
          <span>{t('sk.points.total')}: {spAvailable}</span>
        </div>
        <div className="sk-points-panel ep">
          <b>{t('sk.points.elite')}</b>
          <span>{t('sk.points.used')}: {elitePointsUsed}</span>
          <span>{t('sk.points.available')}: {epLeft}</span>
          <span>{t('sk.points.total')}: {epAvailable}</span>
        </div>
      </div>
      {notice && <p className="sk-notice">{notice}</p>}

      <div className="sk-actions">
        <button className="mk-btn" onClick={resetBuild}>↺ {t('sk.reset')}</button>
        <button className="mk-btn primary" onClick={doShare}>🔗 {t('sk.share')}</button>
      </div>

      {shareUrl && (
        <div className="wd-sharebox">
          <p className="mk-muted">{t('sk.share.hint')}</p>
          <div className="wd-sharebox-row">
            <input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="mk-btn" onClick={copyLink}>{copied ? `✅ ${t('wd.share.copied')}` : `🔗 ${t('wd.share.copy')}`}</button>
          </div>
          <div className="wd-sharebox-row">
            <a className="mk-btn wa-btn" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(t('sk.share.waMsg', { cls: cls.name, url: shareUrl }))}`}>
              💚 WhatsApp
            </a>
            <button className="mk-btn" onClick={() => { navigator.clipboard?.writeText(shareUrl); flash(t('wd.share.copylinkfirst')); }}>🎮 Discord</button>
          </div>
          <div className="sk-buildcode">
            <span>{t('sk.buildcode')}: <b>{displayCode}</b></span>
            <button className="mk-btn sm" onClick={() => navigator.clipboard?.writeText(displayCode)}>{t('sk.buildcode.copy')}</button>
          </div>
        </div>
      )}

      <section className="sk-book-wrap">
        <h2 className="mk-h2 sk-book-class">
          <img src={classIcon(classSlug)} alt="" className="sk-class-icon" />
          {cls.name}
          <span className="sk-book-tiers">{cls.tiers.map((tier) => tier.name).join(' · ')}</span>
        </h2>
        <SkillBook
          cls={cls}
          skillLevels={skillLevels}
          characterLevel={level}
          spLeft={spLeft}
          epLeft={epLeft}
          selectedId={selectedId}
          onSelect={(skill) => setSelectedId(skill.id)}
          onStep={(skill, delta) => changeSkill(skill, (skillLevels[skill.id] ?? 0) + delta)}
          onMax={(skill) => changeSkill(skill, skill.maxLevel)}
        />
        <div className="sk-tips" role="note">
          <b className="sk-tips-title">💡 {t('sk.tips.title')}</b>
          <ul>
            <li><kbd>{t('sk.tips.click')}</kbd> <span>+1 {t('sk.tips.point')}</span></li>
            <li><kbd>{t('sk.tips.rightclick')}</kbd> <span>−1 {t('sk.tips.point')}</span></li>
            <li><kbd>Shift</kbd> + <kbd>{t('sk.tips.click')}</kbd> <span>{t('sk.tips.max')}</span></li>
          </ul>
          <p>{t('sk.tips.prereq')}</p>
          <p>{t('sk.tips.points')}</p>
        </div>
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            level={skillLevels[selectedSkill.id] ?? 0}
            characterLevel={level}
            hasBudget={(selectedSkill.tier === 4 ? epLeft : spLeft) > 0}
            onChange={(next) => changeSkill(selectedSkill, next)}
          />
        ) : (
          <p className="sk-detail-empty mk-muted">{t('sk.book.pick')}</p>
        )}
      </section>

      <SkillBar bar={skillBar} skillLevels={skillLevels} selectedSkill={selectedSkill} onChange={setSkillBar} />

      <BuildSummary
        classSlug={classSlug}
        buildName={buildName}
        className={cls.name}
        level={level}
        skillPoints={{ used: skillPointsUsed, total: spAvailable }}
        elitePoints={{ used: elitePointsUsed, total: epAvailable }}
        questIds={questIds}
        cls={cls}
        skillLevels={skillLevels}
      />
    </div>
  );
}
