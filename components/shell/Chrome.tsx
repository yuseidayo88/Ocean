'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CompanyPicker, useShell } from '@/components/shell/Shell';
import { AMBER, AMBER_T, BLUE, COMPOSER_H as TOKEN_COMPOSER_H, DIM, EASE, EASE_FAST, EDGE, FAINT, GREEN_T, HAIR, LINE, RAIL, RED_T, RULE, SEAM, SUNK, T1, T2, T3, T4, T5, WELL } from '@/lib/design/tokens';
import { chatTargets, openWorkChat } from '@/app/actions/chat';

/** 入力欄の高さ。**下に貼り付く中身はこのぶん逃がす**（→ lib/design/tokens.ts） */
export const COMPOSER_H = TOKEN_COMPOSER_H;

/** 宛先が「まだどの Work でもない」ときの語。**言い換えない**（1か所に置く） */
export const NEW_CHAT = '新しいチャット';

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
      gap: 10, padding: '0 12px 0 14px', borderBottom: `1px solid ${HAIR}`,
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

export function Composer({ placeholder, mode = NEW_CHAT, above, floating = true,
                           veil = true, inPane = false, local = false, onSend, busy = false, onHeight,
                           focusAt = 0 }:
  { placeholder: string; mode?: string; above?: React.ReactNode; floating?: boolean;
    /**
     * **カーソルをここへ連れてくる合図。** 数が変わるたびに入力欄へ焦点を移す。
     * 「直したい」のように、**行き先がこの入力欄しかない**ボタンのためのもの
     * （「下の入力欄に書いてください」と説明を置く代わりに、そこへ連れていく）。
     */
    focusAt?: number;
    /**
     * 下端を黒に溶かすか。**中身がスクロールして入力欄の裏に潜る画面だけ。**
     * 盤面（ワークフロー）は中身が入力欄の上に収まっていて潜らないので、
     * 溶かすと背景のドットを切るだけになる → `false`
     */
    veil?: boolean;
    /** 右ペインの中に置くほう。器の余白と幅を、ペインに合わせる */
    inPane?: boolean;
    /** チャット画面のように、その場で会話が続く画面。右ペインを開かない */
    local?: boolean;
    /** **この画面が書いたものを引き取る**（新しい Work のように、会話ではなく仕事になる画面） */
    onSend?: (text: string) => void;
    /** 引き取ったあと処理中。もう一度送れないようにする */
    busy?: boolean;
    /**
     * **この帯が実際に何 px あるか**を画面に返す。
     * `above`（質問の板・条件のチップ）が付くと帯は `COMPOSER_H` より高くなるので、
     * 下に貼り付く行はそのぶん逃がさないと**押せなくなる**。
     * 逃がす量は `Math.max(COMPOSER_H, h - 16)` — 何も乗っていなければ `COMPOSER_H` に戻る。
     */
    onHeight?: (h: number) => void }) {
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
  const band = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const { chat: talk, say, say5 } = useShell();

  // 呼ばれたら入力欄へ（0 は初期値なので何もしない）
  useEffect(() => { if (focusAt) box.current?.focus(); }, [focusAt]);

  // 帯の高さを測って返す（質問の板が出入りするたびに変わる）
  useEffect(() => {
    const el = band.current;
    if (!el || !onHeight) return;
    const ro = new ResizeObserver(() => onHeight(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  /**
   * **入力欄は全画面で1つ。** 会話が開いたら、中央のものは引っ込んでペインの中のものになる。
   * 読む目と書く手を同じ場所に置く（→ components/shell/ChatPane.tsx）。
   */
  if (talk.on && !inPane && !local) return null;

  /**
   * 添えられたファイルを会話に渡す。**1枚ずつ、中身ごと。**
   * 長いものは頭だけ（依頼文が膨らむと、その往復ぶん全部が高くなる）。
   */
  const take = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const CAP = 6000;
    for (const f of files) {
      if (!/\.(md|markdown|txt|csv|json)$/i.test(f.name)) {
        say5(`${f.name} はまだ読めません。いまは .md .txt .csv .json だけ`);
        continue;
      }
      let body = '';
      try { body = await f.text(); } catch { say5(`${f.name} を読めませんでした`); continue; }
      const cut = body.length > CAP;
      const text = [`資料を渡します: ${f.name}`, '', body.slice(0, CAP), cut ? '…（ここまで）' : '']
        .filter(Boolean).join('\n');
      if (onSend) onSend(text); else say(text);
    }
  };

  const send = () => {
    const t = box.current;
    if (!t || !t.value.trim() || busy) return;
    if (onSend) { onSend(t.value.trim()); t.value = ''; t.style.height = ''; setCan(false); setTall(false); return; }
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
        /**
         * **帯そのものは指を通す。** 受けるのは入力欄と質問の板だけ（どちらも 'auto'）。
         * 帯は 124px あるのに中身を逃がすのは `COMPOSER_H`（108px）なので、
         * 帯が指を受けると**下端の 16px にあるものが押せなくなる**
         *（メンバーの全員の歯車 / 計画の「Work を見る」が実際そうだった）。
         * 盤面のホイールをふさがない、という元の理由もこれで一緒に満たす。
         */
        pointerEvents: 'none',
        background: veil
          ? 'linear-gradient(to top, #000 0%, #000 44%, rgba(0,0,0,0.86) 66%, rgba(0,0,0,0) 100%)'
          : undefined,
      }
    : { width: '100%', boxSizing: 'border-box', flexShrink: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 24px' };

  return (
    <div ref={band} style={wrap}>
      {above && <div style={{ pointerEvents: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>{above}</div>}
      {/**
        * **1行にまとめる**（参考: ChatGPT の入力欄）。
        * ＋ / 書くところ / 統括AI / 深さ / ↑ を横一列に置く。2段に分けない。
        * 書いて2行以上になったら、そのときだけ縦に伸ばし、道具は下端に揃える。
        */}
      <div className="field" style={{
        width: '100%', maxWidth: 748, boxSizing: 'border-box', pointerEvents: 'auto',
        display: 'flex', alignItems: tall ? 'flex-end' : 'center', gap: inPane ? 7 : 10,
        minHeight: inPane ? 46 : 52,
        padding: tall
          ? (inPane ? '10px 7px 8px 12px' : '12px 8px 10px 15px')
          : (inPane ? '0 7px 0 12px' : '0 8px 0 15px'),
        borderRadius: tall ? 18 : inPane ? 23 : 26,
        background: RAIL, border: `1px solid ${EDGE}`,
        transition: `border-radius ${EASE_FAST}`,
        // 高さを測るときの計算を、この器の中だけで済ませる
        contain: 'layout',
      }}>
        {/**
          * 資料を添える。**文字のファイルはその場で読んで、会話に渡す**
          * （`/import` を畳んだので、材料の入口はここしか無い）。
          * 読めない形式は**読めないと言う** — 添えたのに何も起きない、を作らない。
          */}
        <input ref={pick} type="file" multiple hidden accept=".md,.txt,.csv,.json,.markdown"
          onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
        <button onClick={() => pick.current?.click()} className="icob"
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
          * **宛先＝どの Work の会話に書くか。**
          * 相手は always 統括AI（社員に直接は頼めない）ので、選ぶのは「どの話の続きか」。
          * Work の名前を並べ、いちばん下に「新しいチャット」を置く。
          */}
        {/* 宛先は「どの会話に書くか」。**ペインの中では出さない** — 見出しがもう名乗っている */}
        {!inPane && <ToMenu label={mode} />}
        {/* **深さの選びは置かない。** ここに置いていたものは自分の中だけで値を持っていて、
            押しても何も変わらなかった（「自動」という言葉も、ほかのどこにも無い）。
            深さは**モデルの中の話**なので、モデルと並べてメンバー画面に置く */}
        {/* **書いていないときは送れない。** 押せないものを押せる顔にしない */}
        <button disabled={!can || busy} onClick={send} className={can && !busy ? 'solid' : undefined} style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          background: can && !busy ? BLUE : '#242424',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: can && !busy ? 'pointer' : 'default',
          transition: 'background-color .14s ease',
        }}>
          <Icon name="up" color={can && !busy ? '#fff' : T5} size={16} width={1.8} />
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
      background: '#000', minHeight: 0, borderLeft: `1px solid ${HAIR}`,
    }}>
      <div style={{
        height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: tabs ? '0 12px' : '0 16px', borderBottom: `1px solid ${HAIR}`,
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
                borderRadius: 8, background: on ? `${SEAM}` : bare ? '#121212' : undefined,
                color: on ? T1 : T4, fontSize: 12.5,
                transition: `background-color .12s ease, color .12s ease, width ${EASE_FAST}`,
              }}>
                {/* 名前を出さないときは、印だけで「そこに1枚ある」と分かるようにする */}
                <span style={{
                  width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                  background: t.dot ?? (bare ? `${DIM}` : 'transparent'),
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
            {/* **飾りの ＋ を出さない。** タブを足す道は一覧の行（押すと開く）。
                押せる顔でハンドラの無いものを既定にしない */}
            {right}
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
export function Ask({ q, idx, total, options, free, answer, onPick, onFree, onSkip, onMove, busy }: {
  q: string; idx: number; total: number;
  options: { label: string; note: string; recommended?: boolean }[];
  free: string;
  /**
   * **答えは板が覚えない。** 親（画面）が持って、ここへ渡し直す。
   * 板の中に閉じ込めると、読み込み直したときに消えるし、保存もできない。
   */
  answer?: string;
  /** 選択肢を選んだ */
  onPick?: (label: string) => void;
  /** 自分の言葉で書いた */
  onFree?: (text: string) => void;
  /** この質問は飛ばす（閉じる） */
  onSkip?: () => void;
  /** ‹ › — 前の質問 / 次の質問へ */
  onMove?: (d: -1 | 1) => void;
  /** 送っている最中。二度押しさせない */
  busy?: boolean;
}) {
  /**
   * 質問は会話に流さず、**入力欄の上にくっついた板**として出す（スクロールで流れない）。
   *
   * 押せる口は4つ — **選択肢 / ‹ › / 自分の言葉で書く / スキップ**。
   * 前はどれも飾りで、選ぶと板が緑のチップになるだけだった（答えはブラウザから出なかった）。
   * いまは親に渡す。親が無い画面（ダミーの静止画）では、選んだ見た目だけ手もとで出す。
   */
  const [local, setLocal] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const box = useRef<HTMLInputElement>(null);

  const picked = answer ?? local;
  const take = (v: string) => { if (onPick) onPick(v); else setLocal(v); };
  const skip = () => { if (onSkip) onSkip(); else setGone(true); };

  useEffect(() => { if (writing) box.current?.focus(); }, [writing]);

  useEffect(() => {
    if (gone || picked || writing) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.key === 'Escape') { skip(); return; }
      if (onMove && total > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); onMove(e.key === 'ArrowLeft' ? -1 : 1); return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) { e.preventDefault(); take(options[n - 1].label); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

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
          <Icon name="check" color={GREEN_T} size={12} width={2.2} />
          <span style={{ color: T5, fontSize: 11.5 }}>{q}</span>
          <span style={{ color: GREEN_T, fontSize: 12.5 }}>{picked}</span>
        </span>
        <button onClick={() => { setLocal(null); if (onPick) onPick(''); }} className="lnk"
                style={{ color: T5, fontSize: 12 }}>選び直す</button>
        {onMove && total > 1 && idx < total && (
          <button onClick={() => onMove(1)} className="lnk" style={{ color: T5, fontSize: 12 }}>次の質問 ›</button>
        )}
      </div>
    );
  }

  const arrow = (d: -1 | 1, name: 'back' | 'fwd') => {
    const can = !!onMove && total > 1 && (d < 0 ? idx > 1 : idx < total);
    return (
      <button disabled={!can} onClick={() => onMove?.(d)} className={can ? 'icob' : undefined}
              aria-label={d < 0 ? '前の質問' : '次の質問'}
              style={{ display: 'inline-flex', padding: 3, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.35 }}>
        <Icon name={name} color={T5} size={12} />
      </button>
    );
  };

  return (
    <div className="rise" style={{
      width: '100%', maxWidth: 748, boxSizing: 'border-box', borderRadius: 14,
      background: '#101010', border: `1px solid ${RULE}`, overflow: 'hidden',
      opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
        <span style={{ color: T1, fontSize: 14 }}>{q}</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T5, fontSize: 12 }}>
          {arrow(-1, 'back')}
          <span className="tnum" style={{ padding: '0 2px' }}>{idx} / {total}</span>
          {arrow(1, 'fwd')}
        </span>
        <button onClick={skip} className="icob" title="閉じる"
                style={{ display: 'inline-flex', padding: 4, marginRight: -2 }}>
          <Icon name="close" color={T5} size={13} />
        </button>
      </div>
      {options.map((o, i) => (
        <button key={o.label} onClick={() => take(o.label)} className="row" style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px',
          borderTop: `1px solid ${SEAM}`, textAlign: 'left',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 5, background: SEAM, color: T4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
          }}>{i + 1}</span>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {o.label}
              {o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>推奨</span>}
            </span>
            <span style={{ color: T5, fontSize: 12 }}>{o.note}</span>
          </div>
        </button>
      ))}
      {/* いちばん下は自由入力。押すとその場が書くところになる */}
      <div className="row" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: `1px solid ${SEAM}`,
      }}>
        <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pencil" color={T4} size={13} />
        </span>
        {writing ? (
          <input
            ref={box} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) { e.preventDefault(); (onFree ?? take)(text.trim()); }
              if (e.key === 'Escape') { e.preventDefault(); setWriting(false); setText(''); }
            }}
            placeholder={free}
            style={{
              flex: 1, minWidth: 0, height: 24, background: 'none', border: 'none', outline: 'none',
              color: T1, fontSize: 13, padding: 0,
            }} />
        ) : (
          <button onClick={() => setWriting(true)} className="lnk"
                  style={{ flex: 1, textAlign: 'left', color: T3 }}>{free}</button>
        )}
        {writing ? (
          <button onClick={() => text.trim() && (onFree ?? take)(text.trim())}
                  disabled={!text.trim()} className={text.trim() ? 'lnk' : undefined}
                  style={{ color: text.trim() ? GREEN_T : T5, fontSize: 12, cursor: text.trim() ? 'pointer' : 'default' }}>
            送る
          </button>
        ) : (
          <button onClick={skip} className="lnk" style={{ color: T5, fontSize: 12 }}>スキップ</button>
        )}
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
            borderRadius: 999, background: '#121212', border: `1px solid ${LINE}`,
          }}>
            <Icon name="check" color={GREEN_T} size={11} width={2.4} />
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
      background: RAIL, border: `1px solid ${LINE}`,
    }}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button key={it.key} onClick={() => onPick(it.key)} className={on ? undefined : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 15px',
            borderRadius: 999, background: on ? `${EDGE}` : undefined, color: on ? T1 : T4,
            whiteSpace: 'nowrap', transition: 'background-color .12s ease, color .12s ease',
          }}>
            {it.icon}{it.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExecStatus({ state }: { state: 'idle' | 'thinking' | 'blocked' }) {
  const map = {
    idle:     { c: T5,        t: '待機',   pulse: false },
    thinking: { c: T2, t: '考えています', pulse: true },
    blocked:  { c: AMBER_T, t: '判断を待っています', pulse: false },
  }[state];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: map.c, fontSize: 12 }}>
      <span style={{
        width: 7, height: 7, borderRadius: 999,
        background: state === 'blocked' ? `${AMBER}` : state === 'thinking' ? `${T4}` : FAINT,
        animation: map.pulse ? 'pulse 1.4s ease-in-out infinite' : undefined,
      }} />
      {map.t}
    </span>
  );
}

