'use client';

import { Go as Link } from '@/components/ui/Go';

import { useEffect, useState } from 'react';
import { useTabs } from '@/lib/use-open';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { listDels } from '@/app/actions/run';
import { DelActions } from '@/components/live/DelActions';
import { DelBody } from '@/components/live/DelBody';
import { DelTake } from '@/components/live/DelTake';
import { formatOf } from '@/lib/deliver/format';
import type { LiveDeliverable } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { AMBER, AMBER_T, COMPOSER_H, GREEN, HAIR, MUTE, RAIL, T2, T3, T5 } from '@/lib/design/tokens';

type LiveDel = LiveDeliverable & { workId: string; workTitle: string };

/**
 * 成果物＝グリッド（参考: Craft / Frame）。
 * **プレビューは中身を出す。** 実際の書き出しを小さく出して見分けられるようにする。
 * 社員の色はここには出さない（色はオフィスと進捗の可視化だけ）。
 * 中身は store だけ — AI社員が書いたものが、書いたぶんだけ並ぶ。
 */

/** サムネイル＝**実際の書き出し**（灰色の棒を置かない） */
function Thumb({ d }: { d: LiveDel }) {
  // 形によって書き出しの割れ方が違う（表は行、文章は文）。**行が先** — 表を1行に潰さない
  const lines = (d.preview ?? '').split('\n')
    .flatMap((l) => l.split(/(?<=。)/)).filter((l) => l.trim()).slice(0, 3);
  return (
    <div style={{
      height: 108, boxSizing: 'border-box', borderRadius: 8, background: RAIL,
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden',
    }}>
      <div style={{ color: T3, fontSize: 10, lineHeight: '14px' }}>{d.workTitle}</div>
      {lines.map((l, i) => (
        <span key={i} style={{ color: '#4E4E4E', fontSize: 9.5, lineHeight: '14px' }}>{l}</span>
      ))}
    </div>
  );
}

/** タブの色は状態から。要確認だけ橙、承認済は緑、それ以外は灰 */
const tabDot = (s: string) => (s === '要確認' ? AMBER : s === '承認済' ? GREEN : MUTE);

export default function DeliverablesPage() {
  const [dels, setDels] = useState<LiveDel[] | null>(null);
  const reload = () => { listDels().then(setDels); };
  useEffect(reload, []);

  const all = dels ?? [];
  const need = all.filter((d) => d.state === '要確認').length;

  /**
   * **タブは本物。** 開いている並びと、いま見ているものを URL に持つ（`?open=a,b&at=1`）。
   */
  const tabs = useTabs(all.map((d) => d.id));
  const docs = tabs.ids.map((id) => all.find((d) => d.id === id)).filter(Boolean) as LiveDel[];
  const top = docs[tabs.at];

  return (
    <>
      <Centre>
        <TopBar title="成果物"
          onPanel={all.length ? () => tabs.open(all[0].id) : undefined} panelOn={docs.length > 0} />

        {all.length > 0 && (
          <div style={{
            height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
            padding: '0 18px', borderBottom: `1px solid ${HAIR}`,
          }}>
            <Icon name="deliv" color={T3} size={15} />
            <span>すべての成果物</span>
            <span style={{ color: T5 }} className="tnum">· {all.length}</span>
            <div style={{ flex: 1 }} />
            {need > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: AMBER_T }}>
                <Dot color={AMBER} size={7} />要確認 {need}
              </span>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 16px ${COMPOSER_H}px` }}>
          {dels !== null && all.length === 0 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: T2 }}>成果物はまだありません</span>
              <span style={{ color: T5, fontSize: 13 }}>
                Work が動くと、AI社員が書いたものがここに並びます — <Link href="/start" className="lnk" style={{ color: T3 }}>はじめる ›</Link>
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {all.map((d) => (
              <div key={d.id} className="card" {...pressable(() => tabs.open(d.id))} style={{
                boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 11,
                padding: 12, borderRadius: 12, background: '#121212',
                border: `1px solid ${top?.id === d.id ? '#333' : 'transparent'}`,
              }}>
                <Thumb d={d} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    {/* 版。直しの成果物は同じ題の新しい版になる（v1 は言わない — 版が増えてから意味を持つ） */}
                    {(d.version ?? 1) > 1 && <span style={{ color: T5, fontSize: 11, flexShrink: 0 }} className="tnum">v{d.version}</span>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: T5 }}>{d.by ?? 'AI社員'}</span>
                    {/* **どの形で持ち出せるか**を、開く前に言う（表データなら .csv、ページなら .html）。
                        ピルにはしない — 例外ではなく、ただの事実 */}
                    <span style={{ color: MUTE, fontSize: 11.5 }}>{formatOf(d.kind, d.preview).label}</span>
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
          </div>
        </div>

        <Composer placeholder="統括AIに指示する" />
      </Centre>

      {top && (
      <Pane width={480} onClose={tabs.close}
            tabs={docs.map((d) => ({ label: d.title, dot: tabDot(d.state) }))}
            tab={tabs.at} onTab={tabs.select}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 16 }}>{top.title}</span>
            {/* **持ち出せない成果物は、無いのと同じ**（→ `components/live/DelTake.tsx`） */}
            <DelTake title={top.title} body={top.body ?? top.preview ?? ''} kind={top.kind} />
          </div>
          <span style={{ color: T5, fontSize: 12, display: 'block', paddingTop: 5 }}>
            {top.by ?? 'AI社員'} · {top.workTitle}{(top.version ?? 1) > 1 ? ` · v${top.version}` : ''}
          </span>
          <div style={{ paddingTop: 16 }}><DelBody body={top.body ?? top.preview ?? ''} kind={top.kind} /></div>
        </div>
        <DelActions delId={top.id} workId={top.workId} taskId={top.taskId}
                    title={top.title} state={top.state} onDone={reload} />
      </Pane>
      )}
    </>
  );
}
