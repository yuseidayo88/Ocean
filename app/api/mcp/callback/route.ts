import { cookies } from 'next/headers';
import { store } from '@/lib/store';
import { exchange } from '@/lib/mcp/oauth';
import { listTools } from '@/lib/mcp/client';

/**
 * **認可から戻ってくるところ**（2026-08-27）。
 *
 * `/api/mcp/start` が置いた cookie（つなぎ先 / PKCE の verifier / state）と
 * 突き合わせてから引き換える。
 *
 * ## 断り方
 *
 * - **`state` が合わなければ引き換えない**（別のところから投げ込まれた符号を受けない）
 * - cookie が無ければ、そこで終わり（時間切れか、別のブラウザ）
 * - 引き換えたら**cookie は捨てる**（一度きり）
 * - **鍵は行って戻らない** — 画面に返すのは「入れた」かどうかだけ
 */

export const dynamic = 'force-dynamic';

const back = (req: Request, q: string) =>
  Response.redirect(new URL(`/tools?${q}`, req.url), 303);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  const raw = jar.get('mcp_oauth')?.value;
  jar.delete('mcp_oauth');                       // **一度きり**

  if (q.get('error')) return back(req, 'e=denied');
  if (!raw) return back(req, 'e=expired');

  let want: { id?: string; v?: string; state?: string } = {};
  try { want = JSON.parse(raw); } catch { return back(req, 'e=expired'); }
  const code = q.get('code');
  if (!want.id || !want.v || !code) return back(req, 'e=expired');
  // **投げ込まれた符号を受けない**
  if (!want.state || q.get('state') !== want.state) return back(req, 'e=state');

  const a = await store().mcpAuth(want.id).catch(() => null);
  if (!a?.clientId || !a.tokenUrl) return back(req, 'e=expired');

  try {
    const got = await exchange({
      tokenUrl: a.tokenUrl, code, verifier: want.v,
      clientId: a.clientId, clientSecret: a.clientSecret,
      redirectUri: `${new URL(req.url).origin}/api/mcp/callback`,
      resource: a.resource ?? '',
    });
    await store().setMcpAuth(want.id, {
      kind: 'oauth', access: got.access, refresh: got.refresh, expiresAt: got.expiresAt,
    });
    /**
     * 入れたので、**その場で本当に確かめる**。
     * 印を消すだけにすると「道具 0」と出る — **数えていないものを 0 と書かない**
     * （不変条件と同じ考え方。押した社長が見るのは、入れたかどうかではなく通ったかどうか）。
     */
    const row = (await store().listMcpServers().catch(() => [])).find((m) => m.id === want.id);
    if (row) {
      const r = await listTools({ id: row.id, name: row.name, url: row.url, token: got.access });
      await store().noteMcpCheck(want.id, r.ok ? { tools: r.tools.length } : { error: r.error })
        .catch(() => {});
    }
    return back(req, 'ok=auth');
  } catch (e) {
    await store().noteMcpCheck(want.id, { error: e instanceof Error ? e.message : String(e) }).catch(() => {});
    return back(req, 'e=token');
  }
}
