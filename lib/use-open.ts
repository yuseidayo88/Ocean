'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * 右ペインで開いている1件を **URL に持つ**（`?open=<id>`）。
 *
 * こうしておくと:
 *   ・別の画面から「その1件」へ直接飛べる（`/tasks?open=t-price`）
 *   ・トップバーの ‹ › が意味を持つ（開く・閉じるも履歴になる）
 *   ・リンクを人に渡せる
 */
export function useOpen() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const open = sp.get('open');

  const set = (id: string | null) => {
    const q = new URLSearchParams(sp.toString());
    if (id) q.set('open', id); else q.delete('open');
    const s = q.toString();
    router.replace((s ? `${path}?${s}` : path) as Route, { scroll: false });
  };
  return [open, set] as const;
}

/**
 * タブの形のペイン（成果物・スキル）は、開いている**並び**と**いま見ているもの**の2つを持つ。
 * `?open=d-rev,d-mkt&at=1` — 並びは動かさない（読み比べるので、押すたびに順番が変わると困る）。
 * 2つを1回で書き換えるので、片方が古いまま上書きされることがない。
 */
export function useTabs(all: string[]) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();

  const ids = (sp.get('open') ?? '').split(',').filter((id) => all.includes(id));
  const at = Math.min(Math.max(Number(sp.get('at') ?? 0) || 0, 0), Math.max(ids.length - 1, 0));

  const write = (next: string[], nextAt: number) => {
    const q = new URLSearchParams(sp.toString());
    if (next.length) q.set('open', next.join(',')); else q.delete('open');
    if (next.length > 1 && nextAt > 0) q.set('at', String(nextAt)); else q.delete('at');
    const s = q.toString();
    router.replace((s ? `${path}?${s}` : path) as Route, { scroll: false });
  };

  return {
    ids, at,
    /** 開く。すでに開いていればそのタブへ移るだけ（同じものを2枚開かない） */
    open: (id: string) => {
      const i = ids.indexOf(id);
      if (i >= 0) write(ids, i);
      else write([...ids, id], ids.length);
    },
    /** タブを選ぶ */
    select: (i: number) => write(ids, i),
    /** いま見ているタブを閉じる。並びは詰めて、右隣（無ければ左隣）へ移る */
    close: () => {
      const next = ids.filter((_, i) => i !== at);
      write(next, Math.min(at, Math.max(next.length - 1, 0)));
    },
    /** 全部閉じる */
    clear: () => write([], 0),
  };
}

/** 一覧の行に張るリンク先。その行を開いた状態の URL */
export const openHref = (path: string, id: string) =>
  `${path}?open=${encodeURIComponent(id)}` as Route;
