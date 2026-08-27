import { store } from '@/lib/store';

/**
 * **公開したページ**（2026-08-27。社長の「他のやつから順に」の③）。
 *
 * ここだけは**セッションを持たない人が読む**。middleware も素通しにしてある
 * （`PUBLIC` に `/p`）。読めるのは 0038 のポリシーが公開を許した行だけ。
 *
 * ## 画面ではなく、素の HTML を返す
 *
 * `page.tsx` にすると器（`<html>` と全体の CSS）が付いてきて、
 * **社長の LP と喧嘩する**。ここは1枚の web ページを出す場所なので、
 * 中身をそのまま返す。
 *
 * ## script は走らない
 *
 * 出すのは自分のオリジンなので、置いたままの script は
 * **このアプリの名前で**走る。しまう時点で落としてあるが（`lib/deliver/publish.ts`）、
 * **落とし漏れても走らないように** CSP でも止める（二重に止める）。
 * 絵と書体と面は外から来ていいので、そこは開けておく。
 */

export const dynamic = 'force-dynamic';

/**
 * **要るものだけ開ける。** `default-src 'self'` にすると、
 * このアプリ自身への呼び出しが**全部**通ってしまう — 公開したページから
 * `<img src="/api/…">` を1個置くだけで、**見た人のセッションで**その口が叩ける。
 * LP に要るのは面と絵と書体だけなので、そこだけ開ける。
 */
const CSP = [
  "default-src 'none'",
  "script-src 'none'",                      // **落とし漏れても走らせない**
  "style-src 'unsafe-inline' https:",
  "img-src data: https:",
  "font-src data: https:",
  "form-action 'none'",                     // 押しても、どこにも送らない
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

const MISS = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>ありません</title></head>
<body style="background:#000;color:#8A8A8A;font-family:system-ui;
             display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<span style="font-size:14px">このページはありません（下げられたか、まだ公開されていません）</span>
</body></html>`;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const page = await store().pageBySlug(slug).catch(() => null);
  const head = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
  if (!page) return new Response(MISS, { status: 404, headers: head });
  return new Response(page.html, { status: 200, headers: head });
}
