'use client';

import NextLink from 'next/link';

/**
 * 行き先。**素の `<Link>` の代わりにこれを使う。**
 *
 * Next.js の既定は「行き先が毎回サーバーで作られるものなら、先には取らない」。
 * この会社の画面は全部そうなので、既定のままだと**押してから取りに行く**ことになり、
 * ネットワーク越しで 170ms 待たされていた（60ms の遅延で実測）。
 *
 * `prefetch` を明示すると、リンクが画面に入った時点で中身を取っておく。
 * 押した瞬間にはもう手もとにあるので、待ち時間が消える。
 * 取りに行くのは画面に見えているリンクだけで、同じ行き先は1回しか取らない。
 */
/** `<Link>` の型（typedRoutes の行き先チェックをそのまま通す） */
type LinkProps<R> = Parameters<typeof NextLink<R>>[0];

export function Go<R>(props: LinkProps<R>) {
  return <NextLink prefetch {...props} />;
}
