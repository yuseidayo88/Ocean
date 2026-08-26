'use client';

import { useEffect, useState } from 'react';
import { retryTask, skipTask, taskWhy } from '@/app/actions/run';
import { wakePump } from '@/lib/pump';
import { Icon } from '@/components/ui/Icon';
import { BLUE, DIM, EDGE, RAIL, RED, RED_T, T2, T3, T5 } from '@/lib/design/tokens';

/**
 * **止まったタスクから戻る**（2026-08-26）。
 *
 * ここまで、実行が失敗したタスクには**戻り道が1本も無かった** —
 * `closePhaseIfDone` は「そのフェーズのタスクが全部 done か cancelled」で閉じるので、
 * 止まったものが1つ残ると**そのフェーズは永久に閉じず、Work は二度と進まない**。
 * 通知は「途中で止まりました」と言うのに、押した先の画面には行動が1つも無かった。
 *
 * **モデルは失敗する。失敗そのものは直せないが、失敗から戻れないのは直せる。**
 *
 * ## 決めごと
 *
 * - **理由を出す。** `runs.error` はずっと書かれていたのに、画面のどこにも出ていなかった。
 *   出さないと社長は「もう一度やる」か「飛ばす」かを選べない。**無ければ出さない**
 * - **行動は2つだけ** — もう一度やる（青・次に押すもの）／ これは飛ばす（枠だけ）。
 *   3つ目（「統括AIに聞く」など）は置かない — 入力欄がどの画面にもある
 * - **押したら本当に変わる。** 走り直しは `queued` に戻してポンプを起こす。
 *   飛ばすと `cancelled` になり、**フェーズの関門はそれを「済んだもの」として数える**
 * - 器は2か所で使う（タスクのペイン／通知の画面）。**同じ決まりを2つ書かない**
 */
export function StuckActions({ taskId, onDone }: { taskId: string; onDone?: () => void }) {
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [err, setErr] = useState('');

  // **効果の中で直接 state を触らない**（`react-hooks/set-state-in-effect`）。
  // 別のタスクに切り替わったときの作り直しは、呼ぶ側の `key={taskId}` がやる
  useEffect(() => {
    let on = true;
    taskWhy(taskId).then((w) => { if (on) setWhy(w); });
    return () => { on = false; };
  }, [taskId]);

  const go = async (kind: 'retry' | 'skip') => {
    setBusy(true); setErr('');
    const r = kind === 'retry' ? await retryTask(taskId) : await skipTask(taskId);
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? ''); return; }
    // 走り直しは列に戻っただけ、飛ばしたぶんはフェーズの関門が開くかもしれない。
    // どちらも**次のポンプ（静かなときは15秒）まで待たせない**
    wakePump();
    setSaid(kind === 'retry' ? 'もう一度やります' : '飛ばしました — フェーズは先へ進みます');
    onDone?.();
  };

  if (said) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="check" color={T5} size={13} width={2} />
        <span style={{ color: T5, fontSize: 12.5 }}>{said}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* **理由は、無ければ出さない。** 枠で囲わず、左3px の赤帯だけで「止まっている」と言う */}
      {why ? (
        <div style={{ padding: '2px 0 2px 11px', boxShadow: `inset 3px 0 0 ${RED}` }}>
          <span style={{ display: 'block', color: RED_T, fontSize: 11.5 }}>止まった理由</span>
          <span style={{ display: 'block', color: T2, fontSize: 12.5, lineHeight: '19px', paddingTop: 3 }}>{why}</span>
        </div>
      ) : why === '' ? (
        <span style={{ color: T5, fontSize: 12.5 }}>理由は残っていません。</span>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: busy ? 0.6 : 1 }}>
        <button onClick={() => go('retry')} disabled={busy} className={busy ? undefined : 'solid'} style={{
          display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
          background: busy ? RAIL : BLUE, color: busy ? T5 : '#fff', fontSize: 12.5,
          cursor: busy ? 'default' : 'pointer',
        }}>もう一度やる</button>
        <button onClick={() => go('skip')} disabled={busy} className={busy ? undefined : 'btn'} style={{
          display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
          background: 'transparent', border: `1px solid ${EDGE}`, color: T3, fontSize: 12.5,
          cursor: busy ? 'default' : 'pointer',
        }}>これは飛ばす</button>
        {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
        {!err && !busy && <span style={{ color: DIM, fontSize: 11.5 }}>飛ばすと、このフェーズは先へ進みます</span>}
      </div>
    </div>
  );
}
