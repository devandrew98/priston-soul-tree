// The leader's board: a note for the players and the signs on the Bless Castle map. Saved by itself a moment after each change;
// the public link (ClanSharePage) re-reads it every few seconds, so the players see the changes without reloading.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { LABEL_MAX, MARKER_ICON, MARKER_TYPES, NOTE_MAX, type BoardData, type MapMarker, type MarkerType } from '../../lib/clan/board';
import { getClanRepo, type Clan } from '../../lib/clan/repo';
import { BlessMap } from './BlessMap';

const TXT = {
  noteTitle: { pt: 'Orientações para os jogadores', en: 'Instructions for the players' },
  noteHint: { pt: 'Aparece no topo do link dos jogadores. Ex.: Bless Castle de hoje: FULL PvP.', en: 'Shown at the top of the players link. E.g.: Bless Castle today: FULL PvP.' },
  notePlaceholder: { pt: 'Escreva aqui as orientações do dia…', en: 'Write today\'s instructions here…' },
  mapTitle: { pt: 'Mapa do Bless Castle', en: 'Bless Castle map' },
  mapHint: { pt: 'Escolha um sinal e clique no mapa para colocar. Arraste para mover. Os jogadores veem as marcações no link.', en: 'Pick a sign and click on the map to place it. Drag to move. Players see the signs on the link.' },
  tools: { pt: 'Sinais', en: 'Signs' },
  selected: { pt: 'Sinal selecionado', en: 'Selected sign' },
  label: { pt: 'Texto curto (opcional)', en: 'Short text (optional)' },
  remove: { pt: 'Remover sinal', en: 'Remove sign' },
  clear: { pt: 'Limpar o mapa', en: 'Clear the map' },
  clearAsk: { pt: 'Remover todos os sinais?', en: 'Remove all signs?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
  saving: { pt: 'Salvando…', en: 'Saving…' },
  saved: { pt: 'Salvo', en: 'Saved' },
  error: { pt: 'Não foi possível salvar. Tente de novo.', en: 'Could not save. Try again.' },
  loadError: { pt: 'Não foi possível carregar as orientações.', en: 'Could not load the instructions.' },
  count: { pt: 'sinais', en: 'signs' },
  types: {
    pt: { attack: 'Atacar', defend: 'Defender', rebuff: 'Rebuff', enemy: 'Inimigos' },
    en: { attack: 'Attack', defend: 'Defend', rebuff: 'Rebuff', enemy: 'Enemies' },
  },
} as const;

export function BoardEditor({ clan }: { clan: Clan }) {
  const { lang } = useI18n();
  const T = (k: Exclude<keyof typeof TXT, 'types'>) => TXT[k][lang];
  const typeName = (t: MarkerType) => TXT.types[lang][t];

  const [board, setBoard] = useState<BoardData | null>(null);
  const [tool, setTool] = useState<MarkerType | null>('attack');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'loadError'>('idle');
  const [confirmClear, setConfirmClear] = useState(false);
  const dirty = useRef(false);
  const latest = useRef<BoardData | null>(null);
  latest.current = board;

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    getClanRepo().getBoard(clan.id)
      .then((b) => { if (!cancelled) setBoard(b); })
      .catch(() => { if (!cancelled) setStatus('loadError'); });
    return () => { cancelled = true; };
  }, [clan.id]);

  // Saves shortly after the last change; leaving the page/clan with something pending saves it right away.
  useEffect(() => {
    if (!board || !dirty.current) return;
    setStatus('saving');
    const id = window.setTimeout(() => {
      dirty.current = false;
      getClanRepo().saveBoard(clan.id, board).then(() => setStatus('saved')).catch(() => { dirty.current = true; setStatus('error'); });
    }, 700);
    return () => window.clearTimeout(id);
  }, [board, clan.id]);
  useEffect(() => () => {
    if (dirty.current && latest.current) void getClanRepo().saveBoard(clan.id, latest.current).catch(() => {});
  }, [clan.id]);

  const edit = (patch: Partial<BoardData>) => { dirty.current = true; setBoard((b) => (b ? { ...b, ...patch } : b)); };
  const setMarkers = (markers: MapMarker[]) => edit({ markers });
  const selected = board?.markers.find((m) => m.id === selectedId) ?? null;

  if (status === 'loadError') return <p className="ag-warning" role="alert">{T('loadError')}</p>;
  if (!board) return null;

  const patchSelected = (patch: Partial<MapMarker>) => setMarkers(board.markers.map((m) => (m.id === selectedId ? { ...m, ...patch } : m)));

  return (
    <>
      <section className="sr-card cl-box">
        <div className="cl-boardhead">
          <h3>{T('noteTitle')}</h3>
          <small className={`cl-save ${status}`}>{status === 'saving' ? T('saving') : status === 'saved' ? `✔ ${T('saved')}` : status === 'error' ? T('error') : ''}</small>
        </div>
        <p className="mk-muted">{T('noteHint')}</p>
        <textarea className="cl-note" value={board.note} maxLength={NOTE_MAX} rows={3} placeholder={T('notePlaceholder')} onChange={(e) => edit({ note: e.target.value })} />
        <small className="mk-muted">{board.note.length}/{NOTE_MAX}</small>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('mapTitle')} <small>· {board.markers.length} {T('count')}</small></h3>
        <p className="mk-muted">{T('mapHint')}</p>
        <div className="cl-mapwrap">
          <div className="cl-mapcol">
            <BlessMap markers={board.markers} tool={tool} selectedId={selectedId} onSelect={setSelectedId} onChange={setMarkers} />
          </div>
          <aside className="cl-maptools">
            <h4>{T('tools')}</h4>
            <div className="cl-palette">
              {MARKER_TYPES.map((t) => (
                <button key={t} type="button" className={`cl-tool-btn ${tool === t ? 'on' : ''}`} aria-pressed={tool === t} onClick={() => setTool(tool === t ? null : t)}>
                  <span>{MARKER_ICON[t]}</span> {typeName(t)}
                </button>
              ))}
            </div>
            {selected && (
              <div className="cl-selected">
                <h4>{T('selected')}: {MARKER_ICON[selected.type]} {typeName(selected.type)}</h4>
                <input value={selected.label} maxLength={LABEL_MAX} placeholder={T('label')} aria-label={T('label')} onChange={(e) => patchSelected({ label: e.target.value })} />
                <button type="button" className="mk-btn cl-danger" onClick={() => { setMarkers(board.markers.filter((m) => m.id !== selected.id)); setSelectedId(null); }}>{T('remove')}</button>
              </div>
            )}
            {board.markers.length > 0 && (confirmClear ? (
              <div className="cl-confirm">
                <span>{T('clearAsk')}</span>
                <button type="button" className="mk-btn cl-danger" onClick={() => { setMarkers([]); setSelectedId(null); setConfirmClear(false); }}>{T('yes')}</button>
                <button type="button" className="mk-btn" onClick={() => setConfirmClear(false)}>{T('no')}</button>
              </div>
            ) : <button type="button" className="mk-btn" onClick={() => setConfirmClear(true)}>{T('clear')}</button>)}
          </aside>
        </div>
      </section>
    </>
  );
}
