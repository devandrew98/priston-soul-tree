import { Fragment, useMemo } from 'react';
import { isSafeUrl, parseBlocks, type Block, type Inline } from '../lib/richText';

function renderInline(nodes: Inline[], keyPrefix = ''): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.t) {
      case 'text': return <Fragment key={key}>{n.v}</Fragment>;
      case 'br': return <br key={key} />;
      case 'b': return <strong key={key}>{renderInline(n.c, `${key}.`)}</strong>;
      case 'i': return <em key={key}>{renderInline(n.c, `${key}.`)}</em>;
      case 'u': return <u key={key}>{renderInline(n.c, `${key}.`)}</u>;
      case 's': return <s key={key}>{renderInline(n.c, `${key}.`)}</s>;
      case 'mark': return <mark key={key} className="rt-mark">{renderInline(n.c, `${key}.`)}</mark>;
      case 'a':
        return isSafeUrl(n.href)
          ? <a key={key} href={n.href} target="_blank" rel="noopener noreferrer nofollow">{renderInline(n.c, `${key}.`)}</a>
          : <Fragment key={key}>{renderInline(n.c, `${key}.`)}</Fragment>;
    }
  });
}

function renderBlock(b: Block, i: number): React.ReactNode {
  switch (b.t) {
    case 'p': return <p key={i}>{renderInline(b.c)}</p>;
    case 'h1': return <h4 key={i} className="rt-h1">{renderInline(b.c)}</h4>;
    case 'h2': return <h5 key={i} className="rt-h2">{renderInline(b.c)}</h5>;
    case 'hr': return <hr key={i} />;
    case 'ul': return <ul key={i}>{b.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
    case 'ol': return <ol key={i}>{b.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ol>;
  }
}

/** Shows text written in the site's small rich-text format (see lib/richText.ts). */
export function RichText({ source, className = '' }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(source), [source]);
  if (blocks.length === 0) return null;
  return <div className={`rt ${className}`.trim()}>{blocks.map(renderBlock)}</div>;
}
