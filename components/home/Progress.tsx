'use client';

import { Icon } from '@/components/ui/Icon';
import { AGENT_COLOR, DONE_WORKS, TICKS, TODAY_X, WORKS, employee, type Phase, type Work } from '@/lib/dummy';

/**
 * 進捗＝図で読む。中身は「答えの1行」と「タイムライン」だけ。
 *   Work が増えたとき: 並びは放っておけない順、レーンは flex で伸び縮み、
 *   完了した Work は下の1行に畳む。
 */

const T1 = '#EDEDED', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974', RED_T = '#F28B82';
const LABEL = 196, RIGHT = 74 + 62 + 24;
const DPP = 0.28; // 軸1% = 0.28日

function Seg({ p }: { p: Phase }) {
  const base: React.CSSProperties = {
    position: 'absolute', left: `${p.x}%`, width: `${p.w}%`, top: 0, height: 36,
    borderRadius: 5, overflow: 'hidden',
  };
  if (p.state === 'done') {
    return <div style={{ ...base, background: '#202020' }}><Label c={T3}>{p.name}</Label></div>;
  }
  if (p.state === 'now') {
    return (
      <div style={{ ...base, background: '#2E2E2E' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '5px 0 0 5px', background: '#6E6E6E' }} />
        <Label c={T1}>{p.name}</Label>
      </div>
    );
  }
  return <div style={{ ...base, border: '1px dashed #262626' }}><Label c={T5}>{p.name}</Label></div>;
}

const Label = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <span style={{
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 10px',
    color: c, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }}>{children}</span>
);

function Lane({ w, last }: { w: Work; last: boolean }) {
  const late = typeof w.health === 'object';
  const state = late ? `遅れ ${(w.health as { late: number }).late}日` : w.gate ? '判断待ち' : '順調';
  const scol = late ? RED_T : w.gate ? AMBER_T : GREEN_T;
  const rest = `残り${Math.round((w.phases[w.phases.length - 1].x + w.phases[w.phases.length - 1].w - TODAY_X) * DPP)}日`;
  const nowPhase = w.phases.find((p) => p.state === 'now');

  return (
    <div style={{
      flex: 1, minHeight: 104, display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: last ? undefined : '1px solid #161616',
    }}>
      <div style={{ width: LABEL, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
        <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }} className="tnum">
          フェーズ {w.phaseIndex} / {w.phases.length} · {w.progress}%
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', height: 36 }}>
          {w.phases.map((p) => <Seg key={p.name} p={p} />)}
          {w.over && (
            <div style={{
              position: 'absolute', left: `${w.over.x}%`, width: `${w.over.w}%`, top: 0, height: 36,
              borderRadius: 5, border: '1px dashed rgba(217,48,37,0.55)', boxSizing: 'border-box',
            }}><Label c={RED_T}>{w.over.label}</Label></div>
          )}
          {w.gate && (
            <div style={{
              position: 'absolute', left: `${w.gate.x}%`, top: 18, width: 11, height: 11,
              marginLeft: -5.5, marginTop: -5.5, background: AMBER, transform: 'rotate(45deg)',
              borderRadius: 2, boxShadow: '0 0 0 4px rgba(227,116,0,0.18)',
            }} />
          )}
        </div>
        {/* 下段: ◆のラベルと、担当がいまどこにいるか */}
        <div style={{ position: 'relative', height: 16, marginTop: 11 }}>
          {w.gate && (
            <span style={{
              position: 'absolute', left: `${w.gate.x}%`, top: 0, transform: 'translateX(-100%)',
              paddingRight: 9, color: AMBER_T, fontSize: 11, whiteSpace: 'nowrap',
            }}>{w.gate.label}</span>
          )}
          {w.crew.map((c) => {
            const e = employee(c.id);
            return (
              <span key={c.id} style={{
                position: 'absolute', left: `${c.x}%`, top: 0, transform: 'translateX(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999, background: AGENT_COLOR[e.color],
                  opacity: c.dim ? 0.45 : 1,
                }} />
                <span style={{ color: c.dim ? T5 : T4, fontSize: 11 }}>{e.name}</span>
              </span>
            );
          })}
        </div>
      </div>

      <span style={{ width: 74, flexShrink: 0, textAlign: 'right', color: scol, fontSize: 12, whiteSpace: 'nowrap', paddingBottom: 27 }}>
        {state}
      </span>
      <span style={{ width: 62, flexShrink: 0, textAlign: 'right', color: T4, fontSize: 12, whiteSpace: 'nowrap', paddingBottom: 27 }} className="tnum">
        {rest}
      </span>
      <span style={{ display: 'none' }}>{nowPhase?.goal}</span>
    </div>
  );
}

export function Progress() {
  const late = WORKS.filter((w) => typeof w.health === 'object').length;
  const gates = WORKS.filter((w) => w.gate).length;

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 18, padding: '10px 24px 108px',
    }}>
      {/* 答えを先に。状態の6語の外に新しい言い方を作らない */}
      <div style={{ width: '100%', maxWidth: 1108, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 15, lineHeight: '25px' }}>
          {WORKS.length}つの Work のうち <span style={{ color: RED_T }}>{late}つが遅れています。</span>
          <span style={{ color: AMBER_T }}>判断待ちが {gates}件、要確認が 1件。</span>
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T5, fontSize: 11 }}>統括AI · 2時間前</span>
      </div>

      <div style={{
        width: '100%', maxWidth: 1108, flex: 1, minHeight: 0, boxSizing: 'border-box',
        position: 'relative', display: 'flex', flexDirection: 'column', padding: '14px 0 0',
      }}>
        {/* 目盛りと今日の線 */}
        <div style={{ position: 'absolute', left: LABEL + 12, right: RIGHT, top: 22, bottom: 42, pointerEvents: 'none' }}>
          {TICKS.slice(1, -1).map((t) => (
            <div key={t.x} style={{ position: 'absolute', left: `${t.x}%`, top: 0, bottom: 0, width: 1, background: '#131313' }} />
          ))}
          <div style={{ position: 'absolute', left: `${TODAY_X}%`, top: 0, bottom: 0, width: 1, background: '#3A3A3A' }} />
          <div style={{
            position: 'absolute', left: `${TODAY_X}%`, top: -18, transform: 'translateX(-50%)',
            color: T3, fontSize: 11, whiteSpace: 'nowrap',
          }}>今日</div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 8px' }}>
          <div style={{ width: LABEL, flexShrink: 0 }} />
          <div style={{ flex: 1, position: 'relative', height: 14 }}>
            {TICKS.map((t) => (
              <span key={t.x} style={{
                position: 'absolute', left: `${t.x}%`, transform: 'translateX(-50%)',
                color: T5, fontSize: 11, whiteSpace: 'nowrap',
              }}>{t.label}</span>
            ))}
          </div>
          <span style={{ width: 74, flexShrink: 0 }} /><span style={{ width: 62, flexShrink: 0 }} />
        </div>

        {WORKS.map((w, i) => <Lane key={w.id} w={w} last={i === WORKS.length - 1} />)}

        {/* 完了した Work は下に溜めない */}
        <div className="row" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, height: 42, borderRadius: 7, padding: '0 8px', margin: '0 -8px' }}>
          <span style={{ color: T4 }}>完了した Work</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{DONE_WORKS}件</span>
          <div style={{ flex: 1 }} />
          <Icon name="chev" color={T5} size={13} />
        </div>
      </div>
    </div>
  );
}
