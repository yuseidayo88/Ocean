import { replyTo } from '@/lib/exec/reply';

/**
 * **統括AIの返事を、書けたそばから流す。**
 *
 * サーバーアクションは返り値が1個なので、返事が全部できるまで画面は「考えています」のまま。
 * モデルが10秒考えれば10秒黙る — それは**チャットとして成立していない**。
 * ここは書けた文字から順に流すので、**最初の1文字が届いた瞬間から読める**。
 *
 * 流すのは本文だけ。**カードは最後**（道具の結果は往復の終わりにしか揃わない）なので、
 * 終わりの合図を受けた画面がスレッドを読み直して、カードごと差し替える。
 *
 * **`/api/*` はページとは別の関数として配られることがある**（Vercel も Cloudflare も）。
 * メモリのストアはその場合ここからは見えず、ページ側が書いたスレッドが
 * **まるごと存在しないように見える**（実際そうなって「このチャットは見つかりませんでした」
 * だけが出た）。だから**見えなかったときは `fallback`** と言い、画面は
 * 流さない道（`chatReply` ＝ ページ側の関数）で取り直す。
 * **存在しているものを「見つかりません」と言わない。**
 *
 * 形は行区切りの JSON（1行1件）:
 *   {"s":"…"}          いま何をしているか（「〇〇しています」）
 *   {"t":"…"}          本文のかけら
 *   {"done":true}      書き終わり（画面はここで読み直す）
 *   {"fallback":true}  この道では返せない。画面は別の道で取り直す
 *   {"err":"…"}        倒れた。理由は画面に出す（会話にも1行残っている）
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let threadId = '';
  try {
    threadId = String(((await req.json()) as { threadId?: unknown }).threadId ?? '');
  } catch { /* 下で弾く */ }
  if (!threadId) return new Response('{"err":"チャットが指定されていません"}\n', { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const line = (o: unknown) => c.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      try {
        const r = await replyTo(threadId, (t) => line({ t }), (st) => line({ s: st }));
        if (r.ok) line({ done: true });
        else if (r.missing) line({ fallback: true });
        else line({ err: r.message });
      } catch (e) {
        line({ err: e instanceof Error ? e.message : '応えられませんでした' });
      }
      c.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      // 途中で溜め込まれると「流す」意味が無くなる（プロキシへの合図）
      'x-accel-buffering': 'no',
    },
  });
}
