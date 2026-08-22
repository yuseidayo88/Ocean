import { WebSocket } from 'ws';
const PORT = process.argv[2], W = Number(process.argv[3]), H = Number(process.argv[4]);

const probe = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => { const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const name = (el) => el.tagName.toLowerCase() +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  const out = { ell: [], scrollx: [], off: [], text: [], pane: 0, docw: document.documentElement.scrollWidth };
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // 「…」で切れている（本当に読めない）
    // .clip は「切れていて正しい」の印（長いコードの行など）
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth
        && !el.classList.contains('clip'))
      out.ell.push({ tag: name(el), full: (el.textContent||'').trim().slice(0,60), lost: el.scrollWidth - el.clientWidth });
    // 横スクロールしないと見えない
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2)
      out.scrollx.push({ tag: name(el), by: el.scrollWidth - el.clientWidth });
    // 画面の外
    if (!el.children.length) {
      const t = (el.textContent||'').trim();
      if (t) {
        out.text.push(t.slice(0, 50));
        if (r.right > vw + 1) out.off.push({ tag: name(el), txt: t.slice(0,40), by: Math.round(r.right - vw), side: '右' });
        if (r.left < -1) out.off.push({ tag: name(el), txt: t.slice(0,40), by: Math.round(-r.left), side: '左' });
      }
    }
  }
  out.pane = document.querySelectorAll('aside').length;
  return out;
})()`;

export async function scan(url) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  await new Promise((res) => ws.on('open', res));
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (d) => { const m = JSON.parse(d);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a=>a.value??a.description??'').join(' ').slice(0,200));
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description||'').slice(0,160));
  });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 3200));
  const res = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
  ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
  return { v: res?.result?.value, errs };
}
