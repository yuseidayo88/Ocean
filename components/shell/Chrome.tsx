'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CompanyPicker, useShell } from '@/components/shell/Shell';
import { COMPOSER_H as TOKEN_COMPOSER_H } from '@/lib/design/tokens';

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

/** 入力欄の高さ。**下に貼り付く中身はこのぶん逃がす**（→ lib/design/tokens.ts） */
export const COMPOSER_H = TOKEN_COMPOSER_H;

/**
 * トップバー。**偽の階層を作らない** — 本物の親子があるときだけ crumb を渡す。
 * それ以外は画面の名前ひとつ。日付や時刻は出さない（OS が出している）。
 */
export function TopBar({ crumb, title, right, onPanel, panelOn }:
  { crumb?: string; title: string; right?: React.ReactNode; onPanel?: () => void; panelOn?: boolean }) {
  const { rail, setRail } = useShell();
  const router = useRouter();
  return (
    <div style={{
      height: 46, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 12px 0 14px', borderBottom: '1px solid #161616',
    }}>
      {/* 左レールを閉じたときだけ、ここに戻り道が出る（端にはつまみを残さない） */}
      {!rail && (
        <button onClick={() => setRail(true)} className="icob" title="左を開く"
                style={{ display: 'inline-flex', padding: 5, marginLeft: -3 }}>
          <Icon name="panel" color={T4} size={15} />
        </button>
      )}
      {/* 開く・閉じるも URL に入っているので、ここが本当に効く */}
      <button onClick={() => router.back()} className="icob" title="戻る" style={{ display: 'inline-flex', padding: 4 }}>
        <Icon name="back" color={T4} size={14} />
      </button>
      <button onClick={() => router.forward()} className="icob" title="進む" style={{ display: 'inline-flex', padding: 4 }}>
        <Icon name="fwd" color={T4} size={14} />
      </button>

      {/* いま見ているものは全部この会社のもの。だから**パンくずの根**に置く */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 1, minWidth: 0 }}>
        <CompanyPicker />
        <span style={{ color: T5 }}>/</span>
        {crumb && <><span style={{ color: T4 }}>{crumb}</span><span style={{ color: T5 }}>/</span></>}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>

      <div style={{ flex: 1 }} />
      {right}
      {/* 右ペインの出し入れ。**右向きの絵**を右端に置く */}
      {onPanel && (
        <button onClick={onPanel} className="icob" title={panelOn ? '右を閉じる' : '右を開く'}
                style={{ display: 'inline-flex', padding: 5, marginLeft: 4 }}>
          <Icon name="panelr" color={panelOn ? T2 : T4} size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * 入力欄は全画面で同じものを1つ。中央下部・幅748・角丸18。
 * **中身の上に浮かせる**（重なってよい）。入力欄が主役の画面だけ floating=false。
 */
export function Composer({ placeholder, mode = '統括AI', effort = '自動', above, floating = true }:
  { placeholder: string; mode?: string; effort?: string; above?: React.ReactNode; floating?: boolean }) {
  const [text, setText] = useState('');
  const wrap: React.CSSProperties = floating
    ? {
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '42px 24px 18px',
        background: 'linear-gradient(to top, #000 0%, #000 44%, rgba(0,0,0,0.86) 66%, rgba(0,0,0,0) 100%)',
      }
    : { width: '100%', boxSizing: 'border-box', flexShrink: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 24px' };

  return (
    <div style={wrap}>
      {above}
      <div className="field" style={{
        width: '100%', maxWidth: 748, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        gap: 12, padding: '13px 14px 11px 16px', borderRadius: 18,
        background: '#141414', border: '1px solid #2A2A2A',
      }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={(e) => { const t = e.currentTarget; t.style.height = '0px'; t.style.height = `${Math.min(t.scrollHeight, 168)}px`; }}
          placeholder={placeholder}
          rows={1}
          style={{
            width: '100%', resize: 'none', background: 'none', border: 'none', outline: 'none',
            color: T1, fontSize: 14, lineHeight: '22px', maxHeight: 168, overflowY: 'auto',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icob" style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color={T4} size={16} />
          </span>
          <span className="btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px',
            borderRadius: 7, color: T2,
          }}>{mode}<Icon name="down" color={T4} size={12} /></span>
          <span className="btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px',
            borderRadius: 7, color: T2,
          }}><Icon name="bars" color={T4} size={13} />{effort}</span>
          <div style={{ flex: 1 }} />
          {/* **書いていないときは送れない。** 押せないものを押せる顔にしない */}
          <button disabled={!text.trim()} className={text.trim() ? 'solid' : undefined} style={{
            width: 30, height: 30, borderRadius: 999, flexShrink: 0,
            background: text.trim() ? BLUE : '#242424',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default',
            transition: 'background-color .14s ease',
          }}>
            <Icon name="up" color={text.trim() ? '#fff' : '#5F5F5F'} size={16} width={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 右ペインは2つの形しかない。
 *
 *   **パネル**（既定）— 選んだ1件の詳細と、画面そのものの付き添い。
 *     行を選び直すと中身が入れ替わるので、同時に2つ持つ意味がない。
 *     素の見出し ＋ ✕ だけ。タブの器も ＋ も置かない。
 *
 *   **タブ**（`tabs`）— **持ち出して読み比べる文書だけ**（成果物 / SKILL.md）。
 *     ✕ で閉じて ＋ で足せる。画面を移っても開いたまま。
 *
 * 全部をタブの見た目にすると、撤去したはずの「ブラウザの真似」が小さく戻ってくる。
 */
export function Pane({ width = 430, title, icon, dot, tabs, right, onClose, children }: {
  width?: number;
  title?: string; icon?: IconName; dot?: string;
  tabs?: { label: string; dot?: string }[];
  right?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState(0);
  // Esc で閉じる。右ペインはどの画面でも同じ作法にする
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <aside aria-label={title ?? tabs?.[tab]?.label} style={{
      width, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      background: '#000', minHeight: 0, borderLeft: '1px solid #161616',
    }}>
      <div style={{
        height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: tabs ? '0 12px' : '0 16px', borderBottom: '1px solid #161616',
      }}>
        {tabs ? (
          <>
            {tabs.map((t, i) => (
              <button key={t.label} onClick={() => setTab(i)} className={i === tab ? undefined : 'btn'} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 11px',
                borderRadius: 8, background: i === tab ? '#1C1C1C' : undefined,
                color: i === tab ? T1 : T4, fontSize: 12.5,
                transition: 'background-color .12s ease, color .12s ease',
              }}>
                {t.dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: t.dot }} />}
                {t.label}
                {i === tab && (
                  <span role="button" tabIndex={0} className="icob" aria-label="閉じる"
                        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
                        }}
                        style={{ display: 'inline-flex', padding: 2, marginRight: -3 }}>
                    <Icon name="close" color={T5} size={11} />
                  </span>
                )}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {right ?? <span className="icob" style={{ display: 'inline-flex', padding: 4 }}><Icon name="plus" color={T4} size={14} /></span>}
          </>
        ) : (
          <>
            {icon && <Icon name={icon} color={T4} size={14} />}
            {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />}
            <span style={{ color: T2, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
            <div style={{ flex: 1 }} />
            {right}
            <button onClick={onClose} className="icob" title="閉じる"
                    style={{ display: 'inline-flex', padding: 5, marginRight: -5, flexShrink: 0 }}>
              <Icon name="close" color={T5} size={13} />
            </button>
          </>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </aside>
  );
}

/** 中央のペイン */
export function Centre({ children }: { children: React.ReactNode; border?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000',
    }}>{children}</div>
  );
}

/** セクションは見出しと中身だけ。面も枠も置かず、余白で区切る */
export function Section({ label, right, children, style }:
  { label: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 6 }}>
        <span style={{ color: T3 }}>{label}</span>
        <div style={{ flex: 1 }} />
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * 質問は入力欄の上にくっついた板として出す（会話には流さない）。
 * 見出し＋1行の説明＋番号キー。最後の行は自由入力。右上に ‹ N / M › と ✕
 */
export function Ask({ q, idx, total, options, free }: {
  q: string; idx: number; total: number;
  options: { label: string; note: string; recommended?: boolean }[];
  free: string;
}) {
  return (
    <div style={{
      width: '100%', maxWidth: 748, boxSizing: 'border-box', borderRadius: 14,
      background: '#101010', border: '1px solid #262626', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
        <span style={{ color: T1, fontSize: 14 }}>{q}</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T5, fontSize: 12 }}>
          <span className="icob" style={{ display: 'inline-flex', padding: 3 }}><Icon name="back" color={T5} size={12} /></span>
          <span className="tnum" style={{ padding: '0 2px' }}>{idx} / {total}</span>
          <span className="icob" style={{ display: 'inline-flex', padding: 3 }}><Icon name="fwd" color={T5} size={12} /></span>
        </span>
        <span className="icob" style={{ display: 'inline-flex', padding: 4, marginRight: -2 }}>
          <Icon name="close" color={T5} size={13} />
        </span>
      </div>
      {options.map((o, i) => (
        <div key={o.label} className="row" style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          borderTop: '1px solid #1B1B1B',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 5, background: '#1C1C1C', color: T4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
          }}>{i + 1}</span>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {o.label}
              {o.recommended && <span style={{ color: '#5BB974', fontSize: 11 }}>推奨</span>}
            </span>
            <span style={{ color: T5, fontSize: 12 }}>{o.note}</span>
          </div>
        </div>
      ))}
      <div className="row" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid #1B1B1B',
      }}>
        <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pencil" color={T4} size={13} />
        </span>
        <span style={{ color: T3 }}>{free}</span>
        <div style={{ flex: 1 }} />
        <span className="lnk" style={{ color: T5, fontSize: 12 }}>スキップ</span>
      </div>
    </div>
  );
}

/** 答え終わった条件は緑のチェック＋項目名つきのチップ */
export function Chips({ items }: { items: [string, string][] }) {
  return (
    <div style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', gap: 7, padding: '0 4px' }}>
      <span style={{ color: T5, fontSize: 11 }}>答えてもらった条件</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(([k, v]) => (
          <span key={k} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 10px',
            borderRadius: 999, background: '#121212', border: '1px solid #232323',
          }}>
            <Icon name="check" color="#5BB974" size={11} width={2.4} />
            <span style={{ color: T5, fontSize: 11 }}>{k}</span>
            <span style={{ color: T2, fontSize: 12 }}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** 上部ピルで切り替える（ホームの4ビュー） */
export function Pills({ items, active, onPick }: {
  items: { key: string; label: string; icon: React.ReactNode }[];
  active: string; onPick: (k: string) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: 4, borderRadius: 999,
      background: '#141414', border: '1px solid #232323',
    }}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button key={it.key} onClick={() => onPick(it.key)} className={on ? undefined : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 15px',
            borderRadius: 999, background: on ? '#2A2A2A' : undefined, color: on ? T1 : T4,
            whiteSpace: 'nowrap', transition: 'background-color .12s ease, color .12s ease',
          }}>
            {it.icon}{it.label}
          </button>
        );
      })}
    </div>
  );
}

