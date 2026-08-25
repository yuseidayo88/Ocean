'use client';

import { useState } from 'react';
import { readDoc } from '@/lib/diagram/parse';
import { DiagramBroken, WorkflowView } from '@/components/diagram/Workflow';
import { Csv, Rich } from '@/components/live/Rich';
import { formatOf } from '@/lib/deliver/format';
import { SEAM, T2, T5 } from '@/lib/design/tokens';

/**
 * ページ（LP）の下見。**社員が書いた HTML を、アプリの中で走らせない。**
 *
 * 中身はモデルが書いた文字列なので、そのまま描くと**このアプリの中で script が動く**。
 * `sandbox=""`（何も許さない）＋ `srcdoc` の入れ子に閉じ込める —
 * 別のオリジンになるので、こちらの cookie も DOM も見えない。
 * 見えるのは**組み方と字面**で、それが下見に要るものの全部。
 */
function PageView({ body }: { body: string }) {
  const [src, setSrc] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: T5, fontSize: 11.5 }}>
          {src ? 'このページの中身' : '下見（このページの中では何も動かしていません）'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setSrc(!src)} style={{
          height: 24, padding: '0 9px', borderRadius: 6, border: `1px solid ${SEAM}`,
          color: T5, fontSize: 11.5,
        }}>{src ? '下見' : 'HTML を見る'}</button>
      </div>
      {src ? (
        <pre className="sx" style={{
          margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
        }}>{body}</pre>
      ) : (
        <iframe title="ページの下見" sandbox="" srcDoc={body} style={{
          width: '100%', height: 520, border: `1px solid ${SEAM}`, borderRadius: 10, background: '#fff',
        }} />
      )}
    </div>
  );
}

/**
 * 成果物の中身。**器は1つ**（右ペインでも成果物の画面でも同じもの）。
 *
 * 形は `lib/deliver/format.ts` の1枚が決める（→ `docs/design/12-outputs.md`）。
 * 図なら描き、表なら表にし、ページなら下見を出す。**記号のまま出さない。**
 */
export function DelBody({ body, kind }: { body: string; kind?: string }) {
  const f = formatOf(kind, body);

  if (f.shape === 'diagram') {
    const doc = readDoc(body);
    if (!doc) return <DiagramBroken why="この図は読めませんでした。もう一度描いてもらってください。" />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <WorkflowView wf={doc.workflow} />
        {/* **直らなかったことは隠さない**（archify の「未解決の診断は正直に報告する」） */}
        {doc.unresolved?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: T5, fontSize: 11.5 }}>直しきれなかったところ</span>
            {doc.unresolved.map((u, i) => (
              <span key={i} style={{ color: T5, fontSize: 11.5 }}>· {u}</span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (f.shape === 'csv') return <Csv body={body} />;
  if (f.shape === 'html') return <PageView body={body} />;
  if (f.shape === 'code') {
    return (
      <pre className="sx" style={{
        margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
      }}>{body}</pre>
    );
  }
  return <Rich body={body} />;
}
