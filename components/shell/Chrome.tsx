'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CompanyPicker, useShell } from '@/components/shell/Shell';
import { COMPOSER_H as TOKEN_COMPOSER_H, EASE, EASE_FAST } from '@/lib/design/tokens';
import { EFFORT_WORDS } from '@/lib/dummy';

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
  const { rail, setRail, chat } = useShell();
  // 会話が開いているあいだ、右はその1枚。画面側のペインの印は引っ込める
  const paneOn = panelOn || chat.on;
  const router = useRouter();
  return (
    <div style={{
      height: 46, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 12px 0 14px', borderBottom: '1px solid #161616',
    }}>
      {/* 左レールを閉じたときだけ、ここに戻り道が出る（端にはつまみを残さない）。
          **消したり出したりしない** — 幅を 0 にして、レールの動きと同じ速さで開く。
          閉じているあいだは隙間ぶんの負の余白で、パンくずが飛ばないようにする */}
      <span aria-hidden={rail} inert={rail} style={{
        width: rail ? 0 : 22, marginLeft: rail ? -10 : -3, opacity: rail ? 0 : 1,
        flexShrink: 0, overflow: 'hidden', display: 'inline-flex',
        transition: `width ${EASE}, margin-left ${EASE}, opacity .18s ease`,
      }}>
        <button onClick={() => setRail(true)} className="icob" title="左を開く"
                style={{ display: 'inline-flex', padding: 5, marginLeft: -3, flexShrink: 0 }}>
          <Icon name="panel" color={T4} size={15} />
        </button>
      </span>
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
      {/**
        * 右ペインへの戻り道。**閉じているときだけ出す。**
        * 開いているあいだはペインの中に ✕ があるので、ここにも置くと同じことを2回言うことになる。
        * 左レールとまったく同じ作法 — 開け閉めは器の中、戻り道はトップバー。
        * 消したり出したりせず、幅を 0 にして横の並びが飛ばないようにする。
        */}
      {onPanel && (
        <span aria-hidden={paneOn} inert={paneOn} style={{
          width: paneOn ? 0 : 25, marginLeft: paneOn ? -6 : 4, opacity: paneOn ? 0 : 1,
          flexShrink: 0, overflow: 'hidden', display: 'inline-flex',
          transition: `width ${EASE}, margin-left ${EASE}, opacity .18s ease`,
        }}>
          <button onClick={onPanel} className="icob" title="右を開く"
                  style={{ display: 'inline-flex', padding: 5, flexShrink: 0 }}>
            <Icon name="panelr" color={T4} size={15} />
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * 入力欄は全画面で同じものを1つ。中央下部・幅748・角丸18。
 * **中身の上に浮かせる**（重なってよい）。入力欄が主役の画面だけ floating=false。
 */
/**
 * 入力欄は書いたぶんだけ伸びる。**伸びるところも滑らかに動かす。**
 *
 * CSS の `field-sizing: content` に任せると JS は要らないが、
 * 高さが「決まった値」にならないので**一瞬で変わる**（動かせない）。
 * 滑らかに伸ばしたいので、こちらで測って高さを入れる。
 *
 * ただし**打った瞬間には測らない。**
 * 打った直後はまだ配置が決まっていないので、そこで高さを読むと
 * ブラウザに「いますぐ全部計算しろ」と言うことになる（1文字ごとに、ページ全体を）。
 * 次に描くタイミングまで待てば、どのみち計算されているものを読むだけで済む。
 * 続けて打っても、待っているぶんは1回にまとめる。
 */
const pending = new WeakSet<HTMLTextAreaElement>();

function grow(t: HTMLTextAreaElement, onH?: (h: number) => void) {
  if (pending.has(t)) return;
  pending.add(t);
  requestAnimationFrame(() => {
    pending.delete(t);
    const before = t.offsetHeight;
    const keep = t.style.transition;
    t.style.transition = 'none';
    // 0 ではなく auto にする。0 に落とすと、動き出す高さが 0 になって一瞬つぶれる
    t.style.height = 'auto';
    const next = Math.min(t.scrollHeight, 168);
    t.style.height = `${before}px`;
    onH?.(next);
    if (next === before) { t.style.transition = keep; return; }
    void t.offsetHeight;   // 「いまの高さ」を確定させてから動かす
    t.style.transition = keep;
    t.style.height = `${next}px`;
  });
}

export function Composer({ placeholder, mode = '統括AI', effort = '自動', above, floating = true,
                           inPane = false, local = false }:
  { placeholder: string; mode?: string; effort?: string; above?: React.ReactNode; floating?: boolean;
    /** 右ペインの中に置くほう。器の余白と幅を、ペインに合わせる */
    inPane?: boolean;
    /** チャット画面のように、その場で会話が続く画面。右ペインを開かない */
    local?: boolean }) {
  /**
   * **打つたびに描き直さない。**
   * 見た目が変わるのは「書いたかどうか」の1点だけ（送信ボタンが青くなる）。
   * 中身そのものを state に持つと1文字ごとに入力欄まわり全部を作り直すことになるので、
   * 持つのは真偽値ひとつにして、文字はブラウザに預けたままにする。
   */
  const [can, setCan] = useState(false);
  /** 2行以上になったか。1行のうちは**横一列のまま**にする */
  const [tall, setTall] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const { chat: talk, say, say5 } = useShell();

  /**
   * **入力欄は全画面で1つ。** 会話が開いたら、中央のものは引っ込んでペインの中のものになる。
   * 読む目と書く手を同じ場所に置く（→ components/shell/ChatPane.tsx）。
   */
  if (talk.on && !inPane && !local) return null;

  const send = () => {
    const t = box.current;
    if (!t || !t.value.trim()) return;
    say(t.value.trim());
    t.value = '';
    t.style.height = '';
    setCan(false);
    setTall(false);
  };
  const wrap: React.CSSProperties = inPane
    ? { width: '100%', boxSizing: 'border-box', flexShrink: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 14px 14px' }
    : floating
    ? {
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 24px 24px',
        background: 'linear-gradient(to top, #000 0%, #000 44%, rgba(0,0,0,0.86) 66%, rgba(0,0,0,0) 100%)',
      }
    : { width: '100%', boxSizing: 'border-box', flexShrink: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 24px' };

  return (
    <div style={wrap}>
      {above}
      {/**
        * **1行にまとめる**（参考: ChatGPT の入力欄）。
        * ＋ / 書くところ / 統括AI / 深さ / ↑ を横一列に置く。2段に分けない。
        * 書いて2行以上になったら、そのときだけ縦に伸ばし、道具は下端に揃える。
        */}
      <div className="field" style={{
        width: '100%', maxWidth: 748, boxSizing: 'border-box',
        display: 'flex', alignItems: tall ? 'flex-end' : 'center', gap: inPane ? 7 : 10,
        minHeight: inPane ? 46 : 52,
        padding: tall
          ? (inPane ? '10px 7px 8px 12px' : '12px 8px 10px 15px')
          : (inPane ? '0 7px 0 12px' : '0 8px 0 15px'),
        borderRadius: tall ? 18 : inPane ? 23 : 26,
        background: '#141414', border: '1px solid #2A2A2A',
        transition: `border-radius ${EASE_FAST}`,
        // 高さを測るときの計算を、この器の中だけで済ませる
        contain: 'layout',
      }}>
        <button onClick={() => say5('資料を添えられるのは Phase 5 から')} className="icob"
          aria-label="資料を添える" style={{
            width: 28, height: 28, flexShrink: 0, borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="plus" color={T4} size={16} />
        </button>
        <textarea
          ref={box}
          onKeyDown={(e) => {
            // Enter で送る。改行は Shift ＋ Enter（チャットの作法に合わせる）
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault(); send();
            }
          }}
          onInput={(e) => {
            const next = !!e.currentTarget.value.trim();
            if (next !== can) setCan(next);
            grow(e.currentTarget, (h) => setTall(h > 26));
          }}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, minWidth: 0, resize: 'none', background: 'none', border: 'none', outline: 'none',
            color: T1, fontSize: 14, lineHeight: '22px', maxHeight: 168, overflowY: 'auto',
            padding: 0, transition: `height ${EASE}`,
          } as React.CSSProperties}
        />
        {/**
          * **宛先は変わらないので ⌄ を付けない。**
          * 書いたものは全部 統括AI に届く（社員に直接は頼めない）。
          * 選べないのに ⌄ が付いていると、押して何も起きないものが全画面に1つ増える。
          */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 6px',
          color: T4, fontSize: 12.5, flexShrink: 0, whiteSpace: 'nowrap',
        }}>{mode}</span>
        {/* 深さは本物の選択。統括AI がどこまで考えるかを、その場で変える */}
        <EffortMenu init={effort} />
        {/* **書いていないときは送れない。** 押せないものを押せる顔にしない */}
        <button disabled={!can} onClick={send} className={can ? 'solid' : undefined} style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          background: can ? BLUE : '#242424',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: can ? 'pointer' : 'default',
          transition: 'background-color .14s ease',
        }}>
          <Icon name="up" color={can ? '#fff' : '#5F5F5F'} size={16} width={1.8} />
        </button>
      </div>
    </div>
  );
}

/**
 * 名前を出すのに要る幅。日本語で7〜8文字ぶん。
 * これを割るくらいなら**出さないほうがいい** — 「市場調…」が並んでも見分けられない。
 */
const MIN_TAB = 112;
/** 名前を畳んだタブの幅（印だけ） */
const BARE_W = 26;

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
export function Pane({ width = 430, title, icon, dot, tabs, tab: tabAt, onTab, right, onClose, chat, children }: {
  width?: number;
  title?: string; icon?: IconName; dot?: string;
  /** 統括AIとの会話のペイン。**開いているあいだ、画面側のペインは引っ込む**（右は1枚だけ） */
  chat?: boolean;
  /** タブは「持ち出して読み比べる文書」だけ。中身も一緒に入れ替わる */
  tabs?: { label: string; dot?: string }[];
  tab?: number;
  onTab?: (i: number) => void;
  right?: React.ReactNode;
  /** タブのときは「いま見ているタブを閉じる」。素の見出しのときはペインを閉じる */
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const { chat: talk } = useShell();
  const [tabIn, setTabIn] = useState(0);
  const tab = tabAt ?? tabIn;
  const setTab = onTab ?? setTabIn;

  /**
   * **入らないときは名前を出さない。**
   * 名前を全部出そうとして押し込むと、どれも読めない幅になって器が崩れる。
   * 見ているタブだけ名前を出し、ほかは印だけに畳む（押せばそれが開いて名前が出る）。
   * 幅は決まっているので測らずに決められる — ペインの幅から引き算するだけ。
   */
  const n = tabs?.length ?? 0;
  const room = width - 24 - 30 - (n - 1) * 6;              // 左右の余白 と ＋ と すき間
  const rest = room - Math.min(240, Math.round(room * 0.55)); // 見ているタブに先に取らせた残り
  const tight = n > 1 && rest / (n - 1) < MIN_TAB;

  /**
   * 出入りを滑らかにする。**どちらも出た最初のフレームから動く。**
   * 出るとき: `panein` が幅 0 から広げる（CSS のアニメーションなので、
   *   React がもう一度描くのを待たない ＝ 押した瞬間から動きはじめる）。
   * 閉じるとき: `paneout` で畳み、**畳み終わってから**親に伝えて消えてもらう。
   * 消えるのを待たせるのはここだけ。画面ごとに書かなくていい。
   */
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (!onClose || leaving) return;
    setLeaving(true);
    setTimeout(onClose, 240);
  };

  // Esc で閉じる。右ペインはどの画面でも同じ作法にする
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // 右は1枚だけ。会話が開いているあいだ、画面側のペインは引っ込む
  if (talk.on && !chat) return null;

  return (
    <aside aria-label={title ?? tabs?.[tab]?.label} className={leaving ? 'paneout' : 'panein'}
           style={{ ['--pw' as string]: `${width}px`, flexShrink: 0, overflow: 'hidden' }}>
    <div style={{
      width, height: '100%', flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      background: '#000', minHeight: 0, borderLeft: '1px solid #161616',
    }}>
      <div style={{
        height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: tabs ? '0 12px' : '0 16px', borderBottom: '1px solid #161616',
      }}>
        {tabs ? (
          <>
            {tabs.map((t, i) => {
              const on = i === tab;
              const bare = tight && !on;   // 入らないときは、見ていないタブの名前を出さない
              return (
              <button key={t.label} onClick={() => setTab(i)} title={t.label}
                      className={on ? undefined : 'btn'} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: bare ? 'center' : undefined,
                gap: bare ? 0 : 8, height: 28, padding: bare ? 0 : '0 11px',
                flex: bare ? `0 0 ${BARE_W}px` : on ? '1.7 1 0' : '1 1 0', minWidth: 0,
                maxWidth: bare ? BARE_W : on && tight ? 260 : 240,
                borderRadius: 8, background: on ? '#1C1C1C' : bare ? '#121212' : undefined,
                color: on ? T1 : T4, fontSize: 12.5,
                transition: `background-color .12s ease, color .12s ease, width ${EASE_FAST}`,
              }}>
                {/* 名前を出さないときは、印だけで「そこに1枚ある」と分かるようにする */}
                <span style={{
                  width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                  background: t.dot ?? (bare ? '#3A3A3A' : 'transparent'),
                  display: t.dot || bare ? 'block' : 'none',
                }} />
                {/* タブの名前は**わざと**切る（ブラウザのタブと同じ）。clip は「切れていて正しい」の印 */}
                {!bare && (
                  <span className="clip" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.label}
                  </span>
                )}
                {on && (
                  <span role="button" tabIndex={0} className="icob" aria-label="閉じる"
                        onClick={(e) => { e.stopPropagation(); close(); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); }
                        }}
                        style={{ display: 'inline-flex', padding: 2, marginRight: -3, flexShrink: 0 }}>
                    <Icon name="close" color={T5} size={11} />
                  </span>
                )}
              </button>
              );
            })}
            <div style={{ flex: 1 }} />
            {right ?? <span className="icob" style={{ display: 'inline-flex', padding: 4, flexShrink: 0 }}><Icon name="plus" color={T4} size={14} /></span>}
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
            <button onClick={close} className="icob" title="閉じる"
                    style={{ display: 'inline-flex', padding: 5, marginRight: -5, flexShrink: 0 }}>
              <Icon name="close" color={T5} size={13} />
            </button>
          </>
        )}
      </div>
      {/* 選び直す・タブを持ち替えると中身が入れ替わる。**その瞬間だけ薄く重ねる** */}
      <div key={title ?? tabs?.[tab]?.label} className="swap"
           style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
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
  /**
   * **選んだら、板は消えて緑のチップになる**（→ CLAUDE.md「答え終わった条件は
   * 緑のチェック＋項目名つきのチップで見せる」）。1〜3 と Esc でも選べる。
   * Phase 4 なので答えはどこにも届かないが、**選んだことは見える**。
   */
  const [picked, setPicked] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (gone || picked) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.key === 'Escape') { setGone(true); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) { e.preventDefault(); setPicked(options[n - 1].label); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [gone, picked, options]);

  if (gone) return null;

  // 答え終わった条件は、選択肢と見間違えないように緑のチップで
  if (picked) {
    return (
      <div className="rise" style={{
        width: '100%', maxWidth: 748, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px',
          borderRadius: 8, background: 'rgba(30,142,62,0.12)', border: '1px solid rgba(30,142,62,0.35)',
        }}>
          <Icon name="check" color="#5BB974" size={12} width={2.2} />
          <span style={{ color: T5, fontSize: 11.5 }}>{q}</span>
          <span style={{ color: '#5BB974', fontSize: 12.5 }}>{picked}</span>
        </span>
        <button onClick={() => setPicked(null)} className="lnk" style={{ color: T5, fontSize: 12 }}>選び直す</button>
      </div>
    );
  }

  return (
    <div className="rise" style={{
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
        <button onClick={() => setGone(true)} className="icob" title="閉じる"
                style={{ display: 'inline-flex', padding: 4, marginRight: -2 }}>
          <Icon name="close" color={T5} size={13} />
        </button>
      </div>
      {options.map((o, i) => (
        <button key={o.label} onClick={() => setPicked(o.label)} className="row" style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px',
          borderTop: '1px solid #1B1B1B', textAlign: 'left',
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
        </button>
      ))}
      <div className="row" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid #1B1B1B',
      }}>
        <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pencil" color={T4} size={13} />
        </span>
        <span style={{ color: T3 }}>{free}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setGone(true)} className="lnk" style={{ color: T5, fontSize: 12 }}>スキップ</button>
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