/** 思考の深さ = スライダー（自動のときは沈める） */
export function EffortSlider({ pct = 58, dim = false, width, onChange }:
  { pct?: number; dim?: boolean; width?: number; onChange?: (v: number) => void }) {
  const cols = 46, rows = 5;
  const [val, setVal] = useState(pct);
  const box = useRef<HTMLDivElement>(null);
  const live = onChange ? val : pct;

  // つまめる。自動のときは沈めたまま動かさない
  const move = (clientX: number) => {
    const el = box.current;
    if (!el || !onChange) return;
    const r = el.getBoundingClientRect();
    const v = Math.round(Math.min(100, Math.max(0, ((clientX - r.left - 11) / (r.width - 22)) * 100)));
    setVal(v); onChange(v);
  };
  const drag = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = c / (cols - 1);
      const a = 0.2 + 0.66 * Math.pow(t, 1.35);
      cells.push(<span key={`${r}-${c}`} style={{
        width: 3, height: 3, borderRadius: 999, background: `rgba(255,255,255,${(a * (dim ? 0.5 : 1)).toFixed(3)})`,
      }} />);
    }
  }
  return (
    <div ref={box}
      onPointerDown={drag}
      onPointerMove={(e) => { if (e.buttons === 1) move(e.clientX); }}
      style={{
        position: 'relative', width: width ?? '100%', height: 30, boxSizing: 'border-box',
        borderRadius: 10, background: '#121212', border: '1px solid #202020',
        cursor: onChange ? 'ew-resize' : 'default', touchAction: 'none',
      }}>
      <span style={{
        position: 'absolute', inset: '5px 7px', display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`,
        alignItems: 'center', justifyItems: 'center', pointerEvents: 'none',
      }}>{cells}</span>
      <span style={{
        position: 'absolute', top: 3, bottom: 3, left: `calc(${live}% - 13px)`, width: 22,
        borderRadius: 8, background: dim ? '#7A7A7A' : '#EDEDED', boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
        transition: onChange ? undefined : 'left .14s ease', pointerEvents: 'none',
      }} />
    </div>
  );
}

// ══════════════ B群の宿題: 器の振る舞い ══════════════

/**
 * 統括AIの3状態。**演出ではないので、止まっているときは止まっていると出す。**
 *   待機 = 何もしていない / 考え中 = 動いている / 判断待ち = あなたで止まっている
 */
export function ExecStatus({ state }: { state: 'idle' | 'thinking' | 'blocked' }) {
  const map = {
    idle:     { c: T5,        t: '待機',   pulse: false },
    thinking: { c: '#B8B8B8', t: '考えています', pulse: true },
    blocked:  { c: '#FDD663', t: '判断を待っています', pulse: false },
  }[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: map.c, fontSize: 12 }}>
      <span style={{
        width: 7, height: 7, borderRadius: 999,
        background: state === 'blocked' ? '#E37400' : state === 'thinking' ? '#6E6E6E' : '#2E2E2E',
        animation: map.pulse ? 'pulse 1.4s ease-in-out infinite' : undefined,
      }} />
      {map.t}
    </span>
  );
}

/** 右ペインの3状態。**空を空のまま置かない**（次にやることを書く） */
export function PaneEmpty({ title, lead, action }: { title: string; lead: string; action?: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: 28, textAlign: 'center',
    }}>
      <span style={{ color: T2, fontSize: 14 }}>{title}</span>
      <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px', maxWidth: 260 }}>{lead}</span>
      {action && (
        <span className="btn" style={{
          marginTop: 6, display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
          borderRadius: 8, background: '#1A1A1A', border: '1px solid #2A2A2A', color: T2, fontSize: 12.5,
        }}>{action}</span>
      )}
    </div>
  );
}

export function PaneLoading({ lines = 4 }: { lines?: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 18 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height: 10, borderRadius: 3, background: '#141414',
          width: `${[92, 78, 88, 64, 84][i % 5]}%`,
          animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  );
}

/**
 * 失敗は隠さない。**何が起きて、何を変えれば進むか**を書く。謝らない。
 */
export function PaneError({ what, next, retry = 'もう一度' }: { what: string; next: string; retry?: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
      <span style={{ color: '#F28B82', fontSize: 13 }}>{what}</span>
      <span style={{ color: T3, fontSize: 12.5, lineHeight: '20px' }}>{next}</span>
      <span style={{
        alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
        borderRadius: 8, background: '#1A1A1A', border: '1px solid #2A2A2A', color: T2, fontSize: 12.5,
      }}>{retry}</span>
    </div>
  );
}

/** 右ペインの下に貼り付く行動の行（承認する / 決定する など） */
export function PaneFooter({ primary, secondary, reverse = false }:
  { primary: string; secondary?: string; reverse?: boolean }) {
  const sec = secondary && (
    <span className="btn" style={{
      display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 16px', borderRadius: 8,
      background: '#1A1A1A', border: '1px solid #2A2A2A', color: T2, whiteSpace: 'nowrap',
    }}>{secondary}</span>
  );
  const pri = (
    <span className="solid" style={{
      flex: reverse ? undefined : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: 38, padding: reverse ? '0 20px' : undefined, borderRadius: 8,
      background: BLUE, color: '#fff', whiteSpace: 'nowrap',
    }}>{primary}</span>
  );
  return (
    <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: 16, borderTop: '1px solid #161616' }}>
      {/* reverse＝「小さい2つ、青が右」（採用・診断） */}
      {reverse ? <>{sec}<div style={{ flex: 1 }} />{pri}</> : <>{pri}{sec}</>}
    </div>
  );
}

/** ペインの中の小見出し。面も枠も置かない */
export function PaneHead({ children, top = false }: { children: React.ReactNode; top?: boolean }) {
  return <div style={{ padding: top ? '0 0 4px' : '22px 0 4px' }}><span style={{ color: T3 }}>{children}</span></div>;
}

/** ペインのタブ右端に出す小さな注記（「3時間 待機」など） */
export function PaneNote({ children, color = '#FDD663' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
      <span style={{ color, fontSize: 12 }}>{children}</span>
    </div>
  );
}
