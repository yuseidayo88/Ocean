import { WebSocket } from 'ws';

/**
 * **押しても何も起きないもの**を数える。
 * 押せる顔をしている要素を全部押して、URL も画面の中身も変わらなければ「死んでいる」。
 *
 * CLAUDE.md:「押せないものを押せる顔にしない」。
 * Phase 4 は書き込みが届かないので死んでいて当然のものもあるが、
 * **どれがどれだけあるか**を知らずに「使いにくい」を直せない。
 */

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const W = 1440, H = 860;

const PAGES = ['/home', '/home?view=desk', '/home?view=progress', '/home?view=flow',
  '/tasks', '/inbox', '/team', '/deliverables', '/decisions', '/hire', '/skills',
  '/work', '/work/w-japanese', '/work/w-japanese/plan', '/chat/t-price', '/start', '/work/new'];

/** 押せる顔をしているもの。中の子は数えない（親が押せるなら1つ） */
const LIST = `(() => {
  const seen = new Set(), out = [];
  const cands = [...document.querySelectorAll('a[href], button, [role=button], [role=option], [role=switch], .row, .btn, .solid, .icob, .card, .lnk, .hit')];
  for (const el of cands) {
    if (cands.some((o) => o !== el && o.contains(el))) continue;   // 親が押せるなら子は数えない
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
    // **本当にそこを押せるか。** 親が幅0で切り取っていると、子は大きさを持っていても押せない
    const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit))) continue;
    // 戻る・進むは履歴が要る。まっさらな状態で押しても何も起きないのは正しい
    const ttl = el.getAttribute('title');
    if (ttl === '戻る' || ttl === '進む') continue;
    let label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 34);
    if (!label) label = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
      + (el.closest('nav') ? '@レール' : el.closest('header') ? '@トップバー' : el.closest('aside') ? '@右ペイン' : '@中央');
    const key = label + '@' + Math.round(r.x) + ',' + Math.round(r.y);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ label, href: el.getAttribute('href') || '', x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  }
  return out;
})()`;

const STATE = `location.pathname + location.search + '|' + document.body.innerText.length + '|' + document.querySelectorAll('*').length + '|' + (document.querySelector('aside') ? 1 : 0)`;

const conn = async (url) => {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { ws, send, id: t.id };
};

let deadAll = 0, liveAll = 0;
for (const path of PAGES) {
  const { ws, send } = await conn(BASE + path);
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.value;
  const go = async () => { await send('Page.navigate', { url: BASE + path }); await new Promise((r) => setTimeout(r, 2600)); };
  await go();
  const items = await ev(LIST);
  const dead = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.href && !it.href.startsWith('#')) { liveAll++; continue; }   // <a href> は行き先がある
    const before = await ev(STATE);
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x: it.x, y: it.y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 320));
    const after = await ev(STATE);
    if (before === after) { dead.push(it.label); deadAll++; } else { liveAll++; await go(); }
  }
  console.log(`${path}  押せる ${items.length} / 死 ${dead.length}`);
  for (const d of dead) console.log(`    ✗ ${d}`);
  ws.close();
}
console.log(`\n合計: 生 ${liveAll} / 死 ${deadAll}`);
process.exit(0);
