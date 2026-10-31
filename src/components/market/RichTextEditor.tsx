import { useLayoutEffect, useRef } from 'react';
import { useI18n } from '../../lib/i18n';
import { insertDivider, insertLink, isSafeUrl, toggleLinePrefix, wrapSelection, type Edit } from '../../lib/richText';
import { RichText } from '../RichText';

const MAX_LENGTH = 4000;

/** A text box with a formatting toolbar (bold, italic, underline, lists...) and a live preview. */
export function RichTextEditor({
  label, value, onChange, rows = 7, placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  /** Shown in grey while the box is empty (e.g. the default text). */
  placeholder?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // After a toolbar action React re-renders the text; only then can the selection be put back.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = ref.current;
    if (sel && el) {
      el.focus();
      el.setSelectionRange(sel.start, sel.end);
      pendingSelection.current = null;
    }
  });

  const apply = (fn: (text: string, start: number, end: number) => Edit | null) => {
    const el = ref.current;
    if (!el) return;
    const edit = fn(value, el.selectionStart, el.selectionEnd);
    if (!edit || edit.text.length > MAX_LENGTH) return;
    pendingSelection.current = { start: edit.start, end: edit.end };
    onChange(edit.text);
  };

  const wrap = (before: string, after: string, placeholder: string) => () => apply((text, s, e) => wrapSelection(text, s, e, before, after, placeholder));
  const lines = (prefix: string | ((i: number) => string), strip: RegExp) => () => apply((text, s, e) => toggleLinePrefix(text, s, e, prefix, strip));
  const link = () => apply((text, s, e) => {
    const url = window.prompt(t('rt.linkprompt'), 'https://');
    if (!url || !isSafeUrl(url.trim())) return null;
    return insertLink(text, s, e, url.trim());
  });
  const divider = () => apply((text, s) => insertDivider(text, s));

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**', '**', t('rt.ph.bold'))(); }
    else if (k === 'i') { e.preventDefault(); wrap('*', '*', t('rt.ph.italic'))(); }
    else if (k === 'u') { e.preventDefault(); wrap('__', '__', t('rt.ph.underline'))(); }
  };

  const tools: { key: string; label: React.ReactNode; title: string; run: () => void }[] = [
    { key: 'b', label: <b>B</b>, title: `${t('rt.bold')} (Ctrl+B)`, run: wrap('**', '**', t('rt.ph.bold')) },
    { key: 'i', label: <i>I</i>, title: `${t('rt.italic')} (Ctrl+I)`, run: wrap('*', '*', t('rt.ph.italic')) },
    { key: 'u', label: <u>U</u>, title: `${t('rt.underline')} (Ctrl+U)`, run: wrap('__', '__', t('rt.ph.underline')) },
    { key: 's', label: <s>S</s>, title: t('rt.strike'), run: wrap('~~', '~~', t('rt.ph.strike')) },
    { key: 'mark', label: <span className="rt-tool-mark">A</span>, title: t('rt.mark'), run: wrap('==', '==', t('rt.ph.mark')) },
    { key: 'h1', label: 'T', title: t('rt.h1'), run: lines('# ', /^#{1,2}\s+/) },
    { key: 'h2', label: 't', title: t('rt.h2'), run: lines('## ', /^#{1,2}\s+/) },
    { key: 'ul', label: '•≡', title: t('rt.ul'), run: lines('- ', /^[-•]\s+/) },
    { key: 'ol', label: '1.', title: t('rt.ol'), run: lines((i) => `${i + 1}. `, /^\d+[.)]\s+/) },
    { key: 'a', label: '🔗', title: t('rt.link'), run: link },
    { key: 'hr', label: '—', title: t('rt.hr'), run: divider },
  ];

  return (
    <div className="rt-editor">
      <span className="rt-editor-label">{label}</span>
      <div className="rt-toolbar" role="toolbar" aria-label={label}>
        {tools.map((tool) => (
          <button key={tool.key} type="button" className="rt-tool" title={tool.title} aria-label={tool.title} onMouseDown={(e) => e.preventDefault()} onClick={tool.run}>
            {tool.label}
          </button>
        ))}
      </div>
      <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} maxLength={MAX_LENGTH} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      <details className="rt-preview" open>
        <summary>{t('rt.preview')}</summary>
        {value.trim() ? <RichText source={value} className="rt-preview-body" /> : <p className="mk-muted">{t('rt.preview.empty')}</p>}
      </details>
    </div>
  );
}
