'use client';

import { useEffect, useRef, useState } from 'react';
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

/* ══════════════ メンバー画面の行に置くもの（C案）══════════════
 * **枠を持たない。** 素の文字と粒だけ。面が出るのは指が乗っているあいだ（白3%）と
 * 押した瞬間（5%）だけ。モデルと深さは**別々の操作**で、行の右に縦に積む。
 */

/** モデル ── 押すと名前だけの板が出る。**Thinking 版は並べない**（それは深さのほう） */
export function ModelInline({ value, models }: { value: string; models: readonly string[] }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  return (
    <span ref={box} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 8px',
        borderRadius: 7, color: '#C4C4C4', fontSize: 12.5,
        boxShadow: open ? 'inset 0 0 0 40px rgba(255,255,255,.03)' : undefined,
      }}>
        <span style={{ maxWidth: 172, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="#5F5F5F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span role="listbox" className="pop" style={{
          position: 'absolute', top: 28, right: 0, zIndex: 9, width: 150, padding: 5, borderRadius: 11,
          background: '#1A1A1A', border: '1px solid #2E2E2E', boxShadow: '0 18px 44px rgba(0,0,0,.74)',
        }}>
          {models.map((m) => (
            <button key={m} role="option" aria-selected={m === v} className={m === v ? undefined : 'btn'}
              onClick={() => { setV(m); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', width: '100%', height: 30, padding: '0 10px',
                borderRadius: 7, background: m === v ? '#1F1F1F' : undefined,
                color: m === v ? T1 : T2, fontSize: 12,
              }}>
              {m}<span style={{ flex: 1 }} />
              {m === v && <span style={{ color: '#5BB974', fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * 深さ ── **thinking の量**を決める。モデルは変わらない。
 * いちばん左が「考えずに答える」、右へ行くほど深く考える。
 */
export function EffortInline({ value, words }: { value: number; words: readonly string[] }) {
  const [v, setV] = useState(value);
  const [tip, setTip] = useState(false);
  return (
    <span onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 9, height: 24, padding: '0 8px', borderRadius: 7 }}>
      <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>深さ</span>
      <span role="slider" aria-label="思考の深さ" tabIndex={0}
        aria-valuemin={0} aria-valuemax={words.length - 1} aria-valuenow={v} aria-valuetext={words[v]}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setV(Math.min(v + 1, words.length - 1)); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setV(Math.max(v - 1, 0)); }
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 6 }}>
        {words.map((w, i) => (
          <button key={w} aria-label={w} onClick={() => setV(i)} style={{
            width: i === v ? 13 : 3.5, height: i === v ? 16 : 3.5, borderRadius: i === v ? 5 : 999,
            background: i === v ? '#D8D8D8' : i < v ? '#4A4A4A' : '#2E2E2E', flexShrink: 0,
            transition: 'background-color .12s ease',
          }} />
        ))}
      </span>
      {tip && (
        <span className="pop" style={{
          position: 'absolute', bottom: 26, right: 0, zIndex: 8, padding: '4px 9px', borderRadius: 7,
          background: '#232323', color: '#D8D8D8', fontSize: 11, whiteSpace: 'nowrap',
          boxShadow: '0 10px 26px rgba(0,0,0,.6)', pointerEvents: 'none',
        }}>{words[v]}</span>
      )}
    </span>
  );
}
