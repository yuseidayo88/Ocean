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

const port = Number(process.argv[2] ?? 3999);
const key = process.argv[3] ?? '';

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
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  // **鍵を見る**（鍵が通らない道も検査したい）
  if (key && req.headers.authorization !== `Bearer ${key}`) {
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
}).listen(port, () => console.log(`mcp-test on http://localhost:${port}/mcp`));
