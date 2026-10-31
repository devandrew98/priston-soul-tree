// Admin > Estatísticas: the site report (visits, visitors, countries, pages, where people come from, devices, languages, peak hours, measured clicks).
// The numbers come from the anonymous hits the site records (see lib/analytics.ts and supabase/42_site_analytics.sql).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import { Loading } from '../Loading';

interface Row { k: string; views: number; visitors: number }
interface Report {
  days: number;
  first_hit: string | null;
  totals: { views: number; visitors: number };
  today: { views: number; visitors: number };
  by_day: { d: string; views: number; visitors: number }[];
  pages: Row[]; countries: Row[]; refs: Row[]; devices: Row[]; langs: Row[]; events: Row[];
  hours: { h: number; views: number }[];
}

const TXT = {
  title: { pt: 'Estatísticas do site', en: 'Site statistics' },
  hint: { pt: 'Números anônimos: sem IP e sem nome. Contam as páginas abertas; o administrador não entra na conta. Dias no horário de Brasília.', en: 'Anonymous numbers: no IP and no name. They count pages opened; the administrator is not counted. Days in Brasília time.' },
  period: { pt: 'Período', en: 'Period' },
  days: { pt: 'dias', en: 'days' },
  views: { pt: 'Páginas abertas', en: 'Pages opened' },
  visitors: { pt: 'Visitantes (navegadores)', en: 'Visitors (browsers)' },
  todayViews: { pt: 'Páginas abertas hoje', en: 'Pages opened today' },
  todayVisitors: { pt: 'Visitantes hoje', en: 'Visitors today' },
  perVisitor: { pt: 'Páginas por visitante', en: 'Pages per visitor' },
  byDay: { pt: 'Por dia', en: 'By day' },
  pages: { pt: 'Páginas mais abertas', en: 'Most opened pages' },
  countries: { pt: 'Países', en: 'Countries' },
  refs: { pt: 'De onde vêm', en: 'Where they come from' },
  direct: { pt: 'Direto / não informado', en: 'Direct / unknown' },
  devices: { pt: 'Aparelho', en: 'Device' },
  langs: { pt: 'Idioma do site', en: 'Site language' },
  hours: { pt: 'Horário de pico (seu fuso)', en: 'Peak hours (your timezone)' },
  events: { pt: 'Cliques medidos', en: 'Measured clicks' },
  mobile: { pt: 'Celular', en: 'Phone' },
  desktop: { pt: 'Computador', en: 'Computer' },
  unknown: { pt: 'Desconhecido', en: 'Unknown' },
  visitorsShort: { pt: 'visitantes', en: 'visitors' },
  empty: { pt: 'Ainda não há dados neste período. Os números começam a aparecer depois que o site for aberto com a medição ativa.', en: 'There is no data in this period yet. Numbers start to appear once the site is opened with measuring on.' },
  since: { pt: 'Medindo desde', en: 'Measuring since' },
  notReady: { pt: 'As estatísticas ainda não estão ativas: rode o arquivo supabase/42_site_analytics.sql no Supabase.', en: 'Statistics are not active yet: run supabase/42_site_analytics.sql in Supabase.' },
  noBackend: { pt: 'Sem conexão com o banco neste ambiente.', en: 'No database connection in this environment.' },
  reload: { pt: 'Atualizar', en: 'Refresh' },
} as const;

const PAGE_NAMES: Record<string, { pt: string; en: string }> = {
  '/': { pt: 'Home', en: 'Home' },
  '/timers/boss': { pt: 'Timer Boss', en: 'Timer Boss' },
  '/timers/fury': { pt: 'Timer Fury', en: 'Timer Fury' },
  '/souls': { pt: 'Árvore de Souls', en: 'Soul Tree' },
  '/skills': { pt: 'Construtor de Skills', en: 'Skill Builder' },
  '/mixing': { pt: 'Mixing', en: 'Mixing' },
  '/sod': { pt: 'Survive or Die', en: 'Survive or Die' },
  '/wardrobe': { pt: 'Armário', en: 'Wardrobe' },
  '/builds': { pt: 'Builds da Comunidade', en: 'Community Builds' },
  '/sharing': { pt: 'Compartilhamento de Tela', en: 'Screen Sharing' },
  '/aging': { pt: 'Aging', en: 'Aging' },
  '/quests': { pt: 'Quest Tracker', en: 'Quest Tracker' },
  '/cla': { pt: 'Formação do Clã', en: 'Clan Formation' },
  '/marketplace': { pt: 'Marketplace', en: 'Marketplace' },
  '/guides': { pt: 'Guias', en: 'Guides' },
  '/streamers': { pt: 'Streamers', en: 'Streamers' },
  '/tutorial': { pt: 'Tutorial', en: 'Tutorial' },
  '/checklist': { pt: 'Checklist (celular)', en: 'Checklist (phone)' },
  '/leveling': { pt: 'Guia de leveling', en: 'Leveling guide' },
  '/char/*': { pt: 'Personagem (link público)', en: 'Character (public link)' },
  '/formacao/*': { pt: 'Formação (link do clã)', en: 'Formation (clan link)' },
  '/sala/*': { pt: 'Sala de tela', en: 'Screen room' },
  '/skill-tree/*': { pt: 'Build de skills (link)', en: 'Skill build (link)' },
};

