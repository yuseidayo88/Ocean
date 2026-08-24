'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useParam } from '@/lib/use-open';

import { Icon } from '@/components/ui/Icon';
import type { Phase, Work } from '@/lib/view/model';

import { AMBER, AMBER_T, DIM, FAINT, GREEN_T, HAIR, RED_T, RULE, T1, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * 進捗＝図で読む。中身は「答えの1行」と「タイムライン」だけ。
 *   Work が増えたとき: 並びは放っておけない順、レーンは flex で伸び縮み、
 *   完了した Work は下の1行に畳む。
 */

/**
 * 帯に余裕を持たせる。**軸に使える幅を増やす**（左の名前と右の2列を削り、
 * 最大幅を窓いっぱいまで上げる）＋ **帯そのものを高くする**。
 * 前は 1108 の中で 740px しか軸に使えず、フェーズ名が器に貼り付いていた。
 */
const LABEL = 178, RCOL = 70, RCOL2 = 56, RIGHT = RCOL + RCOL2 + 22;
const MAXW = 1420;
/** 帯の高さと、帯どうしのすき間（**隣と地続きに見せない**） */
const BAR = 46, SPLIT = 4;

function Seg({ p }: { p: Phase }) {
  const base: React.CSSProperties = {
    position: 'absolute', left: `${p.x}%`, width: `calc(${p.w}% - ${SPLIT}px)`, top: 0, height: BAR,
    borderRadius: 7, overflow: 'hidden',
  };
  if (p.state === 'done') {
    return <div style={{ ...base, background: '#1D1D1D' }}><Label c={T3}>{p.name}</Label></div>;
  }
  if (p.state === 'now') {
    return (
      <div style={{ ...base, background: FAINT }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '7px 0 0 7px', background: T4 }} />
        <Label c={T1}>{p.name}</Label>
      </div>
    );
  }
  return <div style={{ ...base, border: `1px dashed ${RULE}` }}><Label c={T5}>{p.name}</Label></div>;
}

const Label = ({ c, pad = 13, children }: { c: string; pad?: number; children: React.ReactNode }) => (
  <span style={{
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: `0 ${pad}px`,
    color: c, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }}>{children}</span>
);

