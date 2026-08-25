import { WebSocket } from 'ws';

/**
 * どの画面からでも統括AIと話せるか。
 * 入力欄に書いて Enter → 右ペインが会話になって開き、入力欄はその中へ移る。
 * **入力欄は常に1つ**（増えていないこと）。中身がはみ出していないこと。
 *
 * ただし**入口の画面（`/start`）とチャットの画面は右ペインを出さない** — そこは
 * 会話そのものが主役なので、書くと会話へ入る。空の会社では `/home` が `/start` に
 * 落ちるので、この道も通る。
 */
const PORT = process.argv[2];
const BASE = process.argv[3] ?? process.env.BASE ?? 'http://localhost:3300';
// 既定は SHELL_MIN。これより狭いと器のほうが窓より広くなり、
// 右にあるものが全部「はみ出し」に見える（それは仕様なので、ここで測る幅ではない）
const W = Number(process.argv[4] || 1440), H = Number(process.argv[5] || 800);

const PROBE = `(() => {
  const a = document.querySelector('aside'); if (!a) return null;
  const out = { cut: [], off: [], text: a.innerText.split('\\n').filter(Boolean) };
  for (const el of a.querySelectorAll('*')) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || cs.display === 'none') continue;
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth
        && !el.classList.contains('clip'))
      out.cut.push((el.textContent||'').trim().slice(0,30));
    if (!el.children.length && (el.textContent||'').trim()) {
      if (r.right > innerWidth + 1) out.off.push((el.textContent||'').trim().slice(0,30));
      if (r.bottom > innerHeight + 1) out.off.push('下にはみ出し: ' + (el.textContent||'').trim().slice(0,24));
    }
  }
  out.textarea = document.querySelectorAll('textarea').length;
  out.inPane = !!a.querySelector('textarea');
  return out;
})()`;

for (const path of ['/tasks', '/home', '/team', '/deliverables', '/decisions']) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + path)}`, { method: 'PUT' });
  const t = await r.json(); const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  await new Promise((res) => ws.on('open', res));
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (d) => { const m = JSON.parse(d);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a=>a.value??'').join(' ').slice(0,120)); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + path }); await new Promise((x) => setTimeout(x, 3800));
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;

  const box = await ev(`(()=>{const t=document.querySelector('textarea'); if(!t) return null;
    const b=t.getBoundingClientRect(); return [Math.round(b.x+40), Math.round(b.y+b.height/2)] })()`);
  if (!box) { console.log(`✗ ${path}  入力欄が無い`); ws.close(); continue; }
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 });
  await send('Input.insertText', { text: 'この件、どう進めるのがいいと思う？いまの並びで合ってる？' });
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise((x) => setTimeout(x, 1200));

  const v = await ev(PROBE);
  const at = (await ev('location.pathname')) ?? '';
  /**
   * **入口の画面は、右ペインではなく会話そのものを開く**（そういう決めごと）。
   * 空の会社では `/home` が `/start` に落ちるので、ここを通る。
   * 「どの画面からでも統括AIと話せる」は満たしている — 器が違うだけ。
   */
  const chatScreen = path.startsWith('/chat') || at.startsWith('/chat');
  const L = [];
  if (chatScreen) {
    if (v) L.push('  チャット画面なのに右ペインが出た');
    else if (!(await ev('document.body.innerText')).includes('この件、どう進める'))
      L.push('  会話に書いたものが出ていない');
  } else if (!v) {
    L.push('  右ペインが出ない');
  } else {
    if (v.textarea !== 1) L.push(`  入力欄が ${v.textarea} 個ある（1つのはず）`);
    if (!v.inPane) L.push('  入力欄がペインの中に移っていない');
    if (!v.text.some((x) => x.includes('この件、どう進める'))) L.push('  書いたものが出ていない');
    // **返事が速いときは「考えています」を通り過ぎている。** どちらかが出ていればいい
    if (!v.text.some((x) => x.includes('考えています') || x.includes('仮の返事')))
      L.push(`  統括AIが応じていない（${v.text.slice(-2).join(' / ')}）`);
    for (const c of v.cut) L.push(`  …で切れ 「${c}」`);
    for (const o of v.off.slice(0, 4)) L.push(`  はみ出し 「${o}」`);
  }
  for (const e of errs.slice(0, 2)) L.push('  ERR ' + e);
  console.log(L.length ? `✗ ${path}\n${L.join('\n')}` : `✓ ${path}`);
  ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
}
process.exit(0);
