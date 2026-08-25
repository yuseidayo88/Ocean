// 目で見るための1枚。**中身が出るまで待つ**（ホームは開いてからデータを取りに行く）
import { WebSocket } from 'ws';
import { writeFileSync } from 'fs';
const PORT = process.argv[2], W = Number(process.argv[3]), H = Number(process.argv[4]);
const url = process.argv[5], out = process.argv[6], want = process.argv[7] ?? '';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const waits = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await new Promise((r) => ws.on('open', r));
ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && waits.has(d.id)) { waits.get(d.id)(d.result); waits.delete(d.id); } });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.enable'); await send('Runtime.enable');
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.value;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 600));
  const b = (await ev('document.body.innerText')) ?? '';
  if (want ? b.includes(want) : b.length > 200) break;
}
await new Promise((r) => setTimeout(r, 700));
writeFileSync(out, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
console.log('ok', out);
