'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { useEffect, useState } from 'react';
import { openHref, useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon, type IconName } from '@/components/ui/Icon';
import { DECISIONS, DECISION_BODY } from '@/lib/dummy';
import { decide, listDecisions } from '@/app/actions/run';
import type { LiveDecision } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { AMBER, AMBER_T, BLUE, COMPOSER_H, DIM, GREEN, GREEN_T, HAIR, SEAM, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * 決定事項＝台帳タイムライン。**追記のみ**（決め直しは新しい行＋supersedes）。
 * 左に相対時刻、丸い印でつながる。判断待ちは選択肢を棒で並べて、その場で読めるようにする。
 * 質問はここに出さない。事業判断だけが昇格する。
 */

/** 根拠の行き先。実在するものだけ張る */
const BASIS_HREF: Record<string, Route> = {
  '収益モデル比較レポート': openHref('/deliverables', 'd-rev'),
  '競合の価格 12件': openHref('/deliverables', 'd-price'),
};
const AFTER_HREF: Record<string, Route> = {
  '収益シミュレーションが始まる': openHref('/tasks', 'tk-sim'),
  'フェーズ3の計画が作られる': '/work/w-japanese' as Route,
};

/** 本物の決定の1件。開いている判断はその場で決められる */
function LiveRow({ d, last, onDecide }: { d: LiveDecision; last: boolean; onDecide: (id: string, label: string) => void }) {
  const wait = d.status === 'open';
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <span style={{ width: 58, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 11, paddingTop: 14 }}>
        {d.when ?? ''}
      </span>
      <div style={{ width: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ height: 14 }} />
        {wait
          ? <span style={{ width: 13, height: 13, borderRadius: 999, border: `2px solid ${AMBER}`, flexShrink: 0 }} />
          : <span style={{
              width: 13, height: 13, borderRadius: 999, background: GREEN, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="check" color="#000" size={9} width={3} /></span>}
        {!last && <div style={{ flex: 1, width: 1, background: SEAM }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 22, borderBottom: last ? undefined : `1px solid ${HAIR}`, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
          <span style={{ color: T1 }}>{d.question}</span>
          <div style={{ flex: 1 }} />
          {wait ? <span style={{ color: AMBER_T }}>判断待ち</span> : <span style={{ color: GREEN_T }}>決定</span>}
        </div>
        {wait ? d.options.map((o) => (
          <button key={o.label} onClick={() => onDecide(d.id, o.label)} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 14, height: 41, width: '100%', borderRadius: 7,
            padding: '0 8px', margin: '0 -8px', textAlign: 'left',
          }}>
            <span style={{ color: o.recommended ? T1 : T4 }}>{o.label}</span>
            {o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>推奨</span>}
            <span style={{ color: T5, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.description}</span>
          </button>
        )) : (
          <span style={{ color: T2, fontSize: 13 }}>{d.chosen}</span>
        )}
        {d.why && wait && <span style={{ color: T5, fontSize: 12, display: 'block', paddingTop: 6 }}>{d.why}</span>}
      </div>
    </div>
  );
}

export default function DecisionsPage() {
  /** 本物の決定（AI社員が聞いた・社長が決めたもの）。台帳の先頭に混ぜる */
  const [live, setLive] = useState<LiveDecision[]>([]);
  const reload = () => { listDecisions().then(setLive); };
  useEffect(reload, []);
  const onDecide = async (id: string, label: string) => { await decide(id, label); reload(); };

  const gates = DECISIONS.filter((d) => d.state === '判断待ち');
  const b = DECISION_BODY;
  // 右は閉じた状態から始まる。台帳の1件を押すと、その1件が開く
  const [openId, setOpen] = useOpen();
  const open = DECISIONS.find((d) => d.id === openId) ?? null;

  return (
    <>
      <Centre>
        <TopBar title="決定事項" onPanel={() => setOpen(open ? null : DECISIONS[0].id)} panelOn={!!open}
          right={<span style={{ color: T5, fontSize: 12 }}>日本語学習サービス</span>} />

        <div style={{
          height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px', borderBottom: `1px solid ${HAIR}`,
        }}>
          <Icon name="dec" color={T3} size={15} />
          <span>決定事項</span>
          <span style={{ color: T5 }} className="tnum">· {DECISIONS.length + live.length}</span>
          <div style={{ flex: 1 }} />
          {(gates.length + live.filter((d) => d.status === 'open').length) > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: AMBER_T }}>
              <Dot color={AMBER} size={7} />判断待ち {gates.length + live.filter((d) => d.status === 'open').length}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 24px ${COMPOSER_H}px` }}>
          {live.map((d, i) => (
            <LiveRow key={d.id} d={d} last={i === live.length - 1 && DECISIONS.length === 0} onDecide={onDecide} />
          ))}
          {DECISIONS.map((d, i) => {
            const wait = d.state === '判断待ち';
            const first = i === 0;
            return (
              <div key={d.id} className="row" {...pressable(() => setOpen(d.id))} style={{
                display: 'flex', gap: 16, borderRadius: 8,
                background: openId === d.id ? '#0B0B0B' : undefined,
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
                  {i < DECISIONS.length - 1 && <div style={{ flex: 1, width: 1, background: SEAM }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0, paddingBottom: 22, borderBottom: i === DECISIONS.length - 1 ? undefined : `1px solid ${HAIR}`, marginBottom: 6 }}>
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
                      <span style={{ width: 116, flexShrink: 0, height: 5, borderRadius: 3, background: SUNK, overflow: 'hidden' }}>
                        <span style={{
                          display: 'block', width: `${o.pct}%`, height: '100%',
                          background: o.recommended ? GREEN : DIM,
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
            <Link key={x.label} href={BASIS_HREF[x.label] ?? '/deliverables'} onClick={(e) => e.stopPropagation()} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 40, borderRadius: 7,
              padding: '0 8px', margin: '0 -8px',
              borderBottom: i === b.basis.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <Icon name={x.icon as IconName} color={T4} size={14} />
              <span style={{ color: T2, fontSize: 13 }}>{x.label}</span>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color={DIM} size={12} />
            </Link>
          ))}

          <PaneHead>決めたあとに起きること</PaneHead>
          {b.after.map((x, i) => (
            <Link key={x.label} href={AFTER_HREF[x.label] ?? '/tasks'} onClick={(e) => e.stopPropagation()} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 40, borderRadius: 7,
              padding: '0 8px', margin: '0 -8px',
              borderBottom: i === b.after.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <Icon name={x.icon as IconName} color={T4} size={14} />
              <span style={{ color: T2, fontSize: 13 }}>{x.label}</span>
            </Link>
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
