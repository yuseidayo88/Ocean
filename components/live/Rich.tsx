'use client';

import { blocks, type Block, type Inline } from '@/lib/deliver/md';
import { readCsv } from '@/lib/deliver/format';
import { RULE, SEAM, T1, T2, T4, T5, WELL } from '@/lib/design/tokens';

/**
 * **成果物の中身を、記号のまま出さない**（2026-08-25）。
 *
 * 前は `<pre>` に流していたので、`## 見出し` も `|---|---|` もそのまま並んでいた。
 * 読めはするが、社長が人に見せられる形ではない。
 *
 * **枠で囲わない**（デザイン言語）。見出しと余白だけで区切り、面と枠を持つのは表のヘアラインだけ。
 * **書体のウェイトは 400 のまま** — 強調は明るさで言う（`T1` と `T2` の差）。
 */

function Ins({ kids }: { kids: Inline[] }) {
  return (
    <>
      {kids.map((k, i) => {
        if (k.t === 'bold') return <span key={i} style={{ color: T1 }}>{k.s}</span>;
        if (k.t === 'code') return (
          <code key={i} style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
            background: WELL, padding: '1px 4px', borderRadius: 4, color: T2,
          }}>{k.s}</code>
        );
        if (k.t === 'link') return (
          <a key={i} href={k.href} target="_blank" rel="noreferrer noopener" className="lnk"
            style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{k.s}</a>
        );
        return <span key={i}>{k.s}</span>;
      })}
    </>
  );
}

/** 表。**外枠は付けず、ヘアラインだけで区切る**。広い表は横に送る（`.sx`） */
export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="sx" style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', color: T5, fontSize: 11.5, fontWeight: 400,
                padding: '0 14px 7px 0', borderBottom: `1px solid ${SEAM}`, whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{
                  color: j === 0 ? T2 : T4, padding: '8px 14px 8px 0',
                  borderBottom: `1px solid ${RULE}`, verticalAlign: 'top', lineHeight: '20px',
                }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEAD = { 1: 17, 2: 15, 3: 13.5 } as const;

function One({ b }: { b: Block }) {
  switch (b.t) {
    case 'head':
      return (
        <span style={{
          color: T1, fontSize: HEAD[b.level], lineHeight: '26px',
          paddingTop: b.level === 1 ? 0 : 10, display: 'block',
        }}><Ins kids={b.kids} /></span>
      );
    case 'rule':
      return <span style={{ display: 'block', height: 1, background: SEAM, margin: '6px 0' }} />;
    case 'quote':
      return (
        <span style={{ display: 'block', paddingLeft: 12, borderLeft: `2px solid ${SEAM}`, color: T4 }}>
          <Ins kids={b.kids} />
        </span>
      );
    case 'code':
      return (
        <pre className="sx" style={{
          margin: 0, padding: '10px 12px', background: WELL, borderRadius: 8, overflowX: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
          lineHeight: '20px', color: T2,
        }}>{b.lines.join('\n')}</pre>
      );
    case 'list':
      return (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {b.items.map((it, i) => (
            <span key={i} style={{ display: 'flex', gap: 8, color: T2, lineHeight: '22px' }}>
              <span style={{ color: T5, flexShrink: 0, minWidth: b.ordered ? 16 : 0 }}>
                {b.ordered ? `${i + 1}.` : '・'}
              </span>
              <span><Ins kids={it} /></span>
            </span>
          ))}
        </span>
      );
    case 'table':
      return <Table head={b.head} rows={b.rows} />;
    default:
      return <span style={{ color: T2, lineHeight: '24px' }}><Ins kids={b.kids} /></span>;
  }
}

/** markdown の本文 */
export function Rich({ body }: { body: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
      {blocks(body).map((b, i) => <One key={i} b={b} />)}
    </div>
  );
}

/** CSV の本文。**1行目を見出しにして表で出す**（記号のまま出さない） */
export function Csv({ body }: { body: string }) {
  const rows = readCsv(body);
  if (!rows.length) return null;
  return <Table head={rows[0]} rows={rows.slice(1)} />;
}
