// **画面を開くのに何往復しているか**を数える。
//   使い方: node tools/check/net.mjs <debug-port> <path...>
// 「遅い」は感想だが、往復の数は数えられる。減らせば必ず速くなる。
import { WebSocket } from 'ws';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const PATHS = process.argv.slice(3);
if (!PATHS.length) PATHS.push('/home', '/tasks', '/chat/new');

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

/** ページ本体でも静止ファイルでもない = サーバーへの問い合わせ（アクション・API） */
let calls = [];
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent') {
    const r = m.params.request;
    if (/\/_next\/static|\.(png|jpg|svg|woff2?|ico)$/.test(r.url)) return;
    calls.push({ url: r.url.replace(BASE, ''), how: r.method, rsc: !!r.headers?.RSC || !!r.headers?.['Next-Action'] });
  }
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Network.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

for (const path of PATHS) {
  calls = [];
  const t0 = Date.now();
  await send('Page.navigate', { url: `${BASE}${path}` });
  await wait(3000);
  const posts = calls.filter((c) => c.how === 'POST');
  console.log(`${path}  問い合わせ ${calls.length}本（うちサーバーアクション ${posts.length}本） ${Date.now() - t0}ms`);
  for (const c of calls) console.log(`   ${c.how} ${c.url.slice(0, 70)}`);
}

ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
