'use client';

import { useRef } from 'react';
import { layout, type Placed } from '@/lib/diagram/layout';
import type { Workflow } from '@/lib/diagram/types';
import { useSize } from '@/lib/use-size';
import { AMBER, AMBER_T, CANVAS, CARD, DIM, EDGE, GREEN_T, LINE, MUTE, RULE, T1, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * ワークフローの図（成果物）。**archify の形を、この会社の言葉で描く**
 * （→ `lib/diagram/types.ts` に、何を持ち込んで何を落としたか）。
 *
 * 描き方はホームの**ワークフローの地図とまったく同じ語彙**にしてある —
 * 格子・**直角に曲がる線**（角だけ丸める）・**左3pxの色帯 ＋ タイトル ＋ サブ1行**・
 * ドットの背景。**同じ会社の中で2つの図法を作らない。**
 *
 * 地図と違うのは1つだけ: **これは動かさない。** 成果物は読むもので、
 * 探すものではない（Work は3〜8本あるが、1枚の図は12ノードまで）。
 * だから**器に合わせて1枚に収める** — 拡大縮小の道具も、ミニマップも置かない。
 *
 * **色は意味だけに使う**（→ CLAUDE.md）:
 *   判断＝橙（あなたが決める）／ 終わり＝緑（到達）／ それ以外は灰。
 *   例外のレーンは点線で沈める。**凡例は置かない** — 橙と ◆ は全画面で同じ意味。
 */
/**
 * **これ以上は縮めない。** 狭い器（右ペインは 440px）に無理やり収めると
 * 0.4倍になって**文字が読めなくなる** — 実際そうなった。
 * この会社の決まりは「文字は縮めない」なので、**縮めるのをやめて横に送る**
 * （中で送るところは縦と横を分ける → `.sx`）。
 */
const MIN_K = 0.8;

export function WorkflowView({ wf, min = 160 }: { wf: Workflow; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const { w: bw } = useSize(box);
  const g = layout(wf);
  // **器に合わせる。** 大きくはしない（粗くなる）。縮めるのは 0.8 まで
  const k = bw ? Math.max(MIN_K, Math.min(1, (bw - 2) / g.w)) : 1;
  const wide = bw > 0 && g.w * k > bw;

  return (
    <div ref={box} style={{ width: '100%' }}>
      <div style={{ paddingBottom: 10 }}>
        <span style={{ color: T1, fontSize: 13.5 }}>{wf.meta.title}</span>
        {wf.meta.subtitle && (
          <span style={{ color: T5, fontSize: 12, paddingLeft: 10 }}>{wf.meta.subtitle}</span>
        )}
      </div>
      <div className={wide ? 'sx' : undefined} style={{
        position: 'relative', width: '100%', height: Math.max(min, g.h * k) + (wide ? 10 : 0),
        borderRadius: 10, background: CANVAS,
        overflowX: wide ? 'auto' : 'hidden', overflowY: 'hidden',
        backgroundImage: `radial-gradient(${RULE} 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      }}>
        <div style={{
          position: 'relative', width: g.w * k, height: g.h * k, flexShrink: 0,
        }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, width: g.w, height: g.h,
          transform: `scale(${k})`, transformOrigin: '0 0',
        }}>
          {/* 帯（フェーズ）。**中に文字を書かない** — 名前は上に置く */}
          {g.bands.map((b, i) => (
            <div key={i} style={{
              position: 'absolute', left: b.x, top: 8, width: b.w, height: 18,
              borderLeft: `1px solid ${RULE}`, paddingLeft: 8,
            }}>
              <span style={{ color: T5, fontSize: 11 }}>{b.label}</span>
            </div>
          ))}

          {/* レーンの名前。行の左端に、素の文字で */}
          {g.lanes.map((l, i) => (
            <span key={i} style={{
              position: 'absolute', left: 4, top: l.y - 16, color: l.faint ? MUTE : T5, fontSize: 11,
            }}>{l.label}</span>
          ))}

          {/* 線。**ラベルは素の小さい文字**（ピルにしない） */}
          <svg width={g.w} height={g.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <marker id="wf-tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill={DIM} />
              </marker>
            </defs>
            {g.wires.map((v, i) => (
              <path key={i} d={v.d} fill="none" markerEnd="url(#wf-tip)"
                stroke={v.role === 'error' ? MUTE : DIM}
                strokeWidth={v.role === 'main' ? 1.6 : 1.2}
                strokeDasharray={v.role === 'main' ? undefined : v.faint || v.role === 'async' ? '4 4' : undefined}
                opacity={v.faint ? 0.5 : 1} />
            ))}
          </svg>
          {g.wires.filter((v) => v.label).map((v, i) => (
            <span key={i} style={{
              position: 'absolute', left: v.lx, top: v.ly, transform: 'translateX(-50%)',
              color: v.faint ? MUTE : T5, fontSize: 10.5, whiteSpace: 'nowrap',
              background: CANVAS, padding: '0 5px',
            }}>{v.label}</span>
          ))}

          {g.nodes.map((n) => <Node key={n.id} n={n} />)}
        </div>
        </div>
      </div>
    </div>
  );
}

/** 左3pxの色帯 ＋ タイトル ＋ サブ1行。**中にアイコンの四角を置かない** */
function Node({ n }: { n: Placed }) {
  const bar = n.type === 'decision' ? AMBER : n.type === 'end' ? GREEN_T : T3;
  const dashed = n.type === 'wait' || n.faint;
  return (
    <div style={{
      position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
      borderRadius: 14, background: CARD,
      border: `1px ${dashed ? 'dashed' : 'solid'} ${dashed ? RULE : EDGE}`,
      display: 'flex', alignItems: 'center', opacity: n.faint ? 0.62 : 1, overflow: 'hidden',
    }}>
      <span style={{ width: 3, alignSelf: 'stretch', background: bar, flexShrink: 0 }} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px' }}>
        <span className="clip" style={{
          color: T1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{n.label}</span>
        {(n.sublabel || n.type === 'decision') && (
          <span className="clip" style={{
            color: n.type === 'decision' ? AMBER_T : T4, fontSize: 11,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{n.type === 'decision' ? `あなたが決める${n.sublabel ? ` · ${n.sublabel}` : ''}` : n.sublabel}</span>
        )}
      </div>
    </div>
  );
}

/** 図が読めなかったとき。**白い画面にしない**（何が起きたかを言う） */
export function DiagramBroken({ why }: { why: string }) {
  return (
    <div style={{
      borderRadius: 10, border: `1px dashed ${LINE}`, padding: '14px 16px',
      color: T5, fontSize: 12.5, lineHeight: '20px',
    }}>{why}</div>
  );
}