const EVENT_NAMES: Record<string, { pt: string; en: string }> = {
  'quests:phone_link': { pt: 'Quest Tracker: “Levar para o celular”', en: 'Quest Tracker: “Take it to your phone”' },
  'tutorial:open_tool': { pt: 'Tutorial: botão “Abrir” a ferramenta', en: 'Tutorial: “Open” tool button' },
  'home:download_overlay': { pt: 'Home: baixar o Overlay Timer Boss', en: 'Home: download the Overlay Timer Boss' },
  'live:open': { pt: 'Selo “Ao vivo”: abriu uma live', en: '“Live” badge: opened a stream' },
  'lang:en': { pt: 'Trocou o site para inglês', en: 'Switched the site to English' },
  'lang:pt': { pt: 'Trocou o site para português', en: 'Switched the site to Portuguese' },
};

const PERIODS = [7, 30, 90, 365];

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** UTC hour rows -> 24 rows in the viewer's timezone. */
export function hoursLocal(hours: { h: number; views: number }[], offsetMinutes: number): number[] {
  const out = Array<number>(24).fill(0);
  const shift = Math.round(-offsetMinutes / 60);
  for (const { h, views } of hours) out[(((h + shift) % 24) + 24) % 24] += views;
  return out;
}

function Bars({ rows, label, unit }: { rows: Row[]; label: (k: string) => string; unit: string }) {
  const max = Math.max(...rows.map((r) => r.views), 1);
  return (
    <div className="ss-bars">
      {rows.map((r) => (
        <div key={r.k} className="ss-row" title={`${label(r.k)}: ${fmt(r.views)} · ${fmt(r.visitors)} ${unit}`}>
          <span className="ss-label">{label(r.k)}</span>
          <span className="ss-track"><i style={{ width: `${(r.views / max) * 100}%` }} /></span>
          <b>{fmt(r.views)}</b>
          <small>{fmt(r.visitors)} {unit}</small>
        </div>
      ))}
    </div>
  );
}

