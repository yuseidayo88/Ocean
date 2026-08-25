'use client';

import { useEffect, useRef, useState } from 'react';

import { BLUE, EDGE, FAINT, GREEN_T, LINE, MUTE, RAIL, SUNK, T1, T2, T4, T5, WELL } from '@/lib/design/tokens';
import { BY_MAKER, EFFORT_WORD, GRADE_WORD, modelOf, type Effort } from '@/lib/ai/catalog';
/**
 * 触ったその場で効くもの。**保存ボタンは置かない**（参考: Linear / Notion の設定）。
 * **押したその場で保存される**（`agent_prefs`）。値は親が持つ — 開き直しても残る。
 *
 * 旧版の `ModelPick` / `EffortPick`（自動・手動の切り替え ＋ 0〜100 のスライダー）は消した。
 * メンバー画面のC案で `ModelInline` / `EffortInline` に置き換わっていたのに残っていて、
 * しかも **深さで階層（モデル）を切り替える閾値** を持っていた —
 * 「深さは thinking の量、モデルは変わらない」という決めごとと**逆のもの**が、
 * 使われないまま見本として残っている状態だった。
 */

/**
 * 有効かどうかは青のトグルで示す（「有効」と文字で書かない）。
 *
 * **自分では値を持たない。** 前は `useState` で写しを持っていたので、
 * 保存に失敗して親が戻したときや、読み直して値が変わったときに、
 * **つまみだけが古いまま**残った（画面が嘘をつく）。真実は親が持つ。
 */
export function Toggle({ on, onPick, label }: {
  on: boolean; onPick?: (next: boolean) => void; label?: string;
}) {
  return (
    <button role="switch" aria-checked={on} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onPick?.(!on); }} style={{
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

/**
 * モデル ── 押すと**選べる先が全部出る**（Claude と OpenAI）。
 *
 * **Thinking 版は並べない**（それは深さのほう）。
 * 名前だけでは選べないので、右に1語だけ添える（速い / ふだん / じっくり）。
 * **値段は出さない** — 数字を出していいのは請求とプランの画面だけ。
 *
 * 値は親が持つ（押したら `onPick`）。押したその場で保存されるので、保存ボタンは無い。
 */
export function ModelInline({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const label = modelOf(value)?.label ?? value;

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
        <span style={{ maxWidth: 172, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke={T5} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span role="listbox" className="pop" style={{
          position: 'absolute', top: 28, right: 0, zIndex: 9, width: 232, padding: 5, borderRadius: 11,
          background: SUNK, border: `1px solid ${FAINT}`, boxShadow: '0 18px 44px rgba(0,0,0,.74)',
        }}>
          {BY_MAKER.map(({ maker, models }) => (
            <span key={maker} style={{ display: 'block' }}>
              {/* どこのモデルかは見出しで1度だけ言う（行ごとに書かない） */}
              <span style={{ display: 'block', padding: '7px 10px 4px', color: T5, fontSize: 11 }}>{maker}</span>
              {models.map((m) => (
                <button key={m.id} role="option" aria-selected={m.id === value} className={m.id === value ? undefined : 'btn'}
                  onClick={() => { onPick(m.id); setOpen(false); }} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 30, padding: '0 10px',
                    borderRadius: 7, background: m.id === value ? `${WELL}` : undefined,
                    color: m.id === value ? T1 : T2, fontSize: 12,
                  }}>
                  {m.label}<span style={{ flex: 1 }} />
                  <span style={{ color: T5, fontSize: 11 }}>{GRADE_WORD[m.grade]}</span>
                  {m.id === value && <span style={{ color: GREEN_T, fontSize: 11 }}>✓</span>}
                </button>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * 深さ ── **thinking の量**を決める。モデルは変わらない。
 * いちばん左が「考えずに答える」、右へ行くほど深く考える。
 *
 * **段はモデルが決める。** 受けない段を出すと、選んだ瞬間にその往復が上流で弾かれる
 * （→ `lib/ai/catalog.ts`）。1段も持たないモデルでは**つまみごと出さない**。
 */
export function EffortInline({ value, efforts, onPick }: {
  value: Effort; efforts: readonly Effort[]; onPick: (e: Effort) => void;
}) {
  const [tip, setTip] = useState(false);
  if (!efforts.length) return null;
  // 受けない段が選ばれている（モデルを変えた直後）ときは、いちばん近い印を灯す
  const at = Math.max(0, efforts.indexOf(value));
  return (
    <span onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 9, height: 24, padding: '0 8px', borderRadius: 7 }}>
      <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>深さ</span>
      <span role="slider" aria-label="思考の深さ" tabIndex={0}
        aria-valuemin={0} aria-valuemax={efforts.length - 1} aria-valuenow={at} aria-valuetext={EFFORT_WORD[efforts[at]]}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onPick(efforts[Math.min(at + 1, efforts.length - 1)]); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onPick(efforts[Math.max(at - 1, 0)]); }
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 6 }}>
        {efforts.map((w, i) => (
          <button key={w} aria-label={EFFORT_WORD[w]} onClick={() => onPick(w)} style={{
            width: i === at ? 13 : 3.5, height: i === at ? 16 : 3.5, borderRadius: i === at ? 5 : 999,
            background: i === at ? '#D8D8D8' : i < at ? `${MUTE}` : FAINT, flexShrink: 0,
            transition: 'background-color .12s ease',
          }} />
        ))}
      </span>
      {tip && (
        <span className="pop" style={{
          position: 'absolute', bottom: 26, right: 0, zIndex: 8, padding: '4px 9px', borderRadius: 7,
          background: LINE, color: '#D8D8D8', fontSize: 11, whiteSpace: 'nowrap',
          boxShadow: '0 10px 26px rgba(0,0,0,.6)', pointerEvents: 'none',
        }}>{EFFORT_WORD[efforts[at]]}</span>
      )}
    </span>
  );
}
