import { cookies } from 'next/headers';
import { store } from '@/lib/store';
import { authorizeUrl, challenge, discover, register, verifier } from '@/lib/mcp/oauth';

/**
 * **相手の認可へ送り出す**（2026-08-27。社長の「他のやつから順に」の②）。
 *
 * ここまで、つなぐには**鍵を手で貼る**しかなかった。
 * Notion や GitHub の鍵を自分で作れる社長はまずいないので、
 * 「MCP は入っている」と言いながら**実際には誰も使えなかった**。
 *
 * ## 途中の控えは cookie に置く（表を増やさない）
 *
 * 認可のあいだ覚えておくのは3つだけ — どのつなぎ先か / PKCE の verifier / state。
 * **数分しか要らないもののために表を作らない。** `httpOnly` なので中身は画面から読めず、
 * `sameSite=lax` は**戻ってくる遷移で cookie が付く**ために要る。
 *
 * ## 断り方
 *
 * - **`?id=` を信じない** — その会社のつなぎ先でなければ、そこで終わり（RLS が返さない）
 * - 相手が OAuth を求めていなければ、そう言って戻す（**要らない認可を踏ませない**）
 * - 行き先はぜんぶ `blockedWhy` を通る（→ `lib/mcp/oauth.ts`）
 */

export const dynamic = 'force-dynamic';

/** 途中の控えの寿命。**踏まれなかったものを残さない** */
const PENDING_S = 600;

const back = (req: Request, q: string) =>
  Response.redirect(new URL(`/tools?${q}`, req.url), 303);

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return back(req, 'e=noid');

  const server = (await store().listMcpServers().catch(() => []))
    .find((m) => m.id === id);
  if (!server) return back(req, 'e=notfound');

  try {
    const found = await discover(server.url);
    // **要らない認可を踏ませない。** 鍵が要らない相手はそのまま繋がる
    if (!found) return back(req, 'e=noauth');
    if (!found.as.s256) return back(req, 'e=nopkce');

    // 客としての登録は**1回だけ**（すでに取ってあるなら使い回す）
    const had = await store().mcpAuth(id);
    let clientId = had?.clientId;
    let clientSecret = had?.clientSecret;
    if (!clientId) {
      const origin = new URL(req.url).origin;
      const got = await register(found.as, `${origin}/api/mcp/callback`);
      clientId = got.clientId;
      clientSecret = got.clientSecret;
    }

    const v = verifier();
    const state = verifier().slice(0, 32);
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/mcp/callback`;

    await store().setMcpAuth(id, {
      kind: 'oauth', clientId, clientSecret,
      tokenUrl: found.as.token, resource: found.resource,
    });

    const jar = await cookies();
    jar.set('mcp_oauth', JSON.stringify({ id, v, state }), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: PENDING_S,
      secure: new URL(req.url).protocol === 'https:',
    });

    return Response.redirect(authorizeUrl({
      as: found.as, clientId, redirectUri,
      challenge: await challenge(v), state, resource: found.resource,
    }), 303);
  } catch (e) {
    // **理由を捨てない**（黙って一覧に戻さない → 入口の `?e=` と同じ作法）
    await store().noteMcpCheck(id, { error: e instanceof Error ? e.message : String(e) }).catch(() => {});
    return back(req, 'e=auth_failed');
  }
}
