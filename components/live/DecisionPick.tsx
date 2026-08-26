'use client';

import { useEffect, useState } from 'react';
import { decide, taskDecision } from '@/app/actions/run';
import { PaneError, PaneLoading } from '@/components/shell/Chrome';
import { wakePump } from '@/lib/pump';
import type { LiveDecision } from '@/lib/store';
import { GREEN_T, HAIR, SEAM, T1, T4, T5 } from '@/lib/design/tokens';

/**
 * **判断は1か所で書く**（2026-08-26 に Work 画面から出した）。
 *
 * 社長の仕事は4つ（ゴールを示す・採用する・判断する・成果物を見る）で、
 * そのうち**判断は Work 画面にしか無かった**。通知の画面は「この画面から出ずに終わる」と
 * 自分で書いているのに、判断待ちを開くと `/work/…` へ飛ばしていた。
 *
 * **1つの決まりを2か所で使う**（`useStick` と同じ。→ CLAUDE.md）。
 * 器を2つ作ると、片方だけ直した日に、同じ質問が2つの形で出る。
 */
/**
 * `taskId` を渡すと取りに行き、`given` を渡すとそれをそのまま出す。
 * **フェーズの ◆ はタスクに紐づかない**（Work のもの）ので、後者で渡す。
 */
export function DecisionPick({ taskId, given, onDone }:
  { taskId?: string; given?: LiveDecision; onDone: () => void }) {
  const [dec, setDec] = useState<LiveDecision | null | 'loading'>(given ?? 'loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (given || !taskId) return;
    taskDecision(taskId).then(setDec);
  }, [taskId, given]);

  /**
   * **まだ分からないあいだ、「無い」と言わない**（2026-08-26）。
   * 取りに行っている最中は形だけ出す（`PaneLoading`）。見つからなかったときは
   * **何が起きて、次に何をすればいいか**を書いて、もう一度の口を出す（`PaneError`）。
   * 前は「見つかりませんでした。」の1行で行き止まりだった。
   */
  if (dec === 'loading') return <PaneLoading lines={4} />;
  if (!dec) {
    return (
      <PaneError
        what="聞かれていることが読めませんでした"
        next="決まった直後だと、もう答えたあとかもしれません。読み直すと、いまの状態が出ます。"
        onRetry={() => {
          if (!taskId) return;
          setDec('loading'); taskDecision(taskId).then(setDec);
        }} />
    );
  }

  const pick = async (label: string) => {
    setBusy(true);
    await decide(dec.id, label);
    wakePump(); // 待っていたタスクが queued に戻った
    setBusy(false); onDone();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : undefined }}>
      <span style={{ fontSize: 14, color: T1 }}>{dec.question}</span>
      {dec.why && <span style={{ color: T4, fontSize: 12.5, lineHeight: '19px', paddingTop: 6 }}>{dec.why}</span>}
      <div style={{ paddingTop: 12 }}>
        {dec.options.map((o, i) => (
          <button key={o.label} onClick={() => pick(o.label)} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 10px', margin: '0 -10px',
            borderRadius: 8, textAlign: 'left',
            borderBottom: i === dec.options.length - 1 ? undefined : `1px solid ${HAIR}`,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 5, background: SEAM, color: T4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
            }}>{i + 1}</span>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {o.label}
                {o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>推奨</span>}
              </span>
              {o.description && <span style={{ color: T5, fontSize: 12 }}>{o.description}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

