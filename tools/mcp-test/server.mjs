/**
 * **検査のための MCP サーバー**（2026-08-25）。
 *
 * OneFound は MCP の **client の側**なので、確かめるには話す相手が要る。
 * この環境から外には出られないし、出られたとしても
 * **他所のサーバーの調子で検査が赤くなるのは検査ではない**。
 *
 * だから相手をこちらに置く。話し方は本物と同じ（Streamable HTTP ＋ JSON-RPC 2.0）で、
 * 道具は2つ — **読むだけのものと、書くもの**。
 * 書くほうがあるからこそ「社長が許すまで渡さない」が確かめられる。
 *
 *   node tools/mcp-test/server.mjs 3999 [鍵]
 */

import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const port = Number(process.argv[2] ?? 3999);
const key = process.argv[3] ?? '';
/**
 * **OAuth を話す相手**（2026-08-27。社長の「他のやつから順に」の②）。
 *
 *   node tools/mcp-test/server.mjs 3999 --oauth
 *
 * 本物の MCP サーバーと同じ順で返す — 401 で入口を教える（RFC 9728）→
 * サーバーの素性（RFC 8414）→ その場で客として登録（RFC 7591）→
 * PKCE つきの認可 → 引き換え。**外に出られない環境で、この道を通すために置く。**
 */
const oauth = process.argv.includes('--oauth');
const base = () => `http://127.0.0.1:${port}`;
/** 発行したもの。検査のあいだだけ覚えていればいい */
const clients = new Map();      // client_id → { redirect_uris }
const codes = new Map();        // code → { challenge, clientId, redirect }
const tokens = new Map();       // access_token → { exp }
const refresh = new Map();      // refresh_token → clientId
const s256 = (v) => createHash('sha256').update(v).digest('base64url');
const issue = (clientId) => {
  const at = `at_${randomUUID()}`;
  const rt = `rt_${randomUUID()}`;
  tokens.set(at, { exp: Date.now() + 60_000 });   // **1分で切れる** — 更新の道も検査する
  refresh.set(rt, clientId);
  return { access_token: at, refresh_token: rt, token_type: 'Bearer', expires_in: 60 };
};
const json = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

/** 覚えておく中身（書く道具が本当に書けたことを、読む道具で確かめられる） */
const items = ['まくら', 'ざぶとん'];

const TOOLS = [
  {
    name: 'list_items',
    description: '在庫の一覧を返す。引数は要らない',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_item',
    description: '在庫に1つ足す',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    annotations: { readOnlyHint: false },
  },
];

const call = (name, args) => {
  if (name === 'list_items') return { content: [{ type: 'text', text: `在庫: ${items.join(' / ')}` }] };
  if (name === 'add_item') {
    const v = String(args?.name ?? '').trim();
    if (!v) return { content: [{ type: 'text', text: '名前がありません' }], isError: true };
    items.push(v);
    return { content: [{ type: 'text', text: `${v} を足しました（いま ${items.length} 件）` }] };
  }
  return { content: [{ type: 'text', text: `${name} という道具はありません` }], isError: true };
};

createServer((req, res) => {
  const u = new URL(req.url, base());

  /* ══════════════ OAuth（`--oauth` のときだけ）══════════════ */
  if (oauth) {
    // ① 守られているもの、の素性（RFC 9728）。401 のヘッダがここを指す
    if (u.pathname === '/.well-known/oauth-protected-resource'
        || u.pathname === '/.well-known/oauth-protected-resource/mcp') {
      return json(res, 200, { resource: `${base()}/mcp`, authorization_servers: [base()] });
    }
    // ② サーバーの素性（RFC 8414）
    if (u.pathname === '/.well-known/oauth-authorization-server') {
      return json(res, 200, {
        issuer: base(),
        authorization_endpoint: `${base()}/authorize`,
        token_endpoint: `${base()}/token`,
        registration_endpoint: `${base()}/register`,
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        response_types_supported: ['code'],
      });
    }
    // ③ その場で客として登録（RFC 7591）。**鍵は配らない**（PKCE の公開クライアント）
    if (u.pathname === '/register' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => {
        let want = {};
        try { want = JSON.parse(b); } catch { /* 空でも通す */ }
        const id = `cl_${randomUUID()}`;
        clients.set(id, { redirect_uris: want.redirect_uris ?? [] });
        json(res, 201, { client_id: id, redirect_uris: want.redirect_uris ?? [],
                         token_endpoint_auth_method: 'none' });
      });
      return;
    }
    // ④ 認可。検査なので**その場で通す**（本物はここで人が押す）
    if (u.pathname === '/authorize') {
      const cid = u.searchParams.get('client_id');
      const redirect = u.searchParams.get('redirect_uri');
      const state = u.searchParams.get('state');
      const challenge = u.searchParams.get('code_challenge');
      if (!clients.has(cid) || !redirect || !challenge) {
        return json(res, 400, { error: 'invalid_request' });
      }
      const code = `cd_${randomUUID()}`;
      codes.set(code, { challenge, clientId: cid, redirect });
      const back = new URL(redirect);
      back.searchParams.set('code', code);
      if (state) back.searchParams.set('state', state);
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    // ⑤ 引き換え（PKCE を**本当に見る**）と、更新
    if (u.pathname === '/token' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => {
        const f = new URLSearchParams(b);
        if (f.get('grant_type') === 'refresh_token') {
          const cid = refresh.get(f.get('refresh_token'));
          if (!cid) return json(res, 400, { error: 'invalid_grant' });
          return json(res, 200, issue(cid));
        }
        const got = codes.get(f.get('code'));
        if (!got) return json(res, 400, { error: 'invalid_grant' });
        codes.delete(f.get('code'));
        // **verifier が合わないと通さない**（PKCE を飾りにしない）
        if (s256(f.get('code_verifier') ?? '') !== got.challenge) {
          return json(res, 400, { error: 'invalid_grant', error_description: 'PKCE が合いません' });
        }
        return json(res, 200, issue(got.clientId));
      });
      return;
    }
  }

  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  // **OAuth のときは、入口の場所を教えて断る**（RFC 9728。ここが道の始まり）
  if (oauth) {
    const at = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const live = tokens.get(at);
    if (!live || live.exp < Date.now()) {
      res.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate':
          `Bearer resource_metadata="${base()}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' } }));
      return;
    }
  }
  // **鍵を見る**（鍵が通らない道も検査したい）
  if (key && !oauth && req.headers.authorization !== `Bearer ${key}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' } }));
    return;
  }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let msg;
    try { msg = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
    // 合図（id が無いもの）には返事をしない — 本物と同じ
    if (msg.id == null) { res.writeHead(202, { 'mcp-session-id': 'test' }).end(); return; }

    let result;
    if (msg.method === 'initialize') {
      result = { protocolVersion: '2025-06-18', capabilities: { tools: {} },
                 serverInfo: { name: 'OneFound 検査用', version: '1.0.0' } };
    } else if (msg.method === 'tools/list') {
      result = { tools: TOOLS };
    } else if (msg.method === 'tools/call') {
      result = call(msg.params?.name, msg.params?.arguments);
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
                               error: { code: -32601, message: `${msg.method} は知りません` } }));
      return;
    }
    // **返し方は2つとも通す** — tools/call だけ SSE で返して、こちらの読み手を確かめる
    if (msg.method === 'tools/call') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'mcp-session-id': 'test' });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n\n`);
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'test' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
  });
}).listen(port, () => console.log(
  `mcp-test on http://localhost:${port}/mcp${oauth ? '（OAuth あり）' : ''}`));
