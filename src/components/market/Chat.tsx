import { useEffect, useMemo, useRef, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { useI18n } from '../../lib/i18n';
import { getSeller, useChats } from './store';
import { Avatar, OnlineDot, Since } from './parts';

const EMOJIS = ['👍', '🙏', '😄', '🔥', '💰', '⚔️', '🛡️', '❤️', '🤝', '👀'];

// Canned seller replies so the mock chat feels alive.
const REPLIES = [
  'Opa! Sim, ainda está disponível. 😄',
  'Fechado, posso te encontrar em Ricarten.',
  'Consigo fazer por um valor melhor se levar mais itens.',
  'Beleza, me chama no jogo que a gente combina.',
  'Esse é raro, não costumo baixar muito o preço. 🙏',
  'Perfeito! Te espero online.',
];

export function Chat({ initialSeller, onSeller }: { initialSeller?: string; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const { chats, order, unread, startConversation, sendMessage, receiveMessage, markRead } = useChats();
  const [active, setActive] = useState<string | undefined>(initialSeller);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<number | null>(null);

  // Ensure the passed-in seller has a conversation and is selected.
  useEffect(() => {
    if (initialSeller) {
      startConversation(initialSeller);
      setActive(initialSeller);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeller]);

  // Fall back to the most recent conversation when none is selected.
  useEffect(() => {
    if (!active && order.length) setActive(order[0]);
  }, [active, order]);

  const activeSeller = active ? getSeller(active) : undefined;
  const conv = active ? chats[active] : undefined;
  const messages = useMemo(() => conv?.messages ?? [], [conv]);

  // Mark read + autoscroll whenever the active thread changes or grows.
  useEffect(() => {
    if (active) markRead(active);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, messages.length, typing]);

  useEffect(() => () => { if (replyTimer.current) window.clearTimeout(replyTimer.current); }, []);

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    sendMessage(active, text);
    setDraft('');
    if (BACKEND_ENABLED) return; // real replies come from the other player via realtime
    // Demo mode only: simulated seller reply with a "typing…" delay.
    const target = active;
    if (replyTimer.current) window.clearTimeout(replyTimer.current);
    setTyping(true);
    replyTimer.current = window.setTimeout(() => {
      receiveMessage(target, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
      setTyping(false);
    }, 1400 + Math.random() * 900);
  };

  return (
    <div className="mk-chat">
      {/* conversation list */}
      <aside className="mk-chat-list">
        <div className="mk-chat-list-head">💬 {t('mk.chat.title')}</div>
        {order.length === 0 && <p className="mk-muted mk-chat-empty">{t('mk.chat.none')}</p>}
        {order.map((id) => {
          const s = getSeller(id);
          const msgs = chats[id].messages;
          const last = msgs[msgs.length - 1];
          const u = unread(id);
          return (
            <button key={id} className={`mk-chat-conv ${active === id ? 'on' : ''}`} onClick={() => setActive(id)}>
              <Avatar value={s?.avatar || ''} />
              <span className="mk-chat-conv-body">
                <span className="mk-chat-conv-top">
                  <b>{s?.nick}</b>
                  <OnlineDot online={!!s?.online} />
                </span>
                <span className="mk-chat-conv-last">{last ? (last.from === 'me' ? `${t('mk.chat.you')}: ` : '') + last.text : '—'}</span>
              </span>
              {u > 0 && <span className="mk-chat-badge">{u}</span>}
            </button>
          );
        })}
      </aside>

      {/* active thread */}
      <section className="mk-chat-thread">
        {activeSeller ? (
          <>
            <header className="mk-chat-head">
              <button className="mk-chat-head-id" onClick={() => onSeller(activeSeller.id)}>
                <Avatar value={activeSeller.avatar} />
                <span>
                  <b>{activeSeller.nick}</b>
                  <span className="mk-chat-head-sub">
                    <OnlineDot online={activeSeller.online} />
                    {activeSeller.online ? t('mk.online') : <>{t('mk.lastseen')} <Since at={activeSeller.lastSeen} /></>}
                  </span>
                </span>
              </button>
            </header>

            <div className="mk-chat-msgs" ref={scrollRef}>
              {messages.map((m) => (
                <div key={m.id} className={`mk-msg ${m.from}`}>
                  <span className="mk-msg-bubble">{m.text}</span>
                  <span className="mk-msg-time"><Since at={m.at} /></span>
                </div>
              ))}
              {typing && (
                <div className="mk-msg them">
                  <span className="mk-msg-bubble typing"><i /><i /><i /></span>
                </div>
              )}
            </div>

            <div className="mk-chat-emojis">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setDraft((d) => d + e)}>{e}</button>
              ))}
            </div>
            <div className="mk-chat-input">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder={t('mk.chat.ph')}
              />
              <button className="mk-btn primary" onClick={send} disabled={!draft.trim()}>{t('mk.chat.send')}</button>
            </div>
          </>
        ) : (
          <div className="mk-chat-placeholder">💬 {t('mk.chat.pick')}</div>
        )}
      </section>
    </div>
  );
}