function Lane({ w, last }: { w: Work; last: boolean }) {
  const late = typeof w.health === 'object';
  const state = late ? `遅れ ${(w.health as { late: number }).late}日` : w.gate ? '判断待ち' : '順調';
  const scol = late ? RED_T : w.gate ? AMBER_T : GREEN_T;
  // 残りは絵と同じ出どころ（計画の週数）。予定の無い Work には書かない
  const rest = w.endDate ? `残り${w.restDays}日` : '';
  const nowPhase = w.phases.find((p) => p.state === 'now');

  return (
    <div style={{
      flex: 1, minHeight: 118, display: 'flex', alignItems: 'center', gap: 16,
      borderBottom: last ? undefined : `1px solid ${HAIR}`,
    }}>
      <Link href={`/work/${w.id}`} className="row" style={{
        width: LABEL, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
        borderRadius: 7, padding: '6px 8px', margin: '0 -8px',
      }}>
        {/* 本物の Work 名はダミーより長い。**切らずに折り返す**（レーンは高さに余裕がある） */}
        <span style={{ lineHeight: '19px' }}>{w.title}</span>
        <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }} className="tnum">
          フェーズ {w.phaseIndex} / {w.phases.length} · {w.progress}%
        </span>
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', height: BAR }}>
          {w.phases.map((p) => <Seg key={p.name} p={p} />)}
          {w.over && (
            <div style={{
              /* はみ出したぶんの帯。**フェーズの帯ではないので、すき間も広い余白も取らない** */
              position: 'absolute', left: `${w.over.x}%`, width: `${w.over.w}%`, top: 0, height: BAR,
              borderRadius: 7, border: '1px dashed rgba(217,48,37,0.55)', boxSizing: 'border-box',
            }}><Label c={RED_T} pad={8}>{w.over.label}</Label></div>
          )}
          {w.gate && (
            <div style={{
              position: 'absolute', left: `${w.gate.x}%`, top: BAR / 2, width: 11, height: 11,
              marginLeft: -5.5, marginTop: -5.5, background: AMBER, transform: 'rotate(45deg)',
              borderRadius: 2, boxShadow: '0 0 0 4px rgba(227,116,0,0.18)',
            }} />
          )}
        </div>
        {/* 下段: ◆のラベルと、担当がいまどこにいるか */}
        <div style={{ position: 'relative', height: 16, marginTop: 15 }}>
          {w.gate && (
            <Link href={'/decisions'} className="lnk" style={{
              position: 'absolute', left: `${w.gate.x}%`, top: 0, transform: 'translateX(-100%)',
              paddingRight: 9, color: AMBER_T, fontSize: 11, whiteSpace: 'nowrap',
            }}>{w.gate.label}</Link>
          )}
          {w.crew.map((c) => (
            <Link key={c.id} href={openHref('/team', c.id)} className="lnk" style={{
              position: 'absolute', left: `${c.x}%`, top: 0, transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, background: c.color,
                opacity: c.dim ? 0.45 : 1,
              }} />
              <span style={{ color: c.dim ? T5 : T4, fontSize: 11 }}>{c.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <span style={{ width: RCOL, flexShrink: 0, textAlign: 'right', color: scol, fontSize: 12, whiteSpace: 'nowrap', paddingBottom: 31 }}>
        {state}
      </span>
      <span style={{ width: RCOL2, flexShrink: 0, textAlign: 'right', color: T4, fontSize: 12, whiteSpace: 'nowrap', paddingBottom: 31 }} className="tnum">
        {rest}
      </span>
      <span style={{ display: 'none' }}>{nowPhase?.goal}</span>
    </div>
  );
}

export function Progress({ works, ticks, todayX, done: doneList, gates, late }: {
  works: Work[]; ticks: { x: number; label: string }[]; todayX: number;
  done: { id: string; title: string; ended: string; phases: number }[];
  gates: number; late: number;
}) {
  // 畳みを開いたかどうかは URL に持つ（ホームの他のビューへ行って戻っても同じ）
  const [done, setDone] = useParam('done', '');

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 18, padding: '10px 24px 108px',
    }}>
      {/* 答えを先に。状態の6語の外に新しい言い方を作らない */}
      <div style={{ width: '100%', maxWidth: MAXW, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 15, lineHeight: '25px' }}>
          {works.length}つの Work
          {late > 0 && <>のうち <span style={{ color: RED_T }}>{late}つが遅れています</span></>}
          {late === 0 && <>が動いています</>}。
          {gates > 0 && <span style={{ color: AMBER_T }}>判断待ちが {gates}件。</span>}
        </span>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{
        width: '100%', maxWidth: MAXW, flex: 1, minHeight: 0, boxSizing: 'border-box',
        position: 'relative', display: 'flex', flexDirection: 'column', padding: '14px 0 0',
      }}>
        {/* 目盛りと今日の線 */}
        <div style={{ position: 'absolute', left: LABEL + 16, right: RIGHT, top: 22, bottom: 42, pointerEvents: 'none' }}>
          {ticks.slice(1, -1).map((t) => (
            <div key={t.x} style={{ position: 'absolute', left: `${t.x}%`, top: 0, bottom: 0, width: 1, background: '#131313' }} />
          ))}
          <div style={{ position: 'absolute', left: `${todayX}%`, top: 0, bottom: 0, width: 1, background: DIM }} />
          <div style={{
            position: 'absolute', left: `${todayX}%`, top: -18, transform: 'translateX(-50%)',
            color: T3, fontSize: 11, whiteSpace: 'nowrap',
          }}>今日</div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 0 8px' }}>
          <div style={{ width: LABEL, flexShrink: 0 }} />
          <div style={{ flex: 1, position: 'relative', height: 14 }}>
            {ticks.map((t) => (
              <span key={t.x} style={{
                position: 'absolute', left: `${t.x}%`, transform: 'translateX(-50%)',
                color: T5, fontSize: 11, whiteSpace: 'nowrap',
              }}>{t.label}</span>
            ))}
          </div>
          <span style={{ width: RCOL, flexShrink: 0 }} /><span style={{ width: RCOL2, flexShrink: 0 }} />
        </div>

        {works.map((w, i) => <Lane key={w.id} w={w} last={i === works.length - 1} />)}

        {/* 完了した Work は下に溜めない。押したときだけ開く */}
        {doneList.length > 0 && (
        <button onClick={() => setDone(done ? '' : '1')} className="row" style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          height: 42, borderRadius: 7, padding: '0 8px', margin: '0 -8px', textAlign: 'left',
        }}>
          <span style={{ color: T4 }}>完了した Work</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{doneList.length}件</span>
          <div style={{ flex: 1 }} />
          <Icon name={done ? 'up' : 'chev'} color={T5} size={13} />
        </button>
        )}

        {done && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {doneList.map((w) => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 36, padding: '0 8px',
                borderTop: `1px solid ${HAIR}`,
              }}>
                <Icon name="check" color={FAINT} size={13} width={2} />
                <span style={{ color: T5, fontSize: 13 }}>{w.title}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: DIM, fontSize: 11.5 }} className="tnum">フェーズ{w.phases}</span>
                <span style={{ color: DIM, fontSize: 11.5, width: 62, textAlign: 'right' }}>{w.ended}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
