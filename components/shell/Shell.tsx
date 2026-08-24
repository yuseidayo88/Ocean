'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { morning } from '@/app/actions/run';
import { companyName } from '@/app/actions/live';
import { chatSay } from '@/app/actions/chat';
import { streamReply } from '@/lib/chat/stream';
import { SHELL_MIN, T2 } from '@/lib/design/tokens';
/**
 * 器の開け閉め。左レールはレールの中の印で閉じ、閉じたら**端に何も残さない**。
 * 戻り道はトップバーの左端（右ペインと同じ作法）。
 */

/**
 * 統括AIとの会話は**どの画面からでも始められる**。
 * 入力欄に書いて送ると、右ペインがその会話になって開く
 * （参考: ClickUp Brain / Fabric / HoneyBook — 右にAIを出すアプリは
 *  例外なく**入力欄もそのパネルの中**に入れている）。
 * `said` は送っている途中のぶん（楽観表示）、`live` は流れてきている本文。
 * **中身はチャットの画面と同じ統括AI** — `chatSay` で書いて、`/api/chat` が流し返す。
 * 書き終わると rev を上げ、ペインが読み直す。鍵の無い環境は「仮の返事」と名乗る。
 */
export type Chat = {
  on: boolean; thread: string | null; said: string[]; busy: boolean; rev: number;
  /** いま流れてきている本文（書き終わると会話に入る） */
  live: string;
  /** **いま何をしているか**（「〇〇しています」） */
  stage: string;
  /** うまくいかなかった理由。次に送ると消える */
  fail: string;
};

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
  chat: { on: false, thread: null, said: [], busy: false, rev: 0, live: '', stage: '', fail: '' },
  say: () => {}, fresh: () => {}, closeChat: () => {},
  find: false, setFind: () => {}, note: null, say5: () => {},
});
export const useShell = () => useContext(Ctx);

export function Shell({ children }: { children: React.ReactNode }) {
  const [rail, setRail] = useState(true);
  const [chat, setChat] = useState<Chat>({ on: false, thread: null, said: [], busy: false, rev: 0, live: '', stage: '', fail: '' });
  // say はどの描画からでも呼ばれるので、最新の chat は ref で読む（依存を増やさない）
  const chatRef = useRef(chat);
  useEffect(() => { chatRef.current = chat; });
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

  /**
   * 送る。**チャットの画面とまったく同じ道**を通る（`chatSay` → `/api/chat`）—
   * 前はここだけ道具を持たない別の統括AIで、同じことを聞いても返事の形が違った。
   * 本文は流れてくるので、右ペインでも書けたそばから読める。
   */
  const say = useCallback((text: string, thread?: string | null) => {
    const cur = chatRef.current;
    const target = cur.on ? cur.thread : thread ?? null;
    setChat({ on: true, thread: target, said: [...(cur.on ? cur.said : []), text],
              busy: true, rev: cur.rev, live: '', stage: '', fail: '' });
    void (async () => {
      const w = await chatSay(target, text);
      if (!w.ok) { setChat((c) => ({ ...c, busy: false, said: [], live: '', stage: '', fail: w.message })); return; }
      const tid = w.threadId;
      setChat((c) => ({ ...c, thread: tid }));
      let got = '';
      const bad = await streamReply(tid, (t) => { got += t; setChat((c) => ({ ...c, live: got })); },
        (st) => setChat((c) => ({ ...c, stage: st })));
      // 読み直してから流れていた文を下ろす（一瞬消えるのを避ける）
      setChat((c) => ({ ...c, busy: false, said: [], live: '', stage: '', fail: bad ?? '', rev: c.rev + 1 }));
    })();
  }, []);
  const fresh = useCallback(() => setChat({ on: true, thread: null, said: [], busy: false, rev: 0, live: '', stage: '', fail: '' }), []);
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
 * まだ何もない会社の画面（→ docs/design/01-data-model.md 入口）。
 * 入口はチャットに一本化したので、**残っているのは `/start` だけ**（2026-08-24）。
 */
export const EMPTY_ROUTES = ['/start'];
export const isBlank = (p: string) => EMPTY_ROUTES.some((r) => p === r || p.startsWith(r + '/'));

/**
 * パンくずの根。**いま見ているものは全部この会社のもの**なので、行き先の親として置く
 * （レールの上ではなく。レールを閉じても消えないのも利点）。
 *
 * **会社は1つだけ**（2026-08-24 の判断 → `docs/PLAN.md` 見送りの台帳）。
 * 切り替える先も、増やす道も無いので、**押せる顔をしない** — 素の文字にする。
 * 前は ⌄ ＋ 一覧 ＋「会社を追加」を出していたが、どれも押しても何も起きなかった。
 * 「押せる以上、複数社は本物にする」の裏返しで、**本物にしないなら押させない。**
 * 複数社を入れるときは `memberships` ＋ `current_account_id()` の書き換えと一緒に、
 * この器をボタンに戻す（ポリシー28本は無変更のまま入る設計）。
 */
export function CompanyPicker() {
  const [company, setCompany] = useState('あなたの会社');
  useEffect(() => { companyName().then(setCompany); }, []);
  const path = usePathname();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, color: T2 }}>
      {isBlank(path) ? 'あなたの会社' : company}
    </span>
  );
}
