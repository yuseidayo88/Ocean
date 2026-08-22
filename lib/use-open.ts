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

/** 一覧の行に張るリンク先。その行を開いた状態の URL */
export const openHref = (path: string, id: string) =>
  `${path}?open=${encodeURIComponent(id)}` as Route;
