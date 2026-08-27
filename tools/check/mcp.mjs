// つないだ道具（MCP・Phase 12）を1本通す。
//   つなぐ → 道具が名乗られる → 読むだけ / 書ける → AI社員が本当に呼ぶ → 成果物に入る
//
// 相手は `tools/mcp-test/server.mjs`（この repo の中）。
// **他所のサーバーの調子で検査が赤くなるのは検査ではない**ので、話す相手はこちらに置く。
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const MCP = Number(process.env.MCP_PORT ?? 3999);

const srv = spawn(process.execPath, ['tools/mcp-test/server.mjs', String(MCP)], { stdio: 'ignore' });
const bye = () => { try { srv.kill(); } catch { /* もう死んでいる */ } };

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
let bad = 0;
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 90)}`}`); if (!pass) bad++; };
const go = async (path) => { await send('Page.navigate', { url: `${BASE}${path}` }); await wait(1600); };
/** 押せるものは `<button>` とは限らない（行は `pressable()` で role="button"） */
const hit = async (re, root = 'document') => ev(`(() => {
  const xs = [...${root}.querySelectorAll('button, [role="button"]')];
  const b = xs.find((x) => ${re}.test(x.innerText ?? ''));
  if (!b) return false; b.click(); return true; })()`);
const type = async (sel, v) => ev(`(() => { const t = document.querySelectorAll('input')[${sel}];
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(t, ${JSON.stringify(v)});
  t.dispatchEvent(new Event('input', { bubbles: true })); })()`);

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① つなぐ（名前・行き先・鍵なし）
await go('/tools');
ok('まだ何もつないでいない', (await text()).includes('まだありません'));
await type(0, 'テストの在庫');
await type(1, `http://localhost:${MCP}/mcp`);
await wait(200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('つないで確かめる'))?.click()`);
const done = await until((b) => b.includes('道具 2') || b.includes('つなげ'), 20, 700);
ok('つなぐと、相手が名乗った道具の数が出る', done.includes('道具 2'), done.match(/道具 [^\n]*/)?.[0] ?? done.slice(0, 80));

// ② 1件を開く — **書く道具は、許すまで沈んでいる**
ok('一覧の行が開ける', await hit('/テストの在庫/'));
// **道具の一覧が届くまで待つ。** 見出し（この先の道具）は先に出るので、それでは早すぎる
const pane = await until((b) => b.includes('list_items'), 20, 600);
ok('相手が名乗っている道具がそのまま並ぶ',
   pane.includes('list_items') && pane.includes('add_item'), pane.slice(0, 80));
ok('書く道具には「書く」の印がある', pane.includes('書く'));
const dim = await ev(`(() => {
  const el = [...document.querySelectorAll('aside div')].find(d => d.innerText?.startsWith('add_item'));
  return el ? getComputedStyle(el).opacity : 'なし'; })()`);
ok('許すまで、書く道具は沈んでいる', Number(dim) < 0.6, dim);

// ③ 書けるようにする → 沈まなくなる
await ev(`[...document.querySelectorAll('aside button')].filter(b => b.getAttribute('role') === 'switch' || b.getAttribute('aria-label')?.includes('書ける'))[0]?.click()`);
await wait(900);
const dim2 = await ev(`(() => {
  const el = [...document.querySelectorAll('aside div')].find(d => d.innerText?.startsWith('add_item'));
  return el ? getComputedStyle(el).opacity : 'なし'; })()`);
ok('許すと、書く道具も渡るようになる', Number(dim2) > 0.9, dim2);
await go('/tools');
ok('「書ける」は読み直しても残る', (await text()).includes('書ける'));

// ④ AI社員が本当に呼ぶ — ゴールを書いて Work を作り、成果物に相手の返事が入る
await go('/start');
await ev(`(() => { const t = document.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, '在庫を整理して売れ筋を出したい');
  t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await until((b) => b.includes('この Work を作る') || b.includes('計画を見る'), 30);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('この Work を作る'))?.click()`);
await until((b) => b.includes('承認して始める'), 40);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('承認して始める'))?.click()`);
await until((b) => b.includes('フェーズ'), 30);

// 成果物に相手の返事が入り、歩みに「呼んだ」が残る
await until((b) => b.includes('要確認'), 60);
ok('成果物ができた', (await text()).includes('要確認'));
await hit('/要確認/');
const body = await until((b) => b.includes('つないだ道具から読んだもの') || b.includes('在庫:'), 20, 700);
ok('読んだものが成果物に入っている', body.includes('在庫:'), body.match(/在庫:[^\n]*/)?.[0] ?? body.slice(0, 90));
// 歩みは**タスクの行**を開くと読める（呼んだことが記録に残っているか）
await go('/tasks?done=1');
// 押してから開くまでに読み直しが挟まることがあるので、開くまで押し直す
let steps = '';
for (let i = 0; i < 8 && !steps.includes('mcp__'); i++) {
  await hit('/調査担当/');
  await wait(800);
  steps = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
}
ok('つないだ道具を呼んだことが歩みに残る', steps.includes('mcp__'),
   steps.match(/mcp__[^\n]*/)?.[0] ?? steps.slice(0, 90));

// ⑤ 切ると、道具は渡らなくなる
await go('/tools');
await ev(`[...document.querySelectorAll('button')].filter(b => b.getAttribute('aria-label')?.includes('テストの在庫 を使う'))[0]?.click()`);
await wait(900);
await go('/tools');
const off = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label')?.includes('テストの在庫 を使う'));
  return b?.getAttribute('aria-checked') ?? 'なし'; })()`);
ok('切ったことは読み直しても残る', off === 'false', off);

// ⑥ 外す
await ev(`[...document.querySelectorAll('button')].find(b => b.title === '外す')?.click()`);
await wait(900);
await go('/tools');
ok('外すと一覧から消える', (await text()).includes('まだありません'));

console.log('\nerrs:', errs.length ? errs : 'なし');
console.log(bad ? `${bad}件` : 'ぜんぶ通った');
bye();
ws.close();
// **開いたタブは閉じる。** 残すと検査のたびに1枚ずつ増え、
// 何本も動いたままの画面（ポンプ・ホームの読み直し・粒の瞬き）がブラウザを詰まらせる
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
