import type { McpResult, McpTool } from './types';

/**
 * **MCP を話す**（client の側）。2026-08-25。
 *
 * ライブラリは入れない。MCP の「Streamable HTTP」は
 * **JSON-RPC 2.0 を POST するだけ**で、返事は JSON か SSE のどちらか。
 * それだけなら `fetch` で足りるし、workerd に載るかを確かめる手間も要らない。
 *
 * 使う手順は3つ:
 *   1. `initialize` … 名乗って、`Mcp-Session-Id` を受け取る
 *   2. `notifications/initialized` … 返事の要らない合図
 *   3. `tools/list` / `tools/call`
 *
 * **倒れない。** 相手は他人のサーバーなので、落ちていても遅くても当たり前 —
 * 失敗は例外ではなく**文字**で返して、社員にも社長にも読ませる。
 */

const VERSION = '2025-06-18';
const CLIENT = { name: 'OneFound', version: '1.0.0' };

/** 待つ上限。**相手を待って会社を止めない** */
const OPEN_MS = 15_000;
const CALL_MS = 45_000;

type Rpc = { id?: number; method: string; params?: unknown };

/**
 * 行き先を確かめる。**本番は https だけ** —
 * `http://` を許すと、鍵が平文で相手まで飛ぶ。
 *
 * localhost だけは**デモと検査**のために通す（`DEMO_MODE`）。
 * **`NODE_ENV` では分けられない** — `next start` は検査のときも production なので、
 * そこで切ると「検査のためだけに本番の判定を緩める」ことになる。
 * デモは保存先がメモリの、ログイン無しの見せ物なので、ここが緩くても失うものが無い。
 */
export function badUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return 'URL の形になっていません'; }
  if (u.protocol === 'https:') return null;
  if (u.protocol === 'http:'
      && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)
      && process.env.DEMO_MODE === '1') return null;
  return 'https:// で始まる行き先にしてください';
}

/** SSE の返事から、最初の JSON-RPC を1つ取り出す */
function fromSse(body: string): unknown {
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    try {
      const v = JSON.parse(t.slice(5).trim());
      if (v && typeof v === 'object' && ('result' in v || 'error' in v)) return v;
    } catch { /* 次の data: を見る */ }
  }
  return null;
}

type Conn = { url: string; token?: string; session?: string };

async function rpc(c: Conn, msg: Rpc, ms: number): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(c.url, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'content-type': 'application/json',
        // **両方受ける**と名乗る（相手がどちらで返してもいい、が MCP の決まり）
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': VERSION,
        ...(c.token ? { authorization: `Bearer ${c.token}` } : {}),
        ...(c.session ? { 'mcp-session-id': c.session } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', ...msg }),
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) c.session = sid;
    if (msg.id == null) return null;                    // 合図には返事が来ない
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 160)}`);
    const ct = res.headers.get('content-type') ?? '';
    const v = ct.includes('text/event-stream') ? fromSse(text) : JSON.parse(text);
    if (!v) throw new Error('返事が読めませんでした');
    const err = (v as { error?: { message?: string } }).error;
    if (err) throw new Error(err.message ?? 'エラーが返りました');
    return (v as { result?: unknown }).result;
  } finally {
    clearTimeout(t);
  }
}

/** 名乗って、道具の一覧をもらう。**繋がらなければ理由を返す** */
export async function listTools(server: { id: string; name: string; url: string; token?: string })
  : Promise<{ ok: true; tools: McpTool[] } | { ok: false; error: string }> {
  const bad = badUrl(server.url);
  if (bad) return { ok: false, error: bad };
  const c: Conn = { url: server.url, token: server.token };
  try {
    await rpc(c, {
      id: 1, method: 'initialize',
      params: { protocolVersion: VERSION, capabilities: {}, clientInfo: CLIENT },
    }, OPEN_MS);
    await rpc(c, { method: 'notifications/initialized' }, OPEN_MS);
    const out = await rpc(c, { id: 2, method: 'tools/list' }, OPEN_MS) as
      { tools?: { name: string; description?: string; inputSchema?: Record<string, unknown>;
                  annotations?: { readOnlyHint?: boolean } }[] };
    const tools = (out?.tools ?? []).map((t) => ({
      serverId: server.id, serverName: server.name,
      name: t.name,
      description: (t.description ?? '').slice(0, 400),
      schema: t.inputSchema ?? { type: 'object', properties: {} },
      readOnly: t.annotations?.readOnlyHint === true,
    }));
    return { ok: true, tools };
  } catch (e) {
    return { ok: false, error: say(e) };
  }
}

/** 道具を1つ呼ぶ。**返すのは文字**（社員が読んで、次の一手を決める） */
export async function callTool(
  server: { url: string; token?: string }, name: string, args: Record<string, unknown>,
): Promise<McpResult> {
  const bad = badUrl(server.url);
  if (bad) return { ok: false, error: bad };
  const c: Conn = { url: server.url, token: server.token };
  try {
    await rpc(c, {
      id: 1, method: 'initialize',
      params: { protocolVersion: VERSION, capabilities: {}, clientInfo: CLIENT },
    }, OPEN_MS);
    await rpc(c, { method: 'notifications/initialized' }, OPEN_MS);
    const out = await rpc(c, {
      id: 2, method: 'tools/call', params: { name, arguments: args },
    }, CALL_MS) as { content?: { type: string; text?: string }[]; isError?: boolean };

    const text = (out?.content ?? [])
      .map((p) => (p.type === 'text' ? p.text ?? '' : `(${p.type})`))
      .join('\n').trim();
    // **相手が「失敗した」と言ったら、失敗として返す**（成功のふりをしない）
    if (out?.isError) return { ok: false, error: text || '道具がエラーを返しました' };
    return { ok: true, text: text.slice(0, 8000) || '(返事は空でした)' };
  } catch (e) {
    return { ok: false, error: say(e) };
  }
}

/** 例外を、社長にも社員にも読める1行にする */
function say(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/abort/i.test(m)) return '返事がありませんでした（時間切れ）';
  if (/401|403|unauthor|forbidden/i.test(m)) return '鍵が通りませんでした';
  if (/404/.test(m)) return 'その行き先に MCP はありませんでした';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(m)) return '相手に届きませんでした';
  return m.slice(0, 160);
}
