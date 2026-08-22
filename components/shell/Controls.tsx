'use client';

import { useState } from 'react';
import { EffortSlider } from '@/components/shell/Chrome';

/**
 * 触ったその場で効くもの。**保存ボタンは置かない**（参考: Linear / Notion の設定）。
 * Phase 4 なので**どこにも保存されない** — 読み込み直すと戻る。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

/** 有効かどうかは青のトグルで示す（「有効」と文字で書かない） */
export function Toggle({ on: init }: { on: boolean }) {
  const [on, setOn] = useState(init);
  return (
    <button role="switch" aria-checked={on} onClick={() => setOn(!on)} style={{
      width: 34, height: 20, borderRadius: 999, background: on ? BLUE : '#2A2A2A',
      display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0,
      transition: 'background-color .16s ease',
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999, background: '#fff',
        transform: `translateX(${on ? 14 : 0}px)`, transition: 'transform .16s cubic-bezier(.2,.8,.3,1)',
      }} />
    </button>
  );
}

/** 自動 / 手動 の2択（ChatGPT のモデル選択と同じ形） */
export function Seg({ options, value, onPick }:
  { options: readonly string[]; value: string; onPick: (v: string) => void }) {
  return (
    <span style={{
      display: 'inline-flex', gap: 2, flexShrink: 0, padding: 3, borderRadius: 8,
      background: '#141414', border: '1px solid #232323',
    }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onPick(o)} className={on ? undefined : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 12px', borderRadius: 5,
            fontSize: 12, whiteSpace: 'nowrap',
            background: on ? '#2A2A2A' : undefined, color: on ? T1 : T4,
            transition: 'background-color .12s ease, color .12s ease',
          }}>{o}</button>
        );
      })}
    </span>
  );
}

/** モデル — 自動のときは選んだ結果だけ見せる */
export function ModelPick() {
  const [mode, setMode] = useState<'自動' | '手動'>('自動');
  const [tier, setTier] = useState('標準');
  const name = tier === '高速' ? 'Haiku 4.5' : tier === '高精度' ? 'Opus 5' : 'Sonnet 5';
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 6 }}>
        <span style={{ color: T3 }}>モデル</span>
        <div style={{ flex: 1 }} />
        <Seg options={['自動', '手動'] as const} value={mode} onPick={(v) => setMode(v as '自動' | '手動')} />
      </div>
      {mode === '自動' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', paddingTop: 4 }}>
          <span style={{ color: T3, fontSize: 12.5 }}>自動で {tier} を選んでいます</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: T5, fontSize: 12 }}>{name}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
          <Seg options={['高速', '標準', '高精度'] as const} value={tier} onPick={setTier} />
          <div style={{ flex: 1 }} />
          <span style={{ color: T5, fontSize: 12 }}>{name}</span>
        </div>
      )}
    </div>
  );
}

/** 思考の深さ — 自動のときはつまみを沈めて「いまどこか」だけ見せる */
export function EffortPick() {
  const [mode, setMode] = useState<'自動' | '手動'>('自動');
  const [v, setV] = useState(58);
  const word = v < 34 ? '浅め' : v < 67 ? '中' : '深め';
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 6 }}>
        <span style={{ color: T3 }}>思考の深さ</span>
        <div style={{ flex: 1 }} />
        <Seg options={['自動', '手動'] as const} value={mode} onPick={(m) => setMode(m as '自動' | '手動')} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 3px 6px' }}>
        <span style={{ color: T4, fontSize: 12 }}>速い</span>
        <span style={{ color: T4, fontSize: 12 }}>深い</span>
      </div>
      <EffortSlider pct={v} dim={mode === '自動'} onChange={mode === '手動' ? setV : undefined} />
      <span style={{ color: mode === '自動' ? T3 : T2, fontSize: 12.5, paddingTop: 8 }}>
        {mode === '自動' ? `自動で ${word} を選んでいます` : `${word} にしています`}
      </span>
    </div>
  );
}
