'use client';

import { Icon } from '@/components/ui/Icon';

/**
 * ワークフロー＝左から右へ流れるノードグラフ。
 *   ノード＝左3pxの色帯 ＋ タイトル ＋ サブ1行（種類 · 状態）。
 *   中にアイコンの四角を置かない。ヘッダ帯も状態ピルも置かない。
 *   色がつくのは 判断待ち のノードだけ。待機は点線で沈める。
 *   盤面は入力欄の下まで伸ばし、入力欄はその上に浮く。操作説明は置かない。
 */

const GW = 1148, GH = 760;
const NW = 182, NH = 66, BW = 196;
const Y1 = 240;
const XS = [16, 244, 472, 700];
const BX = 932;
const BY = [122, 240, 358];

const T1 = '#EDEDED', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663';

type Kind = 'done' | 'now' | 'wait' | 'next';

const NODE_BG: Record<Kind, string> = {
  done: '#0E0E0E', now: '#101010', wait: 'rgba(227,116,0,0.07)', next: 'transparent',
};
const BAR: Record<Kind, string> = { done: '#3A3A3A', now: '#6E6E6E', wait: AMBER, next: '#232323' };

function Node({ x, y, w = NW, title, sub, kind }:
  { x: number; y: number; w?: number; title: string; sub: string; kind: Kind }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: NH, boxSizing: 'border-box',
      borderRadius: 15, background: NODE_BG[kind], overflow: 'hidden',
      border: kind === 'next' ? '1px dashed #242424' : `1px solid ${kind === 'wait' ? 'rgba(227,116,0,0.32)' : '#1E1E1E'}`,
      display: 'flex', alignItems: 'center', paddingLeft: 16,
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: BAR[kind] }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, paddingRight: 12 }}>
        <span style={{ color: kind === 'next' ? T5 : T1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <span style={{ color: kind === 'wait' ? AMBER_T : T5, fontSize: 11, whiteSpace: 'nowrap' }}>{sub}</span>
      </div>
    </div>
  );
}

const Port = ({ x, y, on = false }: { x: number; y: number; on?: boolean }) => (
  <div style={{
    position: 'absolute', left: x - 4.5, top: y - 4.5, width: 9, height: 9, borderRadius: 999,
    background: '#000', border: `1px solid ${on ? '#6E6E6E' : '#2A2A2A'}`,
  }} />
);

function edge(x1: number, y1: number, x2: number, y2: number, dash = false) {
  const mx = (x1 + x2) / 2;
  return <path key={`${x1}-${y1}-${x2}-${y2}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
               fill="none" stroke="#282828" strokeWidth={1} strokeDasharray={dash ? '4 4' : undefined} />;
}

const ELabel = ({ x, y, t }: { x: number; y: number; t: string }) => (
  <span style={{
    position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
    color: T5, fontSize: 10.5, whiteSpace: 'nowrap', background: '#000', padding: '0 6px',
  }}>{t}</span>
);

/** フェーズノードの下にぶら下がるサブポート */
const Sub = ({ x, top, label }: { x: number; top: number; label: string }) => (
  <>
    <div style={{ position: 'absolute', left: x - 0.5, top, width: 1, height: 14, background: '#1E1E1E' }} />
    <div style={{
      position: 'absolute', left: x, top: top + 14, transform: 'translateX(-50%)',
      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    }}>
      <Icon name="plus" color="#3A3A3A" size={9} />
      <span style={{ color: '#4A4A4A', fontSize: 10.5 }}>{label}</span>
    </div>
  </>
);

export function Flow() {
  const cy = Y1 + NH / 2;
  return (
    <div style={{
      position: 'relative', width: GW, height: GH, flexShrink: 0, overflow: 'hidden',
      backgroundImage: 'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.035), rgba(0,0,0,0) 62%), radial-gradient(#1A1A1A 1px, transparent 1px)',
      backgroundSize: '100% 100%, 22px 22px',
    }}>
      <svg width={GW} height={GH} style={{ position: 'absolute', inset: 0 }}>
        {edge(XS[0] + NW, cy, XS[1], cy)}
        {edge(XS[1] + NW, cy, XS[2], cy)}
        {edge(XS[2] + NW, cy, XS[3], cy, true)}
        {edge(XS[3] + NW, cy, BX, BY[0] + NH / 2, true)}
        {edge(XS[3] + NW, cy, BX, BY[1] + NH / 2, true)}
        {edge(XS[3] + NW, cy, BX, BY[2] + NH / 2, true)}
      </svg>

      <Node x={XS[0]} y={Y1} title="調査" sub="フェーズ · 完了" kind="done" />
      <Node x={XS[1]} y={Y1} title="設計" sub="フェーズ · 実行中" kind="now" />
      <Node x={XS[2]} y={Y1} title="価格モデルの決定" sub="判断 · 判断待ち" kind="wait" />
      <Node x={XS[3]} y={Y1} title="制作" sub="フェーズ · 待機" kind="next" />
      <Node x={BX} y={BY[0]} w={BW} title="MVP" sub="成果物 · 待機" kind="next" />
      <Node x={BX} y={BY[1]} w={BW} title="LPと申込フォーム" sub="Work · 実行中" kind="now" />
      <Node x={BX} y={BY[2]} w={BW} title="SNS運用の立ち上げ" sub="Work · 実行中" kind="now" />

      {[XS[0], XS[1], XS[2], XS[3]].map((x) => <Port key={`i${x}`} x={x} y={cy} />)}
      {[XS[0] + NW, XS[1] + NW, XS[2] + NW, XS[3] + NW].map((x) => <Port key={`o${x}`} x={x} y={cy} on />)}
      {BY.map((y) => <Port key={`b${y}`} x={BX} y={y + NH / 2} />)}

      <ELabel x={(XS[0] + NW + XS[1]) / 2} y={cy} t="次のフェーズ" />
      <ELabel x={(XS[2] + NW + XS[3]) / 2} y={cy} t="決まったら" />
      <ELabel x={(XS[3] + NW + BX) / 2} y={(cy + BY[2] + NH / 2) / 2 + 30} t="新しい Work" />

      <Sub x={XS[0] + 46} top={Y1 + NH} label="担当" />
      <Sub x={XS[0] + 128} top={Y1 + NH} label="成果物 3" />
      <Sub x={XS[1] + 46} top={Y1 + NH} label="担当 2" />
      <Sub x={XS[1] + 128} top={Y1 + NH} label="成果物 1" />

      {/* 下中央のツールバー。操作説明は置かない */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 124, transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 4, padding: 5, borderRadius: 12,
        background: '#101010', border: '1px solid #262626',
      }}>
        {(['panel', 'plus', 'close', 'search'] as const).map((n, i) => (
          <span key={n} style={{
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: i === 0 ? '#1C1C1C' : undefined,
          }}><Icon name={n} color={i === 0 ? '#B8B8B8' : T4} size={14} /></span>
        ))}
      </div>

      {/* 右下のミニマップ */}
      <div style={{
        position: 'absolute', right: 16, bottom: 124, width: 148, height: 92, borderRadius: 10,
        background: '#080808', border: '1px solid #1C1C1C', overflow: 'hidden',
      }}>
        {[[6, 38, 22], [34, 38, 22], [62, 38, 22], [90, 38, 22], [120, 18, 24], [120, 40, 24], [120, 62, 24]].map(([x, y, w], i) => (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: w, height: 8, borderRadius: 2,
            background: i === 2 ? 'rgba(227,116,0,0.5)' : '#242424',
          }} />
        ))}
      </div>
    </div>
  );
}
