'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref } from '@/lib/use-open';

import { useEffect, useState } from 'react';
import { useTabs } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, PaneHead, PaneLoading, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { DELIVERABLES, DELIVERABLE_BODY, employee, type Deliverable, type Preview } from '@/lib/dummy';
import { listDels } from '@/app/actions/run';
import { DelActions } from '@/components/live/DelActions';
import type { LiveDeliverable } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { AMBER, AMBER_T, COMPOSER_H, DIM, GREEN, HAIR, LINE, MUTE, RAIL, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';

type LiveDel = LiveDeliverable & { workId: string; workTitle: string };

/** 本物のサムネイル。**実際の書き出し**を小さく出す（灰色の棒を置かない） */
function LiveThumb({ d }: { d: LiveDel }) {
  const lines = (d.preview ?? '').split(/(?<=。)/).filter(Boolean).slice(0, 3);
  return (
    <div style={{
      height: 108, boxSizing: 'border-box', borderRadius: 8, background: RAIL,
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden',
    }}>
      <div style={{ color: T4, fontSize: 10, lineHeight: '14px' }}>{d.workTitle}</div>
      {lines.map((l, i) => (
        <span key={i} style={{ color: '#4E4E4E', fontSize: 9.5, lineHeight: '14px' }}>{l}</span>
      ))}
    </div>
  );
}
/**
 * 成果物＝グリッド（参考: Craft / Frame）。
 * **プレビューは中身を出す。** 灰色の棒ではなく、実際の書き出し・表・棒を小さく出して見分けられるようにする。
 * 社員の色はここには出さない（色はオフィスと進捗の可視化だけ）。
 */

function Thumb({ p }: { p: Preview }) {
  return (
    <div style={{
      height: 108, boxSizing: 'border-box', borderRadius: 8, background: RAIL,
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden',
    }}>
      <div style={{ color: T4, fontSize: 10, lineHeight: '14px' }}>{p.cap}</div>
      {p.kind === 'text' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {p.lines.map((l, i) => (
            <span key={i} style={{ color: '#4E4E4E', fontSize: 9.5, lineHeight: '14px' }}>{l}</span>
          ))}
        </div>
      )}
      {p.kind === 'table' && (
        <>
          <div style={{ height: 2 }} />
          {p.rows.map(([a, b, c], i) => {
            const hi = i === p.hi;
            const col = hi ? T4 : DIM;
            return (
              <div key={a} style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 15, padding: '0 4px',
                borderRadius: 3, background: hi ? 'rgba(227,116,0,0.10)' : undefined,
              }}>
                <span style={{ width: 14, color: col, fontSize: 9 }}>{a}</span>
                <span style={{ flex: 1, color: col, fontSize: 9 }} className="tnum">{b}</span>
                <span style={{ color: col, fontSize: 9 }} className="tnum">{c}</span>
              </div>
            );
          })}
        </>
      )}
      {p.kind === 'bars' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5, paddingBottom: 4 }}>
          {p.values.map((v, i) => (
            <div key={i} style={{ width: 18, height: `${v}%`, borderRadius: 2, background: i === 3 ? `${DIM}` : '#242424' }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** タブの色は状態から。要確認だけ橙、承認済は緑、それ以外は灰 */
const tabDot = (s: Deliverable['state']) => (s === '要確認' ? AMBER : s === '承認済' ? GREEN : MUTE);

export default function DeliverablesPage() {
  /** 本物の成果物（AI社員が書いたもの）。**先頭に混ぜる** */
  const [live, setLive] = useState<LiveDel[]>([]);
  const reload = () => { listDels().then(setLive); };
  useEffect(reload, []);

  const need = DELIVERABLES.filter((d) => d.state === '要確認').length
    + live.filter((d) => d.state === '要確認').length;

  /**
   * **タブは本物。** 開いている並びと、いま見ているものを URL に持つ（`?open=d-rev,d-mkt&at=1`）。
   * まだ書けていないもの（生成中）も開ける。中身のかわりに「作っている」を出す。
   */
  const tabs = useTabs([...live.map((d) => d.id), ...DELIVERABLES.map((d) => d.id)]);
  const docs = tabs.ids.map((id) =>
    (live.find((d) => d.id === id) ?? DELIVERABLES.find((d) => d.id === id))!);
  const top = docs[tabs.at];
  const liveTop = top && live.find((d) => d.id === top.id);
  const b = top && !liveTop ? DELIVERABLE_BODY[top.id] : undefined;

  return (
    <>
      <Centre>
        <TopBar title="成果物" onPanel={() => tabs.open(DELIVERABLES[0].id)} panelOn={docs.length > 0} right={<span style={{ color: T5, fontSize: 12 }}>日本語学習サービス</span>} />

        <div style={{
          height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px', borderBottom: `1px solid ${HAIR}`,
        }}>
          <Icon name="deliv" color={T3} size={15} />
          <span>すべての成果物</span>
          <span style={{ color: T5 }} className="tnum">· {DELIVERABLES.length + live.length}</span>
          <Icon name="down" color={T4} size={13} />
          <div style={{ flex: 1 }} />
          {need > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: AMBER_T }}>
              <Dot color={AMBER} size={7} />要確認 {need}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 16px ${COMPOSER_H}px` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {live.map((d) => (
              <div key={d.id} className="card" {...pressable(() => tabs.open(d.id))} style={{
                boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 11,
                padding: 12, borderRadius: 12, background: '#121212',
                border: `1px solid ${top?.id === d.id ? '#333' : 'transparent'}`,
              }}>
                <LiveThumb d={d} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: T5 }}>{d.by ?? 'AI社員'}</span>
                    <div style={{ flex: 1 }} />
                    {d.state === '要確認' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                        borderRadius: 6, background: 'rgba(227,116,0,0.18)', color: AMBER_T, whiteSpace: 'nowrap',
                      }}>要確認</span>
                    )}
                    {d.state === '承認済' && <Dot color={GREEN} size={7} />}
                  </div>
                  <span style={{ color: T5, fontSize: 12 }}>{d.workTitle}</span>
                </div>
              </div>
            ))}
            {DELIVERABLES.map((d) => (
              <div key={d.id} className="card" {...pressable(() => tabs.open(d.id))} style={{
                boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 11,
                padding: 12, borderRadius: 12, background: '#121212',
                border: `1px solid ${top?.id === d.id ? '#333' : 'transparent'}`,
              }}>
                <Thumb p={d.preview} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={openHref('/team', d.by)} onClick={(e) => e.stopPropagation()} className="lnk"
                      style={{ color: T5 }}>{employee(d.by).name}</Link>
                    <div style={{ flex: 1 }} />
                    {d.state === '要確認' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                        borderRadius: 6, background: 'rgba(227,116,0,0.18)', color: AMBER_T, whiteSpace: 'nowrap',
                      }}>要確認</span>
                    )}
                  </div>
                  <span style={{ color: d.state === '生成中' ? T4 : T5, fontSize: 12 }}>
                    {d.state === '生成中' ? '生成中' : `${d.when} · ${d.version}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Composer placeholder="統括AIに指示する" />
      </Centre>

      {top && (
      <Pane width={480} onClose={tabs.close}
            tabs={docs.map((d) => ({ label: d.title, dot: tabDot(d.state as Deliverable['state']) }))}
            tab={tabs.at} onTab={tabs.select}>
        {liveTop ? (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px' }}>
              <span style={{ fontSize: 16, display: 'block' }}>{liveTop.title}</span>
              <span style={{ color: T5, fontSize: 12, display: 'block', paddingTop: 5 }}>
                {liveTop.by ?? 'AI社員'} · {liveTop.workTitle}
              </span>
              <pre style={{
                margin: '16px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
              }}>{liveTop.body ?? liveTop.preview ?? ''}</pre>
            </div>
            <DelActions delId={liveTop.id} workId={liveTop.workId} taskId={liveTop.taskId}
                        title={liveTop.title} state={liveTop.state} onDone={reload} />
          </>
        ) : !b ? <PaneLoading lines={6} /> : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 0' }}>
          <span style={{ fontSize: 16, display: 'block' }}>{top.title}</span>
          <span style={{ color: T5, fontSize: 12, display: 'block', paddingTop: 5 }}>
            {(() => { const d = top as Deliverable; return <>{employee(d.by).name}{d.version && ` · ${d.version}`}{d.when && ` · ${d.when}`}</>; })()}
          </span>
          <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: '16px 0 0' }}>{b.lead}</p>

          {/* 並ぶものはヘアラインだけで区切る。**外枠は付けない** */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 30, borderBottom: `1px solid ${LINE}` }}>
              {b.table.head.map((h, i) => (
                <span key={h} style={{
                  width: i === 0 ? 40 : i === 1 ? 74 : i === 2 ? undefined : 92,
                  flex: i === 2 ? 1 : undefined,
                  textAlign: i === 3 ? 'right' : 'left', color: T5, fontSize: 11,
                }}>{h}</span>
              ))}
            </div>
            {b.table.rows.map((r, i) => {
              const hi = i === b.table.hi;
              return (
                <div key={r[0]} className="row" style={{
                  display: 'flex', alignItems: 'center', height: 45, padding: '0 10px', margin: '0 -10px',
                  borderRadius: 8, borderBottom: i === b.table.rows.length - 1 ? undefined : `1px solid ${HAIR}`,
                  background: hi ? 'rgba(30,142,62,0.10)' : undefined,
                }}>
                  <span style={{ width: 40, color: hi ? T1 : T3 }}>{r[0]}</span>
                  <span style={{ width: 74, color: hi ? T1 : T3 }} className="tnum">{r[1]}</span>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 72, height: 5, borderRadius: 3, background: SUNK, overflow: 'hidden' }}>
                      <span style={{
                        display: 'block', width: `${b.table.bars[i]}%`, height: '100%',
                        background: hi ? `${GREEN}` : DIM,
                      }} />
                    </span>
                    <span style={{ color: hi ? T1 : T4, fontSize: 12.5 }} className="tnum">{r[2]}</span>
                  </span>
                  <span style={{ width: 92, textAlign: 'right', color: hi ? T1 : T3 }} className="tnum">{r[3]}</span>
                </div>
              );
            })}
          </div>

          <PaneHead>結論</PaneHead>
          <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: 0 }}>{b.conclusion}</p>
        </div>
        )}
        {b && <PaneFooter primary="承認する" secondary="修正を依頼" />}
      </Pane>
      )}
    </>
  );
}