/** `load` is only for trying the screen with made-up numbers; the site uses the database. */
export function SiteStatsAdmin({ load }: { load?: (days: number) => Promise<Report> } = {}) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [days, setDays] = useState(30);
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!load && (!BACKEND_ENABLED || !supabase)) { setErr(T('noBackend')); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const run: Promise<{ data: Report | null; error: { message: string } | null }> = load
      ? load(days).then((data) => ({ data, error: null }))
      : Promise.resolve(supabase!.rpc('analytics_report', { p_days: days })) as Promise<{ data: Report | null; error: { message: string } | null }>;
    run.then(({ data, error }) => {
      if (cancelled) return;
      if (error) setErr(/analytics_report|function|schema cache/i.test(error.message) ? T('notReady') : error.message);
      else { setRep(data); setErr(''); }
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, tick, lang]);

  let regions: Intl.DisplayNames | null = null;
  try { regions = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* old browser: show the code */ }
  const country = (k: string) => {
    if (k === '??') return T('unknown');
    let name = k;
    try { name = regions?.of(k) ?? k; } catch { /* keep the code */ }
    return `${k} · ${name}`;
  };
  const page = (k: string) => {
    const n = PAGE_NAMES[k] ?? (k.startsWith('/tutorial/') ? { pt: `Tutorial: ${k.slice(10)}`, en: `Tutorial: ${k.slice(10)}` } : null);
    return n ? `${n[lang]} (${k})` : k;
  };

  const empty = rep && rep.totals.views === 0;
  const hours = rep ? hoursLocal(rep.hours, new Date().getTimezoneOffset()) : [];
  const maxHour = Math.max(...hours, 1);
  const maxDay = Math.max(...(rep?.by_day.map((d) => d.views) ?? [1]), 1);

  return (
    <div className="ss">
      <div className="ss-head">
        <h2 className="mk-h2">📊 {T('title')}</h2>
        <div className="ss-periods" role="group" aria-label={T('period')}>
          {PERIODS.map((d) => <button key={d} type="button" className={`mk-btn sm${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d} {T('days')}</button>)}
          <button type="button" className="mk-btn sm" onClick={() => setTick((n) => n + 1)}>↻ {T('reload')}</button>
        </div>
      </div>
      <p className="mk-muted">{T('hint')}</p>

      {loading && <Loading />}
      {err && <p className="mk-warn">{err}</p>}

      {rep && !loading && (
        <>
          {rep.first_hit && <p className="mk-muted">{T('since')}: {new Date(rep.first_hit).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-GB')}</p>}
          {empty ? <p className="mk-muted">{T('empty')}</p> : (
            <>
              <div className="mk-dash-stats">
                <div className="mk-kpi gold"><b>{fmt(rep.totals.views)}</b><span>{T('views')}</span></div>
                <div className="mk-kpi"><b>{fmt(rep.totals.visitors)}</b><span>{T('visitors')}</span></div>
                <div className="mk-kpi"><b>{fmt(rep.today.views)}</b><span>{T('todayViews')}</span></div>
                <div className="mk-kpi"><b>{fmt(rep.today.visitors)}</b><span>{T('todayVisitors')}</span></div>
                <div className="mk-kpi"><b>{rep.totals.visitors ? (rep.totals.views / rep.totals.visitors).toFixed(1).replace('.', ',') : '–'}</b><span>{T('perVisitor')}</span></div>
              </div>

              <section className="sr-card ss-card">
                <h3 className="mk-h2">{T('byDay')}</h3>
                <div className="ss-days">
                  {rep.by_day.map((d) => (
                    <div key={d.d} className="ss-day" title={`${d.d}: ${fmt(d.views)} · ${fmt(d.visitors)} ${T('visitorsShort')}`}>
                      <i style={{ height: `${Math.max(3, (d.views / maxDay) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <small className="mk-muted">{rep.by_day[0]?.d} → {rep.by_day[rep.by_day.length - 1]?.d}</small>
              </section>

              <div className="ss-grid">
                <section className="sr-card ss-card"><h3 className="mk-h2">{T('pages')}</h3><Bars rows={rep.pages} label={page} unit={T('visitorsShort')} /></section>
                <section className="sr-card ss-card"><h3 className="mk-h2">{T('countries')}</h3><Bars rows={rep.countries} label={country} unit={T('visitorsShort')} /></section>
                <section className="sr-card ss-card"><h3 className="mk-h2">{T('refs')}</h3><Bars rows={rep.refs} label={(k) => k || T('direct')} unit={T('visitorsShort')} /></section>
                <section className="sr-card ss-card">
                  <h3 className="mk-h2">{T('devices')}</h3>
                  <Bars rows={rep.devices} label={(k) => (k === 'mobile' ? T('mobile') : k === 'desktop' ? T('desktop') : T('unknown'))} unit={T('visitorsShort')} />
                  <h3 className="mk-h2">{T('langs')}</h3>
                  <Bars rows={rep.langs} label={(k) => (k === 'pt' ? 'Português' : k === 'en' ? 'English' : T('unknown'))} unit={T('visitorsShort')} />
                </section>
                {rep.events.length > 0 && (
                  <section className="sr-card ss-card"><h3 className="mk-h2">{T('events')}</h3><Bars rows={rep.events} label={(k) => EVENT_NAMES[k]?.[lang] ?? k} unit={T('visitorsShort')} /></section>
                )}
              </div>

              <section className="sr-card ss-card">
                <h3 className="mk-h2">{T('hours')}</h3>
                <div className="ss-hours">
                  {hours.map((v, h) => (
                    <div key={h} className="ss-hour" title={`${String(h).padStart(2, '0')}h: ${fmt(v)}`}>
                      <i style={{ height: `${Math.max(3, (v / maxHour) * 100)}%` }} />
                      <small>{h % 3 === 0 ? h : ''}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
