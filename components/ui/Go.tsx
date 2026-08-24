'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

/**
 * 行き先。**素の `<Link>` の代わりにこれを使う。**
 *
 * Next.js の既定は「行き先が毎回サーバーで作られるものなら、先には取らない」。
 * この会社の画面は全部そうなので、既定のままだと**押してから取りに行く**ことになり、
 * ネットワーク越しで 170ms 待たされていた（60ms の遅延で実測）。
 *
 * ただし **`prefetch` を全部のリンクに付けたら、逆に遅くなった**（2026-08-24）。
 * リンクが画面に入っただけで先に取りに行くので、**1画面ひらくたびに
 * 10〜16画面ぶんのサーバー描画**が走る（レールの行き先7つ＋会話6本＋…）。
 * 1本1本が認証を通り、DBを何度も読む。本命の画面は、その渋滞の後ろに並ぶ。
 *
 * だから**指が乗ったときだけ取る**。押すまでの間（ふつう100ms以上）に取れているので
 * 待ち時間は消えたまま、**何もしていない時の往復はゼロ**になる。
 * キーボードで回っている人には `focus`、指で触る端末には `touchstart` で同じことをする。
 */
/** `<Link>` の型（typedRoutes の行き先チェックをそのまま通す） */
type LinkProps<R> = Parameters<typeof NextLink<R>>[0];

export function Go<R>({ onMouseEnter, onFocus, onTouchStart, ...props }: LinkProps<R>) {
  const router = useRouter();
  const took = useRef(false);

  // 同じ行き先は1回だけ（Next 側でも覚えているが、呼ぶ回数そのものを減らす）
  const take = useCallback(() => {
    if (took.current) return;
    took.current = true;
    const href = props.href;
    if (typeof href === 'string') router.prefetch(href);
  }, [router, props.href]);

  return (
    <NextLink
      prefetch={false}
      onMouseEnter={(e) => { take(); onMouseEnter?.(e); }}
      onFocus={(e) => { take(); onFocus?.(e); }}
      // 指で触る端末には hover が無い。触れた瞬間に取りに行く
      onTouchStart={(e) => { take(); onTouchStart?.(e); }}
      {...props}
    />
  );
}
