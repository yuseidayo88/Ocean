'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { Icon } from '@/components/ui/Icon';
import { FLOW, type FlowKind } from '@/lib/dummy';

/**
 * ワークフロー＝左から右へ流れるノードグラフ
 * （参考: Datadog のネットワークマップ / n8n 系のエージェントキャンバス）。
 *   ノード＝左3pxの色帯 ＋ タイトル ＋ サブ1行（種類 · 状態）。中にアイコンの四角を置かない。
 *   ポートは小さな開いた円をノードの左右中央に置き、ベジェ曲線でつなぐ。
 *   線の上のラベルは素の小さい文字。**色がつくのは判断待ちのノードだけ**。待機は点線で沈める。
 *   盤面は 1148×760 で入力欄の下まで伸ばす。操作方法の説明文は置かない。
 */

const GW = 1148, GH = 760, BG = '#060606';
const NH = 66, CW = 182, RW = 196;
const T1 = '#EDEDED', T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';

/** 連鎖は 228px おき。右の列は 932。行の中心は 313 / 195 / 431 */
const CX = [16, 244, 472, 700];
const RX = 932;
const ROW = 280;
const RY = [162, 280, 398];

type Skin = { bg: string; border: string; bar: string; title: string; sub: string; ring?: boolean };
const SKIN: Record<FlowKind, Skin> = {
  done: { bg: '#0B0B0B', border: '1px solid #1D1D1D', bar: '#1E8E3E', title: T2, sub: T5 },
  sel:  { bg: '#101010', border: '1px solid #333333', bar: '#8A8A8A', title: T1, sub: T4, ring: true },
  gate: { bg: 'rgba(227,116,0,0.05)', border: '1px solid rgba(227,116,0,0.28)', bar: '#E37400', title: T1, sub: '#FDD663' },
  wait: { bg: '#080808', border: '1px dashed #1F1F1F', bar: '#1C1C1C', title: T4, sub: T5 },
  work: { bg: '#0C0C0C', border: '1px solid #272727', bar: '#2E2E2E', title: T2, sub: T5 },
};

function Node({ x, y, w, title, sub, kind, href = '/work/w-japanese' }:
  { x: number; y: number; w: number; title: string; sub: string; kind: FlowKind; href?: string }) {
  const s = SKIN[kind];
  return (
    <Link href={href as Route} style={{
      position: 'absolute', left: x, top: y, width: w, height: NH, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', padding: '0 14px 0 15px', borderRadius: 14,
      background: s.bg, border: s.border, overflow: 'hidden',
      boxShadow: s.ring ? '0 0 0 3px rgba(255,255,255,0.06)' : undefined,
      cursor: 'pointer', transition: 'border-color .14s ease, background-color .14s ease',
    }} className="card">
      <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: '0 2px 2px 0', background: s.bar }} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: s.title, fontSize: 14, lineHeight: '19px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <span style={{ color: s.sub, fontSize: 11, lineHeight: '15px', whiteSpace: 'nowrap' }}>{sub}</span>
      </div>
    </Link>
  );
}

const Port = ({ x, y, on = false }: { x: number; y: number; on?: boolean }) => (
  <div style={{
    position: 'absolute', left: x - 4.5, top: y - 4.5, width: 9, height: 9, boxSizing: 'border-box',
    borderRadius: 999, background: BG, border: `1.5px solid ${on ? '#4E4E4E' : '#2E2E2E'}`,
  }} />
);

const edge = (k: string, x1: number, y1: number, x2: number, y2: number, dash = false) => (
  <path key={k} d={`M ${x1} ${y1} C ${x1 + 24} ${y1}, ${x2 - 24} ${y2}, ${x2} ${y2}`}
        fill="none" stroke="#282828" strokeWidth={1.3} strokeDasharray={dash ? '4 4' : undefined} />
);

const ELabel = ({ x, y, t }: { x: number; y: number; t: string }) => (
  <div style={{
    position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', padding: '0 5px',
    color: T5, fontSize: 11, whiteSpace: 'nowrap', background: BG,
  }}>{t}</div>
);

