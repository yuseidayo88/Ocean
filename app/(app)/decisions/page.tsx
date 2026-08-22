'use client';

import { useState } from 'react';
import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon, type IconName } from '@/components/ui/Icon';
import { DECISIONS, DECISION_BODY, type Decision } from '@/lib/dummy';

/**
 * 決定事項＝台帳タイムライン。**追記のみ**（決め直しは新しい行＋supersedes）。
 * 左に相対時刻、丸い印でつながる。判断待ちは選択肢を棒で並べて、その場で読めるようにする。
 * 質問はここに出さない。事業判断だけが昇格する。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN = '#1E8E3E', GREEN_T = '#5BB974', BLUE = '#1A73E8';

export default function DecisionsPage() {
  const gates = DECISIONS.filter((d) => d.state === '判断待ち');
  const b = DECISION_BODY;
  // 右は閉じた状態から始まる。台帳の1件を押すと、その1件が開く
  const [open, setOpen] = useState<Decision | null>(null);

  return (
    <>
      <Centre>
        <TopBar title="決定事項" onPanel={() => setOpen(open ? null : DECISIONS[0])} panelOn={!!open}
          right={<span style={{ color: T5, fontSize: 12 }}>日本語学習サービス</span>} />

        <div style={{
          height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px', borderBottom: '1px solid #161616',
        }}>
          <Icon name="dec" color={T3} size={15} />
          <span>決定事項</span>
          <span style={{ color: T5 }} className="tnum">· {DECISIONS.length}</span>
          <div style={{ flex: 1 }} />
          {gates.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: AMBER_T }}>
              <Dot color={AMBER} size={7} />判断待ち {gates.length}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 112px' }}>
          {DECISIONS.map((d, i) => {
            const wait = d.state === '判断待ち';
            const first = i === 0;
            return (
              <div key={d.id} className="row" onClick={() => setOpen(d)} style={{
                display: 'flex', gap: 16, borderRadius: 8,
                background: open?.id === d.id ? '#0B0B0B' : undefined,
              }}>
                {/* 左の時刻と印 */}
                <span style={{ width: 58, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 11, paddingTop: 14 }}>
                  {d.when}
                </span>
                <div style={{ width: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ height: 14 }} />
                  {wait
                    ? <span style={{ width: 13, height: 13, borderRadius: 999, border: `2px solid ${AMBER}`, flexShrink: 0 }} />
                    : <span style={{
                        width: 13, height: 13, borderRadius: 999, background: GREEN, flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}><Icon name="check" color="#000" size={9} width={3} /></span>}
                  {i < DECISIONS.length - 1 && <div style={{ flex: 1, width: 1, background: '#1C1C1C' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0, paddingBottom: 22, borderBottom: i === DECISIONS.length - 1 ? undefined : '1px solid #161616', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
                    <span style={{ color: T1 }}>{d.question}</span>
                    <div style={{ flex: 1 }} />
                    {wait ? (
                      first
                        ? <span className="solid" style={{
                            display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 14px',
                            borderRadius: 8, background: BLUE, color: '#fff',
                          }}>確認する</span>
                        : <span style={{ color: T3 }}>確認する</span>
                    ) : <span style={{ color: GREEN_T }}>決定</span>}
                  </div>

                  {d.options && d.options.map((o) => (
                    <div key={o.label} className={d.state === '判断待ち' ? 'row' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 41, borderRadius: 7, padding: '0 8px', margin: '0 -8px' }}>
                      <span style={{ width: 40, flexShrink: 0, color: o.recommended ? T1 : T4 }}>{o.label}</span>
                      <span style={{ width: 116, flexShrink: 0, height: 5, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden' }}>
                        <span style={{
                          display: 'block', width: `${o.pct}%`, height: '100%',
                          background: o.recommended ? GREEN : '#3A3A3A',
                        }} />
                      </span>
                      {/* ラベルと同じ値は書かない（同じことを2回言わない） */}
                      <span style={{ width: 66, flexShrink: 0, color: o.recommended ? T1 : T4 }} className="tnum">
                        {o.value === o.label ? '' : o.value}
                      </span>
                      <span style={{ color: o.recommended ? GREEN_T : T5, fontSize: 12.5 }}>{o.note}</span>
                    </div>
                  ))}

                  {d.chosen && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 2 }}>
                        <Icon name="check" color={GREEN_T} size={13} width={2.2} />
                        <span style={{ color: T2 }}>{d.chosen}</span>
                      </div>
                      <span style={{ display: 'block', color: T5, fontSize: 12, paddingTop: 10 }}>{d.basis}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Composer placeholder="統括AIに指示する" />
      </Centre>

      {open && (
      <Pane width={480} onClose={() => setOpen(null)}
        dot={open.state === '判断待ち' ? AMBER : GREEN} title={open.question}>
        {open.state === '判断待ち' && (
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0' }}>
            <span style={{ color: AMBER_T, fontSize: 12 }}>{b.waited}</span>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 20px 0' }}>
          <span style={{ fontSize: 16, display: 'block' }}>{open.question}</span>
          {open.chosen
            ? <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: '14px 0 0' }}>
                <b style={{ color: T1 }}>{open.chosen}</b> に決めました。{open.basis}
              </p>
            : <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: '14px 0 0' }}>{b.lead}</p>}

          <PaneHead>根拠</PaneHead>
          {b.basis.map((x, i) => (
            <div key={x.label} style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 40,
              borderBottom: i === b.basis.length - 1 ? undefined : '1px solid #161616',
            }}>
              <Icon name={x.icon as IconName} color={T4} size={14} />
              <span style={{ color: T2, fontSize: 13 }}>{x.label}</span>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color="#3A3A3A" size={12} />
            </div>
          ))}

          <PaneHead>決めたあとに起きること</PaneHead>
          {b.after.map((x, i) => (
            <div key={x.label} style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 40,
              borderBottom: i === b.after.length - 1 ? undefined : '1px solid #161616',
            }}>
              <Icon name={x.icon as IconName} color={T4} size={14} />
              <span style={{ color: T2, fontSize: 13 }}>{x.label}</span>
            </div>
          ))}
        </div>
        {open.state === '判断待ち'
          ? <PaneFooter primary={b.primary} secondary={b.secondary} />
          : <PaneFooter primary="決め直す" secondary="根拠を見る" reverse />}
      </Pane>
      )}
    </>
  );
}
