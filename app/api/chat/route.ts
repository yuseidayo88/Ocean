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
 * 形は行区切りの JSON（1行1件）:
 *   {"t":"…"}      本文のかけら
 *   {"done":true}  書き終わり（画面はここで読み直す）
 *   {"err":"…"}    倒れた。理由は画面に出す（会話にも1行残っている）
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
        const r = await replyTo(threadId, (t) => line({ t }));
        line(r.ok ? { done: true } : { err: r.message });
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
