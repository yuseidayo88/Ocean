// 通しで歩く（チャット → Work → 完了）。**止まるところと、終わり方を見る**
import { WebSocket } from 'ws';
const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3400';
/** 社長の一言。**引数で渡せる**（簡単な例で 0 → 完了 まで歩けるか見るため） */
const GOAL = process.argv.slice(3).join(' ') || '韓国人向けの日本語学習サービスを立ち上げたい';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.on('message', (d) => { const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160));
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
const until = async (test, tries = 40, step = 1200) => { for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); } return await text(); };
const say = async (msg, after = 1500) => {
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(msg)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(after);
};
const shot = async (name) => {
  const d = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync(`/tmp/walk-${name}.png`, Buffer.from(d.data, 'base64'));
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① チャットから Work を作る
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await say(GOAL, 3000);
const chatUrl = await ev('location.href');
await until((b) => b.includes('この Work を作る'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
await until((b) => b.includes('承認して始める'), 20, 800);
console.log('--- 計画の画面 ---');
console.log((await text()).replace(/^[\s\S]*?計画\n/, '計画\n').slice(0, 900));
await shot('plan');
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3000);
const workUrl = await ev('location.href');
console.log('work =', workUrl);

// ② 完了するまで回す。止まったら答える／進める
let step = 0;
for (let i = 0; i < 260; i++) {
  await wait(1500);
  const b = await text();
  if (/完了|終わりました。おつかれ|この Work は終わりました/.test(b) && /Work[\s\S]{0,60}完了/.test(b)) { /* あとで確かめる */ }
  // 判断待ち
  if (b.includes('決める')) {
    let pane = '';
    for (let k = 0; k < 8 && !pane.includes('推奨'); k++) {
      await ev(`[...document.querySelectorAll('button')].find(x => x.className.includes('row') && x.innerText.includes('決める'))?.click()`);
      await wait(700);
      pane = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
    }
    if (pane.includes('推奨')) {
      console.log(`--- 判断 ${++step} ---\n` + pane.slice(0, 300));
      await shot(`decide-${step}`);
      await ev(`[...document.querySelectorAll('aside button')].find(x => /推奨/.test(x.innerText))?.click()`);
      await wait(1500);
      await ev(`document.querySelector('aside button')?.click()`);
      continue;
    }
  }
  // フェーズの ◆（計画で約束した問い）。帯の中で決める
  if (b.includes('決めて、次に進めてください')) {
    console.log(`--- ◆ 判断 ${++step} ---\n` + (b.match(/決めて、次に進めてください[\s\S]{0,260}/)?.[0] ?? ''));
    await shot(`gate-${step}`);
    await ev(`[...document.querySelectorAll('button')].find(x => /推奨/.test(x.innerText))?.click()`);
    await wait(2500);
    continue;
  }
  // フェーズの承認
  if (b.includes('次のフェーズへ進める')) {
    console.log(`--- フェーズ承認 ${++step} ---\n` + (b.match(/フェーズ「[^」]*」[^\n]*/)?.[0] ?? ''));
    await shot(`phase-${step}`);
    await ev(`[...document.querySelectorAll('button')].find(x => x.innerText.includes('次のフェーズへ進める'))?.click()`);
    await wait(3000);
    continue;
  }
  // 終わったか
  const st = await ev(`document.body.innerText.match(/フェーズ\\n(\\d+) \\/ (\\d+)/)?.[0] ?? ''`);
  if (/この Work は終わりました|Work を終えました|完了しました/.test(b)) break;
  if (i % 20 === 0) console.log(`… ${i} ${st.replace(/\n/g, ' ')}`);
}

console.log('\n=== 終わったあとの Work 画面 ===');
await send('Page.navigate', { url: workUrl }); await wait(3000);
console.log((await text()).slice(0, 1600));
await shot('work-done');

// 会話に「終わりました」の報告が入ったか（1チャット = 1 Work）
await send('Page.navigate', { url: chatUrl }); await wait(3000);
console.log('\n=== 会話（終わりの報告）===');
console.log((await text()).split('あなたの会社')[1]?.slice(0, 1200) ?? '');
await shot('chat-done');

for (const [name, url] of [['home', '/home'], ['dels', '/deliverables'], ['decisions', '/decisions'], ['inbox', '/inbox'], ['tasks', '/tasks']]) {
  await send('Page.navigate', { url: BASE + url }); await wait(2600);
  console.log(`\n=== ${url} ===`);
  console.log((await text()).slice(0, 900));
  await shot(name);
}
console.log('\nerrs:', errs.length ? errs.slice(0, 6) : 'なし');
process.exit(0);
