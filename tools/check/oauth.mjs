// MCP の OAuth を1本通す（2026-08-27。社長の「他のやつから順に」の②）。
//   鍵なしで繋ぐ → 断られる → ログインを押す → 相手の認可 → 戻ると入れている
//   → 道具が読める → 鍵が切れても、勝手に取り直して呼べる
//
// 相手は `tools/mcp-test/server.mjs --oauth`（この repo の中）。
// **他所のサーバーの調子で検査が赤くなるのは検査ではない**ので、話す相手はこちらに置く。
// 出す鍵は**60秒で切れる**ので、更新の道もこの1本で通る。
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const MCP = Number(process.env.MCP_PORT ?? 3998);

const srv = spawn(process.execPath, ['tools/mcp-test/server.mjs', String(MCP), '--oauth'], { stdio: 'ignore' });
const bye = () => { try { srv.kill(); } catch { /* もう死んでいる */ } };

/**
 * **自分で立てた相手と話していることを確かめる。**
 * 口がふさがっていると `spawn` は黙って死に、**前の検査が残したサーバー**が
 * 代わりに返事をする（実際そうなって、鍵の要らないはずの相手が 401 を返した）。
 * 立ち上がるまで待ち、名乗りが違えば**そこで止める**。
 */
const speaks = async (port, want) => {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    }).catch(() => null);
    if (r) return r.status === (want === 'oauth' ? 401 : 200);
    await new Promise((z) => setTimeout(z, 300));
  }
  return false;
};
if (!await speaks(MCP, 'oauth')) {
  console.log(`✗ ${MCP} 番の口で、OAuth を話す相手が立たなかった（ふさがっている？）`);
  bye(); process.exit(1);
}

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => {
  const i = ++id; pend.set(i, r);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
  setTimeout(() => { if (pend.delete(i)) r(undefined); }, 20000);
});
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
const pane = async () => (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
const until = async (test, tries = 25, step = 700) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
const untilPane = async (test, tries = 25, step = 700) => {
  for (let i = 0; i < tries; i++) { const b = await pane(); if (test(b)) return b; await wait(step); }
  return await pane();
};
let bad = 0;
const ok = (name, pass, saw = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 110)}`}`);
  if (!pass) bad++;
};
const go = async (path) => { await send('Page.navigate', { url: `${BASE}${path}` }); await wait(2200); };
/**
 * **描けたことと、動くようになったことは別。** サーバーが返した文字は
 * すぐ読めるが、押せるようになるのは組み上がってから — 押して開くまで押し直す。
 */
const open = async (name) => {
  for (let i = 0; i < 12; i++) {
    await hit(`/${name}/`);
    await wait(700);
    // **開いた1件が、押した1件かを確かめる。** 前のペインが残っていると、
    // 押せていないのに開いているように見える（そのまま押すと別の先にログインしにいく）
    const b = await pane();
    if (b.includes(name)) return b;
  }
  return await pane();
};
const hit = async (re, root = 'document') => ev(`(() => {
  const xs = [...${root}.querySelectorAll('button, [role="button"]')];
  const b = xs.find((x) => ${re}.test(x.innerText ?? ''));
  if (!b) return false; b.click(); return true; })()`);
const type = async (i, v) => ev(`(() => { const t = document.querySelectorAll('input')[${i}];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(t, ${JSON.stringify(v)});
  t.dispatchEvent(new Event('input', { bubbles: true })); })()`);

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/**
 * ① **鍵なしで繋ぐと、断られる。** ここが道の始まり —
 *    相手は 401 で「入口はここだ」と教えてくる（RFC 9728）。
 *    **繋がらないものを繋がったことにしない。**
 */
