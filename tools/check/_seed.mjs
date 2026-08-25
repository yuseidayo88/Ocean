// 目で見るためだけの種まき。ゴールを2つ書いて、計画を承認するところまで。
import { WebSocket } from 'ws';
const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const GOALS = process.argv.slice(3);
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
for (const goal of GOALS) {
  await send('Page.navigate', { url: `${BASE}/start` }); await wait(2000);
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(goal)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until((b) => b.includes('この Work を作る') || b.includes('計画を見る'), 30);
  await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('この Work を作る'))?.click()`);
  await until((b) => b.includes('承認して始める'), 40);
  await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('承認して始める'))?.click()`);
  await until((b) => b.includes('フェーズ'), 30);
  console.log('seeded:', goal);
}
ws.close(); process.exit(0);
