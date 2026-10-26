import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { CHAT_MAX_LENGTH, type ChatMessage } from '../../lib/screenshare/p2p';

/** Text chat of a room. Messages are plain text (React escapes everything), newest at the bottom. */
export function ScreenChat({
  messages, selfId, ready, onSend,
}: {
  messages: ChatMessage[];
  selfId: string; // who "me" is, to highlight my own lines ('host' for the host)
  ready: boolean; // false while the private connection of the chat is still being set up
  onSend: (text: string) => boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view, but don't yank the list if the reader scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const value = text.trim();
    if (!value || !ready) return;
    if (onSend(value)) setText('');
  };

  return (
    <aside className="sr-chat" aria-label={t('sc.chat.title')}>
      <h3 className="sr-h3">{t('sc.chat.title')}</h3>
      <div className="sr-chat-list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && <p className="mk-muted sr-chat-empty">{ready ? t('sc.chat.empty') : t('sc.chat.connecting')}</p>}
        {messages.map((m) => (
          <p key={m.id} className={`sr-chat-line${m.fromId === selfId ? ' mine' : ''}${m.fromHost ? ' host' : ''}`}>
            <b>{m.name}{m.fromHost && <i> · {t('sc.chat.host')}</i>}</b>
            <span>{m.text}</span>
          </p>
        ))}
      </div>
      <div className="sr-chat-input">
        <input
          type="text"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          disabled={!ready}
          placeholder={ready ? t('sc.chat.placeholder') : t('sc.chat.connecting')}
          autoComplete="off"
          name="screen-chat"
          data-1p-ignore
          data-lpignore="true"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button type="button" className="mk-btn sm" disabled={!ready || !text.trim()} onClick={send}>{t('sc.chat.send')}</button>
      </div>
    </aside>
  );
}
