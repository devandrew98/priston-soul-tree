// pristonzone.com/dor: a private pain diary. It shares only the domain and the database project with the rest of the site.
// Access is a long secret in the link (#k=...), checked by the server on every call; there is no login and no public data.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DOR_FAKE, deriveSecret, forgetSecret, memoryApi, readSecret, storeSecret, supabaseApi } from '../../lib/dor/api';
import { useDorStore, type DorStore } from '../../lib/dor/store';
import type { Crisis, MedAdmin, Rec } from '../../lib/dor/types';
import './dor.css';
import { CrisisForm, EditRecord, EndForm, IntensityForm, MedAdminForm, SleepForm, SymptomForm } from './forms';
import { History } from './History';
import { Home } from './Home';
import { Meds } from './Meds';
import { Reports } from './Reports';
import { SettingsSheet } from './Settings';
import type { SheetState } from './sheets';
import { Sheet } from './ui';

type Tab = 'home' | 'history' | 'meds' | 'reports';
const TABS: [Tab, string, string][] = [['home', 'Início', '🏠'], ['history', 'Histórico', '📅'], ['meds', 'Medicamentos', '💊'], ['reports', 'Relatórios', '📊']];

/** Header tags of the page: private, not indexed, no referrer. */
function usePrivateHead() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Diário de Dor – Adolpho';
    const tags = [['robots', 'noindex, nofollow, noarchive'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); return m;
    });
    return () => { document.title = prevTitle; tags.forEach((m) => m.remove()); };
  }, []);
}

export function DorApp() {
  usePrivateHead();
  const [secret, setSecret] = useState<string | null>(() => (DOR_FAKE ? 'dev-memory-secret-dev-memory-secret' : readSecret()));
  const [denied, setDenied] = useState(false);
  const leave = useCallback(() => { forgetSecret(); setSecret(null); setDenied(false); }, []);

  if (!secret) return <Gate denied={denied} onSecret={(s) => { storeSecret(s); setDenied(false); setSecret(s); }} />;
  return <Diary key={secret} secret={secret} onDenied={() => { forgetSecret(); setDenied(true); setSecret(null); }} onRotated={setSecret} onLeave={leave} />;
}