/**
 * 入力欄の深さ。**thinking の量**を決める（モデルは変わらない）。
 * メンバー画面の行に置いたものと同じ言葉づかい。`自動` は統括AIに任せる。
 */
function EffortMenu({ init }: { init: string }) {
  const [v, setV] = useState(init);
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
    <span ref={box} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button className="btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 9px',
        borderRadius: 8, color: T2, whiteSpace: 'nowrap',
        boxShadow: open ? 'inset 0 0 0 40px rgba(255,255,255,.03)' : undefined,
      }}>
        <Icon name="bars" color={T4} size={13} />{v}
      </button>
      {open && (
        <span role="listbox" className="pop" style={{
          position: 'absolute', bottom: 36, right: 0, zIndex: 20, width: 168, padding: 5, borderRadius: 11,
          background: '#1A1A1A', border: '1px solid #2E2E2E', boxShadow: '0 18px 44px rgba(0,0,0,.74)',
        }}>
          {['自動', ...EFFORT_WORDS].map((w) => (
            <button key={w} role="option" aria-selected={w === v} className={w === v ? undefined : 'btn'}
              onClick={() => { setV(w); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', width: '100%', height: 30, padding: '0 10px',
                borderRadius: 7, background: w === v ? '#1F1F1F' : undefined,
                color: w === v ? T1 : T2, fontSize: 12,
              }}>
              {w}<span style={{ flex: 1 }} />
              {w === v && <span style={{ color: '#5BB974', fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
