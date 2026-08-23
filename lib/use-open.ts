'use client';

import type { Route } from 'next';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useShell } from '@/components/shell/Shell';

/**
 * 右ペインで開いている1件を **URL に持つ**（`?open=<id>`）。
 *
 * こうしておくと:
 *   ・別の画面から「その1件」へ直接飛べる（`/tasks?open=tk-price`）
 *   ・トップバーの ‹ › が意味を持つ
 *   ・リンクを人に渡せる
 *
 * ただし **URL を先に書かない。**
 *   `history.replaceState` を呼ぶと、Next.js の router が状態を作り直し、
 *   その途中で画面の高さを読む（`dontForceLayout` のところ）。
 *   これがページ全体の配置計算を1回強制するので、遅い機械では 40ms ほど固まる。
 *   押した瞬間に固まると「反応が遅い」になる。
 *
 * だから **開くのは手もとの state で先にやり、URL は描いたあとで書く。**
 * 見えるものは同じで、待たされるところだけ無くなる。
 */
const write = (path: string, q: URLSearchParams) => {
  const s = q.toString();
  window.history.replaceState(null, '', s ? `${path}?${s}` : path);
};

/** URL の1つの値を、描いたあとで書き戻す形で持つ */
function useLate(key: string, fallback: string | null) {
  const sp = useSearchParams();
  const path = usePathname();
  const { chat, closeChat } = useShell();
  const url = sp.get(key) ?? fallback;
  const [now, setNow] = useState(url);
  const [seen, setSeen] = useState(url);

  /**
   * 外から URL が変わったとき（別画面から来た・戻るを押した）は合わせる。
   * **effect ではなく、描いている途中で直す。** effect にすると
   * 「古い値で1回描く → 直す → もう1回描く」になり、一瞬だけ前の1件が見える。
   * 描画中に setState すると React はその場でやり直すので、画面には出ない。
   */
  if (seen !== url) { setSeen(url); setNow(url); }

  // 開け閉めしたあと、**描き終わってから** URL を書く
  useEffect(() => {
    if (now === url) return;
    const q = new URLSearchParams(window.location.search);
    if (now && now !== fallback) q.set(key, now); else q.delete(key);
    write(path, q);
  }, [now, url, key, path, fallback]);

  /**
   * 右は1枚だけ。**会話を開いたまま行を選んだら、選んだほうに入れ替わる。**
   * 押しても何も出ない、をつくらない。
   */
  /**
   * **識別をむやみに変えない。** これを `useCallback` の依存に入れる側
   * （ワークフローの `pick`）が毎描画で作り直しになるため。
   * 変わるのは会話の開け閉めのときだけ。
   */
  const set = useCallback((v: string | null) => {
    if (chat.on) closeChat();
    setNow(v);
  }, [chat.on, closeChat]);
  return [now, set] as const;
}

export function useOpen() {
  return useLate('open', null);
}

/** 画面の中の切り替え（ホームの `?view=desk` など） */
export function useParam(key: string, fallback: string) {
  const [v, set] = useLate(key, fallback);
  return [v ?? fallback, set as (next: string) => void] as const;
}

/**
 * タブの形のペイン（成果物・スキル）は、開いている**並び**と**いま見ているもの**の2つを持つ。
 * `?open=d-rev,d-mkt&at=1` — 並びは動かさない（読み比べるので、押すたびに順番が変わると困る）。
 */
export function useTabs(all: string[]) {
  const sp = useSearchParams();
  const path = usePathname();
  const { chat, closeChat } = useShell();
  const urlIds = sp.get('open') ?? '';
  const urlAt = sp.get('at') ?? '0';
  const [raw, setRaw] = useState<[string, string]>([urlIds, urlAt]);
  const [seen, setSeen] = useState<[string, string]>([urlIds, urlAt]);

  // 上と同じ。**描いている途中で直す**（タブが一瞬ちらつかない）
  if (seen[0] !== urlIds || seen[1] !== urlAt) {
    setSeen([urlIds, urlAt]);
    setRaw([urlIds, urlAt]);
  }

  useEffect(() => {
    if (raw[0] === urlIds && raw[1] === urlAt) return;
    const q = new URLSearchParams(window.location.search);
    if (raw[0]) q.set('open', raw[0]); else q.delete('open');
    if (raw[1] !== '0') q.set('at', raw[1]); else q.delete('at');
    write(path, q);
  }, [raw, urlIds, urlAt, path]);

  const ids = raw[0].split(',').filter((id) => all.includes(id));
  const at = Math.min(Math.max(Number(raw[1]) || 0, 0), Math.max(ids.length - 1, 0));
  const set = (next: string[], nextAt: number) => {
    if (chat.on) closeChat();   // 右は1枚だけ
    setRaw([next.join(','), String(next.length > 1 ? nextAt : 0)]);
  };

  return {
    ids, at,
    /** 開く。すでに開いていればそのタブへ移るだけ（同じものを2枚開かない） */
    open: (id: string) => {
      const i = ids.indexOf(id);
      if (i >= 0) set(ids, i);
      else set([...ids, id], ids.length);
    },
    /** タブを選ぶ */
    select: (i: number) => set(ids, i),
    /** いま見ているタブを閉じる。並びは詰めて、右隣（無ければ左隣）へ移る */
    close: () => {
      const next = ids.filter((_, i) => i !== at);
      set(next, Math.min(at, Math.max(next.length - 1, 0)));
    },
    /** 全部閉じる */
    clear: () => set([], 0),
  };
}

/** 一覧の行に張るリンク先。その行を開いた状態の URL */
export const openHref = (path: string, id: string) =>
  `${path}?open=${encodeURIComponent(id)}` as Route;
