import { WebSocket } from 'ws';

/**
 * **いちばん下まで送っても、入力欄に隠れて押せないものが無いか。**
 *
 * 入力欄は中身の上に浮いている（`position: absolute`）。重なってよいが、
 * **下に貼り付く中身と行動の行は `COMPOSER_H` ぶん逃がす**（→ CLAUDE.md）。
 * ここを忘れると、いちばん大事なボタンが物理的に押せなくなる
 * （実際 `/work/[id]/plan` の「承認して始める」がそうだった）。
 *
 * やること: 全部いちばん下まで送って、押せる要素の中心を `elementFromPoint` で叩く。
 * 帰ってきたのが入力欄なら、その要素は**隠れている**。
 */

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const W = Number(process.argv[3] || 1440), H = Number(process.argv[4] || 860);

const PAGES = ['/home', '/home?view=desk', '/home?view=progress', '/home?view=flow',
  '/tasks', '/tasks?done=1', '/inbox', '/team', '/deliverables', '/decisions', '/hire', '/skills',
  '/work', '/work/w-japanese', '/work/w-japanese/plan', '/chat/t-price',
  '/start', '/work/new', '/discovery', '/discovery/result', '/diagnosis', '/import'];

const PROBE = `(() => {
  // まず全部いちばん下まで送る
  for (const d of document.querySelectorAll('*')) if (d.scrollHeight > d.clientHeight + 8) d.scrollTop = d.scrollHeight;
  const comp = document.querySelector('textarea')?.closest('div[style*="position: absolute"]')
            ?? document.querySelector('textarea')?.parentElement?.parentElement;
  const hidden = [];
  for (const el of document.querySelectorAll('a[href], button, [role=button], .solid, .btn, .card')) {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) continue;
    if (comp && comp.contains(el)) continue;              // 入力欄そのものは除く
    const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
    const h = document.elementFromPoint(cx, cy);
    if (!h || el === h || el.contains(h) || h.contains(el)) continue;
    if (comp && comp.contains(h)) {                        // 入力欄に隠されている
      hidden.push(((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g,' ').slice(0,30)));
    }
  }
  return hidden;
})()`;

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
await new Promise((r) => ws.on('open', r));
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

let bad = 0;
for (const p of PAGES) {
  await send('Page.navigate', { url: BASE + p });
  await new Promise((r) => setTimeout(r, 2600));
  const hidden = (await send('Runtime.evaluate', { expression: PROBE, returnByValue: true }))?.result?.value ?? [];
  if (hidden.length) { bad++; console.log(`✗ ${p}\n${hidden.map((x) => `    入力欄に隠れて押せない 「${x}」`).join('\n')}`); }
  else console.log(`✓ ${p}`);
}
console.log(bad ? `\n${bad}画面で押せないものがある` : '\nどの画面も、下まで送っても押せなくなるものは無い');
ws.close(); process.exit(0);