/** 選択中のフェーズノードの下にぶら下がるサブポート */
const Sub = ({ x, top, label }: { x: number; top: number; label: string }) => (
  <>
    <div style={{ position: 'absolute', left: x, top, width: 1, height: 15, background: '#262626' }} />
    <div style={{
      position: 'absolute', left: x - 10.5, top: top + 15, width: 21, height: 21, boxSizing: 'border-box',
      borderRadius: 999, background: '#131313', border: '1px solid #2E2E2E',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Icon name="plus" color={T4} size={11} /></div>
    <div style={{
      position: 'absolute', left: x, top: top + 41, transform: 'translateX(-50%)',
      color: T5, fontSize: 11, whiteSpace: 'nowrap',
    }}>{label}</div>
  </>
);

const Tool = ({ name, on = false }: { name: 'hand' | 'expand' | 'minus' | 'plus'; on?: boolean }) => (
  <span className={on ? 'hit' : 'icob'} style={{
    width: 28, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', background: on ? '#262626' : undefined,
  }}><Icon name={name} color={on ? T1 : '#8B8B8B'} size={15} width={1.7} /></span>
);

export function Flow() {
  const cy = (top: number) => top + NH / 2;
  const rowY = RY.map(cy);
  const mid = cy(ROW);
  const out = (i: number) => CX[i] + CW;

  return (
    <div style={{
      position: 'relative', width: GW, height: GH, flexShrink: 0, overflow: 'hidden',
      // 大きさが決まっていて中身も外に出ないので、外の計算から切り離す
      contain: 'strict',
      backgroundColor: BG, backgroundImage: 'radial-gradient(#161616 1px, transparent 1px)', backgroundSize: '22px 22px',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 70% at 42% 40%, rgba(255,255,255,0.028), rgba(0,0,0,0) 72%)' }} />

      <svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`} style={{ position: 'absolute', inset: 0 }}>
        {[0, 1, 2].map((i) => edge(`c${i}`, out(i), mid, CX[i + 1], mid))}
        {rowY.map((y, i) => edge(`r${i}`, out(3), mid, RX, y, i === 1))}
        {[rowY[0], rowY[2]].map((y, i) => edge(`s${i}`, RX + RW, y, RX + RW + 26, y, true))}
      </svg>

      {FLOW.chain.map((n, i) => <Node key={n.id} x={CX[i]} y={ROW} w={CW} {...n} />)}
      {FLOW.right.map((n, i) => <Node key={n.id} x={RX} y={RY[i]} w={RW} {...n} />)}

      {CX.map((x, i) => (
        <span key={x}>
          {i > 0 && <Port x={x} y={mid} on />}
          <Port x={x + CW} y={mid} on />
        </span>
      ))}
      {rowY.map((y) => <span key={y}><Port x={RX} y={y} /><Port x={RX + RW} y={y} /></span>)}

      {/* 線の上のラベル。曲線に 12px かぶせず、まっすぐな線だけ下に逃がす */}
      {FLOW.right.map((n, i) => (
        <ELabel key={n.id} x={RX - 25} y={(mid + rowY[i]) / 2 + (i === 1 ? 12 : -12)} t={n.edge} />
      ))}

      {FLOW.subs.map((s, i) => <Sub key={s} x={CX[1] + 54 + i * 76} top={ROW + NH} label={s} />)}

      {/* 下中央のツールバー。操作説明は置かない */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 124, transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 3, padding: '5px 7px', borderRadius: 12,
        background: '#121212', border: '1px solid #2A2A2A',
      }}>
        <span style={{ color: T5, fontSize: 12, padding: '0 5px' }}>⠿</span>
        <Tool name="hand" on />
        <Tool name="expand" />
        <span style={{ width: 1, height: 18, background: '#262626', margin: '0 4px' }} />
        <Tool name="minus" />
        <span style={{ color: T2, fontSize: 12, padding: '0 4px' }} className="tnum">100%</span>
        <Tool name="plus" />
      </div>

      {/* 右下のミニマップ */}
      <div style={{
        position: 'absolute', right: 14, bottom: 124, width: 148, height: 84, borderRadius: 10,
        background: '#0A0A0A', border: '1px solid #232323', overflow: 'hidden',
      }}>
        {([[10, 34, 24, 9, '#232323'], [40, 34, 24, 9, '#3A3A3A'], [70, 34, 22, 9, '#232323'],
           [98, 34, 22, 9, 'rgba(227,116,0,0.55)'], [124, 16, 16, 8, '#2A2A2A'],
           [124, 34, 16, 8, '#1E1E1E'], [124, 52, 16, 8, '#2A2A2A']] as const).map(([x, y, w, h, c]) => (
          <div key={`${x}-${y}`} style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 2, background: c }} />
        ))}
        <div style={{
          position: 'absolute', left: 4, top: 20, width: 96, height: 44, borderRadius: 5,
          border: '1px solid #4A4A4A', background: 'rgba(255,255,255,0.03)',
        }} />
      </div>
    </div>
  );
}
