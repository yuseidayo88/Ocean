import { chatReply } from '@/app/actions/chat';
import { threadGet } from '@/app/actions/live';

/**
 * 統括AIの返事を**流しながら**受け取る（→ `app/api/chat/route.ts`）。
 *
 * 画面が2つある（チャットの画面と、どの画面からでも開く右ペイン）ので、
 * **受け取り方は1か所**にまとめる。分けて書くと、片方だけ直る。
 *
 * **流す道が使えなかったときは、流さない道に落ちる**（`chatReply`）。
 * `/api/*` はページとは別の関数として配られるので、メモリのストアはそこから見えない —
 * そのときサーバーは `{"fallback":true}` とだけ言う（→ route の説明）。
 * 返事が出ないよりは、まとめて1回で出るほうがいい。
 *
 * 返すのは「うまくいかなかった理由」だけ。うまくいったら null。
 * 本文は `onText` に、届いたぶんだけ渡す。
 */
export async function streamReply(
  threadId: string, onText: (chunk: string) => void, onStage?: (stage: string) => void,
  onThink?: (chunk: string) => void,
): Promise<string | null> {
  let fail: string | null = null;
  /**
   * **終わりの合図（done / err）だけを「応えた」と数える。**
   * 途中の s / th / t で数えると、関数が途中で切られたとき（done も err も来ない）
   * を成功と誤読して、返事が黙って消える。合図無しで閉じたら、流さない道に落ちる —
   * 落ちる先は先に会話を読み直すので、書き終わっていれば二度払わない。
   */
  let reached = false;
  let drop = false;           // 「この道では返せない」と言われた
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
    const reader = res.ok ? res.body?.getReader() : undefined;
    if (reader) {
      const dec = new TextDecoder();
      let buf = '';
      while (!drop) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const rows = buf.split('\n');
        buf = rows.pop() ?? '';          // 最後の1行は途中かもしれないので残す
        for (const row of rows) {
          if (!row.trim()) continue;
          try {
            const m = JSON.parse(row) as
              { s?: string; t?: string; th?: string; done?: boolean; err?: string; fallback?: boolean };
            if (m.fallback) { drop = true; break; }
            if (m.s) onStage?.(m.s);
            if (m.th) onThink?.(m.th);
            if (m.t) onText(m.t);
            if (m.done) reached = true;
            if (m.err) { reached = true; fail = m.err; }
          } catch { /* 壊れた行は捨てる */ }
        }
      }
      if (drop) await reader.cancel().catch(() => {});
    }
  } catch { /* 下で落とす */ }

  if (reached && !drop) return fail;

  /**
   * 流す道が使えなかった。**黙って終わらせない** — まとめて1回で取りに行く。
   *
   * ただし**もう返事が入っているなら、頼み直さない** — 途中で線が切れただけのとき、
   * サーバー側は最後まで書いて保存している。二度頼むと同じ返事が2つ並び、2回ぶん払う。
   */
  const now = await threadGet(threadId).catch(() => null);
  const last = now?.messages[now.messages.length - 1];
  if (last && last.role !== 'user') return null;

  const r = await chatReply(threadId);
  return r.ok ? null : r.message;
}