await go('/tools');
await type(0, 'ログインの要る先');
await type(1, `http://localhost:${MCP}/mcp`);
await wait(200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('つないで確かめる'))?.click()`);
const first = await until((b) => /鍵が通りませんでした|道具 \d/.test(b), 20, 700);
ok('鍵なしでは繋がらない（相手が断る）', first.includes('鍵が通りませんでした'), first.slice(0, 90));

/* ② 1件を開くと、入り方と「ログイン」が出る */
ok('一覧の行が開ける', await hit('/ログインの要る先/'));
const p0 = await untilPane((b) => b.includes('ログイン'), 15, 500);
ok('まだ鍵は無いと出る', p0.includes('鍵なし'), p0.slice(0, 80));
ok('鍵を貼らずに入る道がある', p0.includes('相手にログインして入る'), p0.slice(0, 120));

/**
 * ③ **押すと相手の認可へ行って、戻ってくると入れている。**
 *    間で本当に起きること — 素性を読む → その場で客として登録する（RFC 7591）→
 *    PKCE つきで認可 → 符号を引き換える。**verifier が合わないと相手が通さない**。
 */
await ev(`[...document.querySelectorAll('aside a')].find(a => a.innerText.trim() === 'ログイン')?.click()`);
const backed = await until((b) => b.includes('ログイン済') || /うまくいきません|ログインできません|安全な入り方|許可されません/.test(b), 25, 700);
ok('認可から戻ると「ログイン済」と出る', backed.includes('ログイン済'), backed.slice(0, 140));

/** **合図は1回読んだら URL から消す**（読み直しのたびに同じ一言を出さない） */
let href = '';
for (let i = 0; i < 12; i++) {
  href = await ev('location.pathname + location.search');
  if (href === '/tools') break;
  await wait(600);
}
ok('戻ってきた合図は URL に残らない', href === '/tools', href);

/* ④ 入れたので、道具が読める（鍵は画面には返らない） */
await open('ログインの要る先');
const p1 = await untilPane((b) => b.includes('list_items') || b.includes('いまは読めませんでした'), 20, 700);
ok('入れたので、相手の道具が読める', p1.includes('list_items') && p1.includes('add_item'), p1.slice(0, 100));
ok('入り方が「ログイン済」と出る', p1.includes('ログイン済'), p1.slice(0, 80));
ok('鍵の中身は画面に返らない', !/at_[0-9a-f-]{8}/.test(p1) && !/rt_[0-9a-f-]{8}/.test(p1), p1.slice(0, 80));

/**
 * ⑤ **鍵が切れても、呼ぶ直前に取り直す。**
 *    この相手が出す鍵は60秒で切れる。`tokenFor` は切れる前から取り直すので、
 *    ここは**毎回 refresh を通っている** — 通っていなければ 401 に戻る。
 */
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('もう一度確かめる'))?.click()`);
const p2 = await untilPane((b) => /道具 \d|鍵が通りませんでした/.test(b), 20, 700);
ok('切れた鍵は勝手に取り直される', p2.includes('道具 2'), p2.match(/道具 [^\n]*|鍵が[^\n]*/)?.[0] ?? p2.slice(0, 80));

/* ⑥ 入っていることは読み直しても残る */
await go('/tools');
await open('ログインの要る先');
const p3 = await untilPane((b) => b.includes('ログイン済') || b.includes('鍵なし'), 15, 500);
ok('入っていることは読み直しても残る', p3.includes('ログイン済'), p3.slice(0, 80));

/**
 * ⑦ **要らない認可を踏ませない。** OAuth を求めていない相手に「ログイン」を押すと、
 *    そう言って戻る（白い画面にも、意味の無い認可にも送らない）。
 */
const plain = spawn(process.execPath, ['tools/mcp-test/server.mjs', String(MCP + 1)], { stdio: 'ignore' });
ok(`${MCP + 1} 番に、鍵の要らない相手が立った`, await speaks(MCP + 1, 'plain'));
await go('/tools');
await type(0, '鍵の要らない先');
await type(1, `http://localhost:${MCP + 1}/mcp`);
await wait(200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('つないで確かめる'))?.click()`);
await until((b) => b.includes('道具 2'), 15, 600);
const p4 = await open('鍵の要らない先');
ok('鍵の要らない先が開ける', p4.includes('鍵の要らない先'), p4.slice(0, 80));
await ev(`[...document.querySelectorAll('aside a')].find(a => a.innerText.trim() === 'ログイン')?.click()`);
const noauth = await until((b) => /ログインを求めていません|ログイン済|うまくいきません/.test(b), 20, 700);
ok('求めていない相手には、そう言って戻す', noauth.includes('ログインを求めていません'), noauth.slice(0, 120));
try { plain.kill(); } catch { /* もう死んでいる */ }

console.log('\nerrs:', errs.length ? errs.slice(0, 4) : 'なし');
console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
bye();
ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