/**
 * **まだ分からないあいだ、「無い」と言わない**（2026-08-26）。
 *
 * `PaneLoading` / `PaneError` は器（B群の宿題）として置いてあったのに、
 * **どこからも使われていなかった** — そのあいだ、取りに行っている最中のペインは
 * 「まだありません」「見つかりませんでした」と**言い切って**いた。
 * 無いのと、まだ知らないのは別のこと。
 *
 * **`PaneEmpty` は消した。** 全画面ぶんのペインを見たが、空状態はどれも
 * **節の中**（フィールドや見出しの下）にあって、ペインいっぱいに置く形が
 * 合う場所が1つも無かった。器だけ残しておくと、次に読む人が「使う場所がある」と読む。
 */
export function PaneLoading({ lines = 4 }: { lines?: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 18 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height: 10, borderRadius: 3, background: RAIL,
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
export function PaneError({ what, next, retry = 'もう一度', onRetry }:
  { what: string; next: string; retry?: string; onRetry?: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
      <span style={{ color: RED_T, fontSize: 13 }}>{what}</span>
      <span style={{ color: T3, fontSize: 12.5, lineHeight: '20px' }}>{next}</span>
      {/* **押せる顔をして何も起きない、を作らない。** 口が無いなら出さない */}
      {onRetry && (
        <button onClick={onRetry} className="btn" style={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
          borderRadius: 8, background: SUNK, border: `1px solid ${EDGE}`, color: T2, fontSize: 12.5,
        }}>{retry}</button>
      )}
    </div>
  );
}

/** 右ペインの下に貼り付く行動の行（承認する / 決定する など）。行き先があるなら本当に飛ぶ */
export function PaneFooter({ primary, secondary, reverse = false, primaryHref }:
  { primary: string; secondary?: string; reverse?: boolean; primaryHref?: Route }) {
  const sec = secondary && (
    <span className="btn" style={{
      display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 16px', borderRadius: 8,
      background: SUNK, border: `1px solid ${EDGE}`, color: T2, whiteSpace: 'nowrap',
    }}>{secondary}</span>
  );
  const priStyle: React.CSSProperties = {
    flex: reverse ? undefined : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 38, padding: reverse ? '0 20px' : undefined, borderRadius: 8,
    background: BLUE, color: '#fff', whiteSpace: 'nowrap',
  };
  const pri = primaryHref
    ? <Link href={primaryHref} className="solid" style={priStyle}>{primary}</Link>
    : <span className="solid" style={priStyle}>{primary}</span>;
  return (
    <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: 16, borderTop: `1px solid ${HAIR}` }}>
      {/* reverse＝「小さい2つ、青が右」（採用・診断） */}
      {reverse ? <>{sec}<div style={{ flex: 1 }} />{pri}</> : <>{pri}{sec}</>}
    </div>
  );
}

