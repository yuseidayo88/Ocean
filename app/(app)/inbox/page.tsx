'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { openHref } from '@/lib/use-open';

import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { DECISION_BODY, NOTICE_GROUPS } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';

/**
 * 通知＝時系列フィード（参考: Asana / Zendesk）。
 * **まとめて届くものは1件にして中身をぶら下げる。**
 * 未読は左の帯＋青い点だけで示す（面を塗らない）。日付でひとまとまりにする。
 */

/** まとめて届いた中身の行き先 */
const CHILD_HREF: Record<string, Route> = {
  '収益モデル比較レポート — 戦略担当': openHref('/deliverables', 'd-rev'),
  '競合ポジショニング図 — 調査担当': openHref('/deliverables', 'd-target'),
};

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

function Mark({ kind }: { kind: string }) {
  if (kind === '判断待ち') return <Diamond size={9} />;
  if (kind === '要確認') return <Icon name="deliv" color={AMBER_T} size={14} />;
  if (kind === '承認済' || kind === '完了') return <Icon name="check" color={GREEN_T} size={13} width={2.2} />;
  return <Dot color="#6E6E6E" size={8} />;
}

export default function InboxPage() {
  const [open, setOpen] = useOpen();
  const unread = NOTICE_GROUPS.flatMap((g) => g.items).filter((n) => n.unread).length;
  const b = DECISION_BODY;

  return (
    <>
      <Centre>
        <TopBar title="通知" onPanel={() => setOpen(open ? null : NOTICE_GROUPS[0].items[0].id)} panelOn={!!open} right={
          unread > 0 ? <span style={{ color: T5, fontSize: 12 }} className="tnum">未読 {unread}</span> : undefined
        } />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 24px 112px' }}>
          {NOTICE_GROUPS.map((g) => (
            <div key={g.label}>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, paddingTop: 8 }}>
                <span style={{ color: T5, fontSize: 12 }}>{g.label}</span>
              </div>
              {g.items.map((n) => (
                <div key={n.id} className="row" {...pressable(() => setOpen(n.id))} style={{
                  display: 'flex', gap: 13, padding: '13px 0 13px 12px', borderBottom: '1px solid #161616',
                  borderLeft: `2px solid ${n.unread ? BLUE : 'transparent'}`,
                }}>
                  <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', paddingTop: 2 }}>
                    <Mark kind={n.kind} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 事実は右に並べる。タイトルの下に積まない */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                      <span style={{ color: n.unread ? T1 : T2, flexShrink: 0 }}>{n.title}</span>
                      {n.sub && (
                        <span style={{
                          minWidth: 0, color: n.kind === '判断待ち' ? AMBER_T : T5, fontSize: 12.5,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{n.sub}</span>
                      )}
                      <div style={{ flex: 1 }} />
                      {n.unread && <Dot color={BLUE} size={6} />}
                      <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>{n.when}</span>
                    </div>
                    {n.children && (
                      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
                        {n.children.map(([c, w]) => (
                          <Link key={c} href={CHILD_HREF[c] ?? '/deliverables'} onClick={(e) => e.stopPropagation()}
                            className="row" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 28, borderRadius: 6, padding: '0 6px', margin: '0 -6px' }}>
                            <Dot color="#2E2E2E" size={5} />
                            <span style={{ color: T3, fontSize: 12.5 }}>{c}</span>
                            <div style={{ flex: 1 }} />
                            <span style={{ color: T5, fontSize: 11 }}>{w}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <Composer placeholder="統括AIに聞く" />
      </Centre>

      {open && (
      <Pane onClose={() => setOpen(null)} width={420} dot={AMBER} title="価格モデルの決定">
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: AMBER_T, fontSize: 12 }}>{b.waited}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <span style={{ fontSize: 15, display: 'block' }}>価格モデルの決定</span>
          <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '12px 0 0' }}>
            戦略担当が3案を出しました。B案 ¥1,980 を推奨しています。
          </p>
          <div style={{ paddingTop: 16 }}>
            {([['A', '¥980', 30], ['B', '¥1,980', 61], ['C', '¥3,980', 22]] as const).map(([k, v, pct], i) => {
              const on = i === 1;
              return (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 14, height: 40, padding: '0 10px', margin: '0 -10px',
                  borderRadius: 8, borderBottom: i === 2 ? undefined : '1px solid #161616',
                  background: on ? 'rgba(30,142,62,0.10)' : undefined,
                }}>
                  <span style={{ width: 16, color: on ? T1 : T4 }}>{k}</span>
                  <span style={{ flex: 1, height: 5, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: on ? '#1E8E3E' : '#3A3A3A' }} />
                  </span>
                  <span style={{ width: 56, textAlign: 'right', color: on ? T1 : T4 }} className="tnum">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
        <PaneFooter primary="判断する" secondary="あとで" />
      </Pane>
      )}
    </>
  );
}
