'use client';

import { useState } from 'react';
import { approveDel, sendBackDel } from '@/app/actions/run';
import { BLUE, EDGE, GREEN_T, RED_T, T1, T3, T5, RAIL } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';

/**
 * 成果物への社長のレビュー（Phase 8）。**押すと本当に変わる。**
 *   承認して受け取る → 承認済
 *   直してほしい → 書いた指摘がそのまま直しタスクになり、同じ担当に積まれて走る
 */
export function DelActions({ delId, workId, taskId, title, state, onDone }: {
  delId: string; workId: string; taskId?: string; title: string; state: string;
  onDone: () => void;
}) {
  const [fix, setFix] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (state === '承認済') {
    return (
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 16, borderTop: `1px solid ${EDGE}22` }}>
        <Icon name="check" color={GREEN_T} size={14} width={2} />
        <span style={{ color: GREEN_T, fontSize: 13 }}>承認済</span>
      </div>
    );
  }
  if (state === '差し戻し') {
    return (
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: 16, borderTop: `1px solid ${EDGE}22` }}>
        <span style={{ color: T5, fontSize: 13 }}>差し戻し済 — 直しのタスクが走ります</span>
      </div>
    );
  }

  const approve = async () => {
    setBusy(true);
    await approveDel(delId);
    setBusy(false); onDone();
  };
  const back = async () => {
    setBusy(true); setErr('');
    const r = await sendBackDel(delId, workId, { taskId, title }, note);
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? ''); return; }
    onDone();
  };

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderTop: `1px solid ${RAIL}` }}>
      {fix ? (
        <>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} autoFocus
            placeholder="どこを、どう直してほしいか"
            style={{
              minHeight: 64, padding: '9px 12px', borderRadius: 9, resize: 'vertical',
              background: RAIL, border: `1px solid ${EDGE}`, outline: 'none',
              color: T1, fontSize: 13, lineHeight: '20px', fontFamily: 'inherit',
            }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={back} disabled={busy || !note.trim()}
              className={busy || !note.trim() ? undefined : 'solid'} style={{
                display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
                background: busy || !note.trim() ? '#1C1C1C' : BLUE,
                color: busy || !note.trim() ? T5 : '#fff', fontSize: 12.5,
                cursor: busy || !note.trim() ? 'default' : 'pointer',
              }}>差し戻す</button>
            <button onClick={() => setFix(false)} className="lnk" style={{ color: T5, fontSize: 12 }}>やめる</button>
            {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={approve} disabled={busy} className={busy ? undefined : 'solid'} style={{
            display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
            background: busy ? '#1C1C1C' : BLUE, color: busy ? T5 : '#fff', fontSize: 12.5,
            cursor: busy ? 'default' : 'pointer',
          }}>承認して受け取る</button>
          <button onClick={() => setFix(true)} className="btn" style={{
            display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px',
            borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, fontSize: 12.5,
          }}>直してほしい</button>
        </div>
      )}
    </div>
  );
}
