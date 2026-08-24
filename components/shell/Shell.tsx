'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { usePathname } from 'next/navigation';
import { COMPANIES } from '@/lib/dummy';
import { morning } from '@/app/actions/run';
import { FAINT, RULE, SHELL_MIN, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * 器の開け閉め。左レールはレールの中の印で閉じ、閉じたら**端に何も残さない**。
 * 戻り道はトップバーの左端（右ペインと同じ作法）。
 */

/**
 * 統括AIとの会話は**どの画面からでも始められる**。
 * 入力欄に書いて送ると、右ペインがその会話になって開く
 * （参考: ClickUp Brain / Fabric / HoneyBook — 右にAIを出すアプリは
 *  例外なく**入力欄もそのパネルの中**に入れている）。
 * `said` は自分が書いたぶん。**返事は作らない**（統括AIは「考えています」で止まる。会話で答えるのは Phase 7 から）。
 */
export type Chat = { on: boolean; thread: string | null; said: string[] };

type Shell = {
  rail: boolean; setRail: (v: boolean) => void;
  chat: Chat;
  /** 入力欄から送る。会話が閉じていれば開く */
  say: (text: string, thread?: string | null) => void;
  /** 新しいチャットにする */
  fresh: () => void;
  closeChat: () => void;
  /** 検索の板（⌘K）。どの画面からでも開く */
  find: boolean; setFind: (v: boolean) => void;
  /**
   * **まだ効かないものを押したときの返し。**
   * 黙って何も起きないのがいちばん悪い（押せる顔をしているのに）。
   * Phase 5 で書き込みが通るまで、何が要るのかを1行だけ返す。
   */
  note: string | null; say5: (what: string) => void;
};

const Ctx = createContext<Shell>({
  rail: true, setRail: () => {},
  chat: { on: false, thread: null, said: [] },
  say: () => {}, fresh: () => {}, closeChat: () => {},
  find: false, setFind: () => {}, note: null, say5: () => {},
});
export const useShell = () => useContext(Ctx);

export function Shell({ children }: { children: React.ReactNode }) {
  const [rail, setRail] = useState(true);
  const [chat, setChat] = useState<Chat>({ on: false, thread: null, said: [] });
  const [find, setFind] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // ⌘K / Ctrl+K はどの画面でも効く
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setFind((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /**
   * 朝の報告。**開いた側から統括AIが言う**（チャットボットは聞かれるまで黙っている —
   * ここが違い）。器が開いたとき1回だけ呼ぶ。その日すでに書いたかはストアが判定する。
   * 日付は**この画面の側**で作る — 「その日の朝」は社長のいる場所の朝で、サーバーの UTC ではない。
   * 結果は待たない — 報告は通知の画面に落ちるので、ここで画面を止める理由が無い。
   */
  useEffect(() => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    void morning(day);
  }, []);

  /**
   * **器の口は識別を変えない。** ここは全画面が読む context なので、
   * 毎描画で関数を作り直すと、これを依存に入れている側
   * （ワークフローの `pick` など）が丸ごと作り直しになる。
   * 前はそれを避けるために呼ぶ側が ref に逃がしていた。逃がす必要が無いように、出どころで固める。
   */
  const say5 = useCallback((what: string) => {
    setNote(what);
    window.setTimeout(() => setNote((n) => (n === what ? null : n)), 3200);
  }, []);

  const say = useCallback((text: string, thread?: string | null) =>
    setChat((c) => ({
      on: true,
      thread: c.on ? c.thread : thread ?? null,
      said: [...(c.on ? c.said : []), text],
    })), []);
  const fresh = useCallback(() => setChat({ on: true, thread: null, said: [] }), []);
  const closeChat = useCallback(() => setChat((c) => ({ ...c, on: false })), []);

  // 中身が変わったときだけ作り直す（毎描画で新しい object を配らない）
  const value = useMemo(
    () => ({ rail, setRail, chat, say, fresh, closeChat, find, setFind, note, say5 }),
    [rail, chat, say, fresh, closeChat, find, note, say5]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * 器。**狭い窓では中身を潰さず、窓のほうを横に滑らせる**（→ docs/design/08-panes.md）。
 *
 * ただし会話のペインぶんまで器を広げると、開いた会話そのものが画面の外に出てしまう。
 * 盤面（オフィス / ワークフロー）は**絵なので、入る大きさに縮める**（→ Canvas）。
 * 文字は縮めない。縮んでいいのは絵だけ。
 */
export function ShellBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', background: '#000', overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ display: 'flex', height: '100%', minWidth: SHELL_MIN }}>
        {children}
      </div>
    </div>
  );
}

/** 会話のペインの幅 */
export const CHAT_W = 430;

/**
 * 会社の切り替え。**いま見ているものは全部この会社のもの**なので、
 * パンくずの根に置く（レールの上ではなく）。レールを閉じても消えない。
 */
/** まだ何もない会社の画面（→ docs/design/01-data-model.md 入口） */
export const EMPTY_ROUTES = ['/start', '/discovery', '/import', '/diagnosis'];
export const isBlank = (p: string) => EMPTY_ROUTES.some((r) => p === r || p.startsWith(r + '/'));

export function CompanyPicker() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Esc で閉じる（右ペインと同じ作法）
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);
  const blank = isBlank(path);
  const now = COMPANIES.find((c) => c.current) ?? COMPANIES[0];
  const name = blank ? 'あなたの会社' : now.name;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen(!open)} className="btn" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px',
        borderRadius: 7, color: open ? T1 : T2,
      }}>
        {name}<Icon name="down" color={open ? T3 : T4} size={12} />
      </button>
      {open && (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
          <div className="pop" style={{
            position: 'absolute', top: 32, left: 0, width: 224, zIndex: 40, boxSizing: 'border-box', padding: 5,
            borderRadius: 11, background: SUNK, border: `1px solid ${FAINT}`,
            boxShadow: '0 18px 44px rgba(0,0,0,0.72)',
          }}>
            {COMPANIES.map((c) => (
              <button key={c.id} className={c.current ? 'hit' : 'row'} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px',
                borderRadius: 7, background: c.current ? `${RULE}` : undefined, textAlign: 'left',
              }}>
                <span style={{ color: c.current ? T1 : T2 }}>{c.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: T5 }}>Work {c.works}</span>
              </button>
            ))}
            <div style={{ height: 1, margin: '5px 8px', background: RULE }} />
            <button className="row" style={{
              width: '100%', display: 'flex', alignItems: 'center', height: 32, padding: '0 10px',
              borderRadius: 7, textAlign: 'left',
            }}><span style={{ color: T3 }}>会社を追加</span></button>
          </div>
        </>
      )}
    </span>
  );
}
