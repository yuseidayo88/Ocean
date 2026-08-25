'use client';

import { readDoc } from '@/lib/diagram/parse';
import { DiagramBroken, WorkflowView } from '@/components/diagram/Workflow';
import { T2, T5 } from '@/lib/design/tokens';

/**
 * 成果物の中身。**器は1つ**（右ペインでも成果物の画面でも同じもの）。
 *
 * 図（`kind='diagram'`）なら本文は JSON なので、そのまま出したら記号の山になる。
 * 読めたら**図として描く**。読めなければ「図が読めません」と正直に言う
 * （壊れた JSON を社長に見せない）。
 */
export function DelBody({ body }: { body: string }) {
  const doc = readDoc(body);
  if (doc) {
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
  // 図のつもりで壊れているとき（`{` で始まるのに読めない）だけ、そう言う
  if (body.trim().startsWith('{')) return <DiagramBroken why="この図は読めませんでした。もう一度描いてもらってください。" />;
  return (
    <pre style={{
      margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
    }}>{body}</pre>
  );
}
