'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useParam } from '@/lib/use-open';
import { pressable } from '@/lib/a11y';

import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';
import type { DeskBody, Lane } from '@/lib/view/model';
import { AMBER, AMBER_T, COMPOSER_H, DIM, FAINT, GREEN, GREEN_T, HAIR, MUTE, RAIL, RULE, SEAM, SUNK, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * デスク＝縦長レーンを横に並べる（参考: Emergent / Google AI Studio）。
 * 稼働中の社員の手もとを一気に見る。1人1レーン、人が増えたら横スクロール。
 *
 * **レーンはカードにしない。** ヘアラインで区切った列にする
 * （枠付きカードを並べるのが「AIっぽさ」の正体）。
 * 要確認も面を塗らず、頭のピルと足もとの橙のボタンだけで言う。
 *
 * **中身の器は担当ではなく produces で決める**（業種を埋め込まない）。
 * 本当に動く前提なので、止まっているときは止まっていると出す。
 */

const LANE_W = 268, LANE_MIN = 240;

/** 出てくる順に少しずつ遅らせる */
const rv = (d: number) => ({ animationDelay: `${d.toFixed(1)}s` });

function Body({ b }: { b: DeskBody }) {
  if (b.kind === 'facts') {
    return (
      <>
        <span style={{ color: T5, fontSize: 11 }}>
          {b.cap} <span style={{ color: T3 }} className="tnum">{b.n}</span>
        </span>
        <div style={{ padding: '3px 0 0' }}>
          {b.items.map((t, i) => (
            <div key={i} className="rv" style={{ display: 'flex', gap: 7, padding: '4px 0', ...rv(1.4 + i * 0.6) }}>
              <span style={{ color: DIM, flexShrink: 0 }}>·</span>
              <span style={{ color: T3, fontSize: 12, lineHeight: '18px' }}>{t}</span>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (b.kind === 'text') {
    return (
      <>
        <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{b.file}</span>
        <div style={{ padding: '5px 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {b.lines.map((l, i) => (
            <span key={i} className="rv" style={{
              color: i === b.lines.length - 1 ? T4 : T3, fontSize: 12, lineHeight: '19px', ...rv(1.2 + i * 0.6),
            }}>{l}</span>
          ))}
        </div>
      </>
    );
  }
  if (b.kind === 'code') {
    return (
      <>
        <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{b.file}</span>
        <div style={{ padding: '5px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {b.lines.map(([n, code, added], i) => (
            <div key={n} className="rv" style={{
              display: 'flex', gap: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
              ...rv(1.2 + i * 0.4),
            }}>
              <span style={{ color: '#333', width: 16, textAlign: 'right', flexShrink: 0 }} className="tnum">{n}</span>
              <span style={{ width: 8, flexShrink: 0, color: added ? GREEN_T : 'transparent' }}>+</span>
              {/* コードの行は長いので**わざと**切る。clip は「切れていて正しい」の印 */}
              <span className="clip" style={{ color: added ? GREEN_T : T4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {code}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, paddingTop: 8 }}>
          {b.foot.map((f, i) => (
            <span key={f} style={{ color: i === 0 ? GREEN_T : T5, fontSize: 11 }} className="tnum">{f}</span>
          ))}
        </div>
      </>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {/* 成果物のサムネイルだけは面を持てる */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: RAIL }}>
        <span style={{
          width: 32, height: 26, flexShrink: 0, boxSizing: 'border-box', borderRadius: 5, background: SUNK,
          display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 4px',
        }}>
          {['100%', '100%', '66%'].map((w, i) => (
            <span key={i} style={{ height: 2, width: w, borderRadius: 1, background: i === 0 ? `${FAINT}` : RULE }} />
          ))}
        </span>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
          <span style={{ color: T5, fontSize: 10 }}>{b.when}</span>
        </div>
      </div>
      <Link href={'/decisions'} className="solid" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32,
        borderRadius: 8, background: AMBER, color: '#fff', fontSize: 12,
      }}>{b.action}</Link>
    </div>
  );
}

export function Desk({ lanes, idle }: {
  lanes: Lane[]; idle: { id: string; name: string; color: string }[];
}) {
  const running = lanes.filter((l) => l.state === '実行中').length;
  /**
   * **1人を選ぶと全画面。** レーンは押せる顔（`hit`）をしていたのに何も起きなかった。
   * 誰を見ているかは URL に持つので、別の画面から「その1人の手もと」へ直接飛べる。
   */
  const [who, setWho] = useParam('who', '');
  const only = lanes.find((l) => l.id === who) ? who : '';
  const shown = only ? lanes.filter((l) => l.id === only) : lanes;

  return (
    <div style={{
      flex: 1, minHeight: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: `16px 24px ${COMPOSER_H}px`, overflow: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 1140, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, height: 20 }}>
          {only ? (
            <button onClick={() => setWho('')} className="lnk" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, color: T4, fontSize: 12,
            }}>
              <Icon name="back" color={T5} size={12} />全員の手もとに戻る
            </button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T4, fontSize: 12 }}>
              <Dot color={GREEN} size={6} />実行中 <span className="tnum">{running}</span>
            </span>
          )}
        </div>

        {/* **横にだけ送る**（`.sx`）。`overflowX` だけだと縦も動く器になる */}
        <div className="sx" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {shown.map((l, n) => {
            const wait = l.state === '要確認';
            const last = only ? true : n === shown.length - 1 && idle.length === 0;
            return (
              <div key={l.id} className="hit" {...(only ? {} : pressable(() => setWho(l.id)))} style={{
                // 少なければ伸びて画面を埋め、増えたら LANE_MIN まで縮んでから横スクロール
                flex: only ? '1 1 auto' : `1 1 ${LANE_W}px`,
                minWidth: only ? 0 : LANE_MIN, maxWidth: only ? undefined : 320,
                boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                padding: '2px 15px 10px 0', marginRight: last ? 0 : 15,
                borderRight: last ? undefined : `1px solid ${HAIR}`,
              }}>
                <Link href={openHref('/team', l.id)} onClick={(ev) => ev.stopPropagation()} className="row" style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 8,
                  padding: '4px 6px', margin: '-4px -6px',
                }}>
                  <Orb color={l.color} size={30} seed={l.name.length * 7 + 3} dim={wait} />
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {/* 例外だけピル。ふつうの状態は点で足りる */}
                  {wait ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 5,
                      background: 'rgba(227,116,0,0.16)', color: AMBER_T, fontSize: 11, whiteSpace: 'nowrap',
                    }}>要確認</span>
                  ) : <Dot color={GREEN} size={6} />}
                </Link>

                <div style={{ flexShrink: 0, padding: '10px 0 9px' }}>
                  <span style={{ color: T2, fontSize: 13, lineHeight: '20px' }}>{l.line}</span>
                </div>

                {/* 工程。いま動いている1行だけ光る */}
                <div style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column',
                  padding: '9px 0', borderBottom: `1px solid ${HAIR}`,
                }}>
                  {l.steps.map(([s, t], i) => {
                    const now = i === l.steps.length - 1 && !wait;
                    return (
                      <div key={s} className="rv" style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', ...rv(now ? 0.8 : 0),
                      }}>
                        {now
                          ? <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth={2.2}
                                 style={{ flexShrink: 0, animation: 'spin 1.5s linear infinite' }}>
                              <circle cx="12" cy="12" r="8.5" strokeDasharray="30 20" />
                            </svg>
                          : <Icon name="check" color={MUTE} size={12} width={2.4} />}
                        <span className={now ? 'sh' : undefined} style={{
                          minWidth: 0, color: now ? undefined : T4, fontSize: 12,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{s}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ color: '#3F3F3F', fontSize: 10, whiteSpace: 'nowrap' }} className="tnum">{t}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '9px 0 0', overflow: 'hidden' }}>
                  <Body b={l.body} />
                </div>

                <div style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                  paddingTop: 9, borderTop: `1px solid ${HAIR}`,
                }}>
                  <Link href={l.taskId ? openHref('/tasks', l.taskId) : '/tasks'} className="lnk"
                    style={{ minWidth: 0, color: T5, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.task}
                  </Link>
                  <div style={{ flex: 1 }} />
                  <span style={{ width: 48, flexShrink: 0, height: 5, borderRadius: 3, background: SEAM, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${l.pct}%`, height: '100%', background: wait ? AMBER : T4 }} />
                  </span>
                  <span style={{ color: T5, fontSize: 11 }} className="tnum">{l.elapsed}</span>
                </div>
              </div>
            );
          })}

          {/* 待機は沈める。枠は付けない。1人だけ見ているときは出さない */}
          {shown.length === 0 && idle.length === 0 && (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <span style={{ color: T5, fontSize: 13 }}>まだ誰の手もとも動いていません。Work を開くと動きだします</span>
            </div>
          )}
          {!only && idle.map((e, n) => (
            <div key={e.id} style={{
              width: LANE_W, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
              padding: '2px 15px 10px 0', marginRight: n === idle.length - 1 ? 0 : 15,
              borderRight: n === idle.length - 1 ? undefined : `1px solid ${HAIR}`,
              opacity: 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Orb color={e.color} size={30} seed={e.name.length * 7 + 3} dim />
                <span style={{ color: T4 }}>{e.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: T5, fontSize: 11 }}>待機</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