function Gate({ denied, onSecret }: { denied: boolean; onSecret: (s: string) => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className='dor dor-gate'>
      <main className='dor-card'>
        <h1>🧠 Diário de Dor – Adolpho</h1>
        <p>{denied ? 'Senha incorreta (ou muitas tentativas: aguarde 15 minutos).' : 'Esta página é privada. Digite a senha para entrar.'}</p>
        <form onSubmit={async (e) => { e.preventDefault(); if (!pw) return; setBusy(true); onSecret(await deriveSecret(pw)); setBusy(false); }}>
          <label className='dor-field'><span>Senha</span><input type='password' value={pw} onChange={(e) => setPw(e.target.value)} autoComplete='current-password' autoFocus /></label>
          <button className='dor-btn primary wide' type='submit' disabled={busy || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </main>
    </div>
  );
}

function Diary({ secret, onDenied, onRotated, onLeave }: { secret: string; onDenied: () => void; onRotated: (s: string) => void; onLeave: () => void }) {
  const api = useMemo(() => (DOR_FAKE ? memoryApi() : supabaseApi(secret)), [secret]);
  const store = useDorStore(api, secret, onDenied);
  const [tab, setTab] = useState<Tab>('home');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [follow, setFollow] = useState<Rec<MedAdmin> | null>(null);
  const close = useCallback(() => setSheet(null), []);

  return (
    <div className="dor">
      <header className="dor-top">
        <h1>🧠 Diário de Dor <span>– Adolpho</span></h1>
        <SaveIndicator store={store} />
        <button className="dor-icon" onClick={() => setSheet({ t: 'settings' })} aria-label="Configurações">⚙</button>
      </header>
      <div className="dor-body">
        <nav className="dor-nav" aria-label="Seções">
          {TABS.map(([k, l, i]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><span aria-hidden>{i}</span>{l}</button>)}
        </nav>
        <main className="dor-main">
          {store.loadError && <div className="dor-alert err" role="alert">Não foi possível carregar os registros: {store.loadError} <button className="dor-btn small" onClick={() => void store.refresh()}>Tentar de novo</button></div>}
          {!store.loaded && !store.loadError ? <p className="dor-muted">Carregando…</p> : store.loaded && (
            <>
              {tab === 'home' && <Home store={store} open={setSheet} onOpenRec={(rec) => setSheet({ t: 'edit', rec })} goHistory={() => setTab('history')} />}
              {tab === 'history' && <History store={store} open={setSheet} onOpenRec={(rec) => setSheet({ t: 'edit', rec })} />}
              {tab === 'meds' && <Meds store={store} />}
              {tab === 'reports' && <Reports store={store} />}
            </>
          )}
          <footer className="dor-foot">Médica responsável pelo acompanhamento: {store.settings.doctor}</footer>
        </main>
      </div>

      <SheetHost store={store} sheet={sheet} close={close} setSheet={setSheet} secret={secret} onRotated={onRotated} onLeave={onLeave} onMedSaved={setFollow} />
      {follow && (
        <Sheet title="Como está a dor agora?" onClose={() => setFollow(null)}>
          <p>Deseja registrar como está a dor agora? Isso mostra a evolução depois do {follow.data.name}, sem concluir que um causou o outro.</p>
          <div className="dor-actions">
            <button className="dor-btn" onClick={() => setFollow(null)}>Agora não</button>
            <button className="dor-btn primary" onClick={() => { const f = follow; setFollow(null); setSheet({ t: 'intensity', crisisId: f.data.crisisId, afterAdminId: f.id, heading: 'Reavaliação após o medicamento' }); }}>Registrar dor</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SaveIndicator({ store }: { store: DorStore }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { setShown(store.state === 'saved'); }, [store.state]);
  if (store.state === 'saving') return <span className="dor-save saving" role="status">Salvando…</span>;
  if (store.state === 'error') return <span className="dor-save error" role="alert" title={store.lastError}>Erro ao salvar</span>;
  if (store.state === 'saved' && shown) return <span className="dor-save ok" role="status">✓ Salvo</span>;
  return <span className="dor-save" />;
}

function SheetHost({ store, sheet, close, setSheet, secret, onRotated, onLeave, onMedSaved }: {
  store: DorStore; sheet: SheetState; close: () => void; setSheet: (s: SheetState) => void; secret: string; onRotated: (s: string) => void; onLeave: () => void; onMedSaved: (r: Rec<MedAdmin>) => void;
}) {
  if (!sheet) return null;
  switch (sheet.t) {
    case 'crisis': return <CrisisForm store={store} onClose={close} startAt={sheet.startAt} />;
    case 'reopen': return <CrisisForm store={store} onClose={close} rec={sheet.rec} reopen />;
    case 'end': return <EndForm store={store} onClose={close} crisis={sheet.rec} />;
    case 'intensity': return <IntensityForm store={store} onClose={close} crisisId={sheet.crisisId} afterAdminId={sheet.afterAdminId} heading={sheet.heading} />;
    case 'symptom': return <SymptomForm store={store} onClose={close} crisis={sheet.rec} />;
    case 'med': return <MedAdminForm store={store} onClose={close} pick={sheet.pick} onSaved={(r) => { if (r.data.category === 'crisis' && r.data.status === 'taken' && r.data.crisisId) onMedSaved(r); }} />;
    case 'sleep': return <SleepForm store={store} onClose={close} date={sheet.date} />;
    case 'edit': return <EditRecord store={store} rec={sheet.rec} onClose={close} />;
    case 'settings': return <SettingsSheet store={store} secret={secret} onClose={close} onRotated={onRotated} onLeave={onLeave} />;
    case 'choice': return <RecentChoice store={store} close={close} setSheet={setSheet} />;
  }
}

/** The pain came back soon after a crisis ended: the person decides, the system never does. */
function RecentChoice({ store, close, setSheet }: { store: DorStore; close: () => void; setSheet: (s: SheetState) => void }) {
  const last = [...store.ctx.crises].filter((c) => c.data.end).sort((a, b) => b.data.end!.localeCompare(a.data.end!))[0] as Rec<Crisis> | undefined;
  return (
    <Sheet title="A dor voltou?" onClose={close}>
      <p>Uma crise terminou há pouco. Escolha como registrar:</p>
      <div className="dor-stack">
        {last && <button className="dor-btn" onClick={() => setSheet({ t: 'reopen', rec: last })}>Reabrir a crise anterior<small>continua a mesma crise; você pode corrigir os horários</small></button>}
        <button className="dor-btn primary" onClick={() => setSheet({ t: 'crisis' })}>Iniciar nova crise<small>uma crise separada, com início próprio</small></button>
      </div>
    </Sheet>
  );
}
