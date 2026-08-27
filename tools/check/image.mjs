// 絵の道を1本通す（2026-08-27。社長の「ロゴ作る時は GPT の AI 使うようにしようかな」）。
//   栓を入れる → チャットで「ロゴを作りたい」→ 計画 → 承認 →
//   デザイン担当が**説明で終わる**（本番の壊れ方）→ 頼み直して**絵が出る**→
//   画面に絵が出る → 落とせる → 差し戻すと v2
// 決め打ちのプロバイダは 256×256 の PNG を返す（`lib/ai/image.ts` の FAKE_PNG）。
import { WebSocket } from 'ws';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => {
  const i = ++id; pend.set(i, r);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
  setTimeout(() => { if (pend.delete(i)) r(undefined); }, 15000);
});
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
let bad = 0;
const ok = (name, pass, saw = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 90)}`}`);
  if (!pass) bad++;
};
const say = async (msg, after = 1500) => {
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(msg)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(after);
};
const CARDS = `[...document.querySelectorAll('[role="button"]')].filter((x) => /card/.test(x.className))`;

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ① 栓を入れる。**既定はオフ**なので、押すまで道具は渡らない */
await send('Page.navigate', { url: `${BASE}/team?open=all` }); await wait(2600);
const pane0 = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('「絵を描く」が全員に効くことにある', pane0.includes('絵を描く') && pane0.includes('ロゴやバナーを画像で出す'),
   pane0.slice(0, 80));
ok('既定はオフ（モデルの一覧も出していない）', !pane0.includes('Nano Banana'), pane0.slice(0, 60));
await ev(`document.querySelector('aside [role=switch][aria-label="絵を描く"]')?.click()`);
await wait(1400);
const pane1 = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('入れるとモデルを選べる（Nano Banana / GPT Image）',
   pane1.includes('Nano Banana') && pane1.includes('GPT Image'), pane1.slice(-90));

/* ② チャット → 計画 → 承認 */
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await say('近所のパン屋のロゴを作りたい', 3000);
await until((b) => b.includes('この Work を作る'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
const plan = await until((b) => b.includes('承認して始める'), 20, 800);
ok('計画がデザイン担当を採る', plan.includes('デザイン担当'),
   plan.match(/デザイン担当[^\n]*/)?.[0] ?? '(いない)');
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3000);

/* ③ 絵が出るまで待つ。**1回目は説明で終わる**（本番の壊れ方）ので、頼み直しが動く */
const img = `${CARDS}.find((x) => x.querySelector('img'))`;
let got = false;
for (let i = 0; i < 60 && !got; i++) { got = !!(await ev(`!!(${img})`)); if (!got) await wait(1500); }
ok('絵が成果物として出た（説明で終わらず、頼み直して描いた）', got, (await text()).slice(0, 90));

/* ④ 画面 — サムネイルが絵、ペインでも絵、落とせる */
ok('サムネイルが絵そのもの（灰色の棒でも文字でもない）',
   await ev(`(${img})?.querySelector('img')?.currentSrc?.startsWith('data:image/png') ?? false`));
await ev(`(${img})?.click()`); await wait(1200);
const pane = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('ペインに絵が出る', await ev(`!!document.querySelector('aside img')`), pane.slice(0, 60));
ok('何を狙った絵かも読める', pane.includes('麦の穂') || pane.includes('（仮）'), pane.slice(0, 90));
ok('落とす口がある（.png）',
   await ev(`[...document.querySelectorAll('aside button')].some(b => (b.title ?? '').endsWith('.png'))`),
   await ev(`[...document.querySelectorAll('aside button')].map(b => b.title).join(' / ')`));

/* ⑤ 差し戻すと v2 になる（版の輪が絵でも回る） */
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '直してほしい')?.click()`);
await wait(500);
await ev(`(() => { const t = document.querySelector('aside textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'もっと丸くしてほしい');
  t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await wait(200);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '差し戻す')?.click()`);
const fixed = await until((b) => /v2/.test(b), 60, 1500);
ok('直した絵が v2 で戻ってくる', /v2/.test(fixed), fixed.match(/[^\n]*v2[^\n]*/)?.[0] ?? '(戻っていない)');

/* ⑥ 台帳 — 絵のトークンも数えている（社長の「画像生成した時のトークンも計算してほしい」） */
await send('Page.navigate', { url: `${BASE}/billing` }); await wait(2400);
const bill = await text();
ok('使ったぶんが台帳に出ている', /トークン|使った/.test(bill), bill.slice(0, 80));

console.log('\nerrs:', errs.length ? errs.slice(0, 4) : 'なし');
console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
