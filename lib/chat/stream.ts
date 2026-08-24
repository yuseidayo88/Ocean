import { chatReply } from '@/app/actions/chat';

/**
 * 統括AIの返事を**流しながら**受け取る（→ `app/api/chat/route.ts`）。
 *
 * 画面が2つある（チャットの画面と、どの画面からでも開く右ペイン）ので、
 * **受け取り方は1か所**にまとめる。分けて書くと、片方だけ直る。
 *
 * **流す道が使えなかったときは、流さない道に落ちる**（`chatReply`）。
 * 返事が出ないよりは、まとめて1回で出るほうがいい。
 *
 * 返すのは「うまくいかなかった理由」だけ。うまくいったら null。
 * 本文は `onText` に、届いたぶんだけ渡す。
 */
export async function streamReply(threadId: string, onText: (chunk: string) => void): Promise<string | null> {
  let fail: string | null = null;
  let reached = false;        // 流す道が本当に応えたか（応えなければ落とす）
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
    const reader = res.ok ? res.body?.getReader() : undefined;
    if (reader) {
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const rows = buf.split('\n');
        buf = rows.pop() ?? '';          // 最後の1行は途中かもしれないので残す
        for (const row of rows) {
          if (!row.trim()) continue;
          try {
            const m = JSON.parse(row) as { t?: string; done?: boolean; err?: string };
            if (m.t) { reached = true; onText(m.t); }
            if (m.done) reached = true;
            if (m.err) { reached = true; fail = m.err; }
          } catch { /* 壊れた行は捨てる */ }
        }
      }
    }
  } catch { /* 下で落とす */ }

  if (reached) return fail;

  // 流す道が使えなかった。**黙って終わらせない** — まとめて1回で取りに行く
  const r = await chatReply(threadId);
  return r.ok ? null : r.message;
}
