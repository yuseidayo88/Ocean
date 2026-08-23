'use client';

import { useEffect, useRef, useState } from 'react';

import { BLUE, EDGE, FAINT, GREEN_T, LINE, MUTE, RAIL, SUNK, T1, T2, T4, T5, WELL } from '@/lib/design/tokens';
/**
 * 触ったその場で効くもの。**保存ボタンは置かない**（参考: Linear / Notion の設定）。
 * **まだどこにも保存されない** — 読み込み直すと戻る（書き込みは Phase 7 から）。
 *
 * 旧版の `ModelPick` / `EffortPick`（自動・手動の切り替え ＋ 0〜100 のスライダー）は消した。
 * メンバー画面のC案で `ModelInline` / `EffortInline` に置き換わっていたのに残っていて、
 * しかも **深さで階層（モデル）を切り替える閾値** を持っていた —
 * 「深さは thinking の量、モデルは変わらない」という決めごとと**逆のもの**が、
 * 使われないまま見本として残っている状態だった。
 */

/** 有効かどうかは青のトグルで示す（「有効」と文字で書かない） */
export function Toggle({ on: init }: { on: boolean }) {
  const [on, setOn] = useState(init);
  return (
    <button role="switch" aria-checked={on} onClick={() => setOn(!on)} style={{
      width: 34, height: 20, borderRadius: 999, background: on ? BLUE : EDGE,
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
      background: RAIL, border: `1px solid ${LINE}`,
    }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onPick(o)} className={on ? undefined : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 12px', borderRadius: 5,
            fontSize: 12, whiteSpace: 'nowrap',
            background: on ? `${EDGE}` : undefined, color: on ? T1 : T4,
            transition: 'background-color .12s ease, color .12s ease',
          }}>{o}</button>
        );
      })}
    </span>
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
          <path d="M3 4.5 6 7.5 9 4.5" stroke={T5} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span role="listbox" className="pop" style={{
          position: 'absolute', top: 28, right: 0, zIndex: 9, width: 150, padding: 5, borderRadius: 11,
          background: SUNK, border: `1px solid ${FAINT}`, boxShadow: '0 18px 44px rgba(0,0,0,.74)',
        }}>
          {models.map((m) => (
            <button key={m} role="option" aria-selected={m === v} className={m === v ? undefined : 'btn'}
              onClick={() => { setV(m); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', width: '100%', height: 30, padding: '0 10px',
                borderRadius: 7, background: m === v ? `${WELL}` : undefined,
                color: m === v ? T1 : T2, fontSize: 12,
              }}>
              {m}<span style={{ flex: 1 }} />
              {m === v && <span style={{ color: GREEN_T, fontSize: 11 }}>✓</span>}
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
            background: i === v ? '#D8D8D8' : i < v ? `${MUTE}` : FAINT, flexShrink: 0,
            transition: 'background-color .12s ease',
          }} />
        ))}
      </span>
      {tip && (
        <span className="pop" style={{
          position: 'absolute', bottom: 26, right: 0, zIndex: 8, padding: '4px 9px', borderRadius: 7,
          background: LINE, color: '#D8D8D8', fontSize: 11, whiteSpace: 'nowrap',
          boxShadow: '0 10px 26px rgba(0,0,0,.6)', pointerEvents: 'none',
        }}>{words[v]}</span>
      )}
    </span>
  );
}