/** ペインの中の小見出し。面も枠も置かない */
export function PaneHead({ children, top = false }: { children: React.ReactNode; top?: boolean }) {
  return <div style={{ padding: top ? '0 0 4px' : '22px 0 4px' }}><span style={{ color: T3 }}>{children}</span></div>;
}


/**
 * 宛先のメニュー。**どの Work の会話に書くか**を選ぶ。
 *
 * 相手は変わらない（いつも統括AI）ので、選ぶのは**話の続き先**。
 * 選ぶとその会話へ移る — 宛先だけ変えて画面に残ると、
 * 「いまどこに書いているのか」が画面のどこにも出なくなる。
 *
 * **終わった Work は出さない**（もう相談することが無い）。
 *
 * **Work が1つも無くても畳まない。** 前は「選べる先が1つなら選ばせない」で素の文字にしていたが、
 * 押せると思って押した社長には**壊れて見える**（プルダウンの ⌄ が付いているのに開かない）。
 * 会話の途中からでも「新しいチャット」へ抜けられるので、行き先はいつも本物。
 */
function ToMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [works, setWorks] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const router = useRouter();

  /**
   * **開いたときに取りに行く。**
   * 前は全画面で、開いてもいないのに Work の一覧を1本ぶん取っていた
   * （入力欄はどの画面にもあるので、**画面を開くたびに必ず1往復**）。
   * 中身が要るのは板を開いた瞬間だけ。
   */
  const got = useRef(false);
  useEffect(() => {
    if (!open || got.current) return;
    got.current = true;
    chatTargets().then(setWorks);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const go = async (workId: string | null) => {
    setOpen(false);
    if (!workId) { router.push('/chat/new' as Route); return; }
    setBusy(true);
    const r = await openWorkChat(workId);
    setBusy(false);
    if (r.ok) router.push(`/chat/${r.threadId}` as Route);
  };

  return (
    <span ref={box} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button className="btn" aria-haspopup="listbox" aria-expanded={open} disabled={busy}
        onClick={() => setOpen(!open)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 9px',
          borderRadius: 8, color: T4, fontSize: 12.5, whiteSpace: 'nowrap', maxWidth: 190,
          boxShadow: open ? 'inset 0 0 0 40px rgba(255,255,255,.03)' : undefined,
        }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <Icon name="down" color={T5} size={11} />
      </button>
      {open && (
        <span role="listbox" className="pop" style={{
          position: 'absolute', bottom: 36, right: 0, zIndex: 20, width: 232, padding: 5, borderRadius: 11,
          background: SUNK, border: `1px solid ${FAINT}`, boxShadow: '0 18px 44px rgba(0,0,0,.74)',
        }}>
          {works.map((w) => (
            <button key={w.id} role="option" aria-selected={w.title === label} className="btn"
              onClick={() => go(w.id)} style={{
                display: 'flex', alignItems: 'center', width: '100%', height: 30, padding: '0 10px',
                borderRadius: 7, color: w.title === label ? T1 : T2, fontSize: 12,
                background: w.title === label ? `${WELL}` : undefined,
              }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.title}
              </span>
              <span style={{ flex: 1 }} />
              {w.title === label && <span style={{ color: GREEN_T, fontSize: 11 }}>✓</span>}
            </button>
          ))}
          {works.length > 0 && <span style={{ display: 'block', height: 1, margin: '5px 8px', background: RULE }} />}
          <button role="option" aria-selected={label === NEW_CHAT} className="btn" onClick={() => go(null)} style={{
            display: 'flex', alignItems: 'center', width: '100%', height: 30, padding: '0 10px',
            borderRadius: 7, color: label === NEW_CHAT ? T1 : T3, fontSize: 12,
            background: label === NEW_CHAT ? `${WELL}` : undefined,
          }}>
            {NEW_CHAT}<span style={{ flex: 1 }} />
            {label === NEW_CHAT && <span style={{ color: GREEN_T, fontSize: 11 }}>✓</span>}
          </button>
        </span>
      )}
    </span>
  );
}

