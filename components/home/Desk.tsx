'use client';

import { Orb } from '@/components/ui/Orb';
import { Dot } from '@/components/ui/Icon';
import { AGENT_COLOR, EMPLOYEES, LANES, employee, type DeskBody } from '@/lib/dummy';

/**
 * デスク＝縦長レーンを横に並べる（参考: Emergent / Google AI Studio）。
 * 稼働中の社員の手もとを一気に見る。1人1レーン、人が増えたら横スクロール。
 * **中身の器は担当ではなく produces で決める**（業種を埋め込まない）。
 * **本当に動く前提の形**なので、止まっているときは止まっていると出す。
 * 要確認のレーンだけ橙。待機は点線で沈める。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

function Body({ b, color }: { b: DeskBody; color: string }) {
  if (b.kind === 'facts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 4 }}>
          <span style={{ color: T5, fontSize: 11 }}>{b.cap}</span>
          <span style={{ color: T4, fontSize: 11 }} className="tnum">{b.n}</span>
        </div>
        {b.items.map((t, i) => (
          <div key={i} style={{
            display: 'flex', gap: 9, padding: '8px 0',
            borderBottom: i === b.items.length - 1 ? undefined : '1px solid #161616',
          }}>
            <span style={{ color: '#3A3A3A', fontSize: 11, lineHeight: '18px' }}>·</span>
            <span style={{ color: T3, fontSize: 12, lineHeight: '18px' }}>{t}</span>
          </div>
        ))}
      </div>
    );
  }
  if (b.kind === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{b.file}</span>
        {b.lines.map((l, i) => (
          <span key={i} style={{ color: i === b.lines.length - 1 ? T4 : T3, fontSize: 12, lineHeight: '19px' }}>{l}</span>
        ))}
      </div>
    );
  }
  if (b.kind === 'code') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{b.file}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {b.lines.map(([n, code, added]) => (
            <div key={n} style={{ display: 'flex', gap: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
              <span style={{ color: '#333', width: 16, textAlign: 'right', flexShrink: 0 }} className="tnum">{n}</span>
              <span style={{ width: 8, flexShrink: 0, color: added ? GREEN_T : 'transparent' }}>+</span>
              <span style={{ color: added ? GREEN_T : T4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {code}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, paddingTop: 2 }}>
          {b.foot.map((f, i) => (
            <span key={f} style={{ color: i === 0 ? GREEN_T : T5, fontSize: 11 }} className="tnum">{f}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 12px',
        borderRadius: 9, background: '#141414',
      }}>
        <span style={{ color: T2, fontSize: 12.5 }}>{b.title}</span>
        <span style={{ color: T5, fontSize: 11 }}>{b.when}</span>
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32,
        borderRadius: 8, background: 'rgba(227,116,0,0.16)', color: AMBER_T, fontSize: 12.5,
      }}>{b.action}</span>
    </div>
  );
}

export function Desk() {
  const running = LANES.filter((l) => l.state === '実行中').length;
  const idle = EMPLOYEES.filter((e) => !LANES.some((l) => l.id === e.id));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{ color: T3 }}>デスク</span>
        <Dot color="#1E8E3E" size={6} />
        <span style={{ color: T5, fontSize: 12 }}>リアルタイム</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T5, fontSize: 12 }} className="tnum">実行中 {running}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 112 }}>
        {LANES.map((l) => {
          const e = employee(l.id);
          const wait = l.state === '要確認';
          return (
            <div key={l.id} style={{
              width: 320, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
              gap: 13, padding: '14px 15px 12px', borderRadius: 14,
              background: wait ? 'rgba(227,116,0,0.05)' : '#0B0B0B',
              border: `1px solid ${wait ? 'rgba(227,116,0,0.28)' : '#1C1C1C'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Orb color={AGENT_COLOR[e.color]} size={32} seed={e.name.length * 7 + 3} dim={wait} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span>{e.name}</span>
                  <span style={{ color: T5, fontSize: 11 }}>{e.role}</span>
                </div>
                <div style={{ flex: 1 }} />
                {wait && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                    background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12, whiteSpace: 'nowrap',
                  }}>要確認</span>
                )}
              </div>

              <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{l.line}</span>

              {/* 工程。所要時間つきで1行ずつ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {l.steps.map(([s, t], i) => {
                  const last = i === l.steps.length - 1;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: 999, flexShrink: 0,
                        background: last && !wait ? AGENT_COLOR[e.color] : '#2E2E2E',
                        animation: last && !wait ? 'pulse 1.4s ease-in-out infinite' : undefined,
                      }} />
                      <span style={{ flex: 1, minWidth: 0, color: last ? T3 : T5, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s}
                      </span>
                      <span style={{ color: '#3A3A3A', fontSize: 11 }} className="tnum">{t}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ height: 1, background: '#161616' }} />

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <Body b={l.body} color={AGENT_COLOR[e.color]} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 2 }}>
                <span style={{ color: T5, fontSize: 11, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.task}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ color: '#3A3A3A', fontSize: 11 }} className="tnum">{l.elapsed}</span>
              </div>
            </div>
          );
        })}

        {/* 待機は点線で沈める */}
        {idle.map((e) => (
          <div key={e.id} style={{
            width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
            padding: 14, borderRadius: 14, border: '1px dashed #1E1E1E', opacity: 0.5, alignSelf: 'flex-start',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Orb color={AGENT_COLOR[e.color]} size={32} seed={e.name.length * 7 + 3} dim />
              <span style={{ color: T4 }}>{e.name}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 11 }}>待機</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
