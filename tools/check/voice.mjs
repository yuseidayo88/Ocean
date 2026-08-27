// 声の道を1本通す（2026-08-27。社長の「他のやつから順に」の④）。
//   栓を入れる → チャットで「ナレーションを作りたい」→ 計画 → 承認 →
//   執筆担当が**台本で終わる**（本番の壊れ方）→ 頼み直して**音声が出る**→
//   画面で聞ける → 落とせる → 台本も読める
// 決め打ちのプロバイダは 0.1秒の無音 WAV を返す（`lib/ai/voice.ts` の FAKE_WAV）。
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
const pane = async () => (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
let bad = 0;
const ok = (name, pass, saw = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 100)}`}`);
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

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ① 栓を入れる。**既定はオフ**なので、押すまで道具は渡らない */
await send('Page.navigate', { url: `${BASE}/team?open=all` }); await wait(2600);
const pane0 = await pane();
ok('「声を出す」が全員に効くことにある',
   pane0.includes('声を出す') && pane0.includes('ナレーションを音声で出す'), pane0.slice(0, 90));
ok('既定はオフ（モデルの一覧も出していない）', !pane0.includes('Gemini 3.1 Flash TTS'), pane0.slice(0, 60));
await ev(`document.querySelector('aside [role=switch][aria-label="声を出す"]')?.click()`);
await wait(1400);
const pane1 = await pane();
ok('入れるとモデルを選べる（Gemini / Grok Voice）',
   pane1.includes('Gemini 3.1 Flash TTS') && pane1.includes('Grok Voice'), pane1.slice(-100));
/**
 * **読み直しても残るか。** 画面は押した瞬間に先に変わる（保存ボタンを置かない作法）ので、
 * **押した直後の見た目は、保存できたことの証明にならない** —
 * 実際、`prefSet` が `voice` を捨てていて、画面だけ入っているように見えた。
 */
await send('Page.navigate', { url: `${BASE}/team?open=all` }); await wait(2600);
ok('入れたことは読み直しても残る',
   (await ev(`document.querySelector('aside [role=switch][aria-label="声を出す"]')?.getAttribute('aria-checked')`)) === 'true',
   (await pane()).slice(0, 80));

/* ② チャット → 計画 → 承認 */
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await say('紹介動画のナレーションを作りたい', 3000);
await until((b) => b.includes('この Work を作る'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
const plan = await until((b) => b.includes('承認して始める'), 20, 800);
ok('計画が執筆担当を採る', plan.includes('執筆担当'), plan.match(/担当[^\n]*/)?.[0] ?? '(いない)');
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3000);

/**
 * ③ 音声が出るまで待つ。**1回目は台本で終わる**（本番の壊れ方）ので、
 *    ここを通るということは頼み直しが動いている。
 */
await until((b) => /要確認/.test(b), 60, 1500);
await send('Page.navigate', { url: `${BASE}/deliverables` }); await wait(2400);
let opened = false;
for (let i = 0; i < 40 && !opened; i++) {
  opened = await ev(`(() => {
    const xs = [...document.querySelectorAll('[data-state="要確認"]')];
    const c = xs.find((x) => (x.innerText ?? '').includes('音声'));
    if (!c) return false; c.click(); return true; })()`) === true;
  if (!opened) { await wait(1500); await send('Page.navigate', { url: `${BASE}/deliverables` }); await wait(1600); }
}
ok('音声が成果物として出た（台本で終わらず、頼み直して読み上げた）', opened, (await text()).slice(0, 90));

/* ④ 画面 — その場で聞ける・台本も読める・落とせる */
const p2 = await pane();
ok('ペインで聞ける（再生の口がある）', await ev(`!!document.querySelector('aside audio')`), p2.slice(0, 70));
ok('読み上げた台本も読める', p2.includes('はじめての一歩'), p2.slice(0, 110));
ok('落とす口がある（.mp3）',
   await ev(`[...document.querySelectorAll('aside button')].some(b => (b.title ?? '').endsWith('.mp3'))`),
   await ev(`[...document.querySelectorAll('aside button')].map(b => b.title).join(' / ')`));
// **音は紙にならない。** PDF の口は出さない（図と同じ）
ok('PDF の口は出さない（音は紙にならない）',
   !(await ev(`[...document.querySelectorAll('aside button')].some(b => b.innerText === 'PDF')`)));

/**
 * ⑤ サムネイルは**台本の書き出し**（聞く前に中身が分かる）。
 *    `src` があるからと `<img>` に渡すと、mp3 が壊れた絵になる
 */
ok('サムネイルは台本（壊れた絵にしない）',
   await ev(`(() => {
     const c = [...document.querySelectorAll('[data-state="要確認"]')]
       .find((x) => (x.innerText ?? '').includes('音声'));
     return !!c && !c.querySelector('img'); })()`));

/* ⑥ 台帳 — 声のぶんも数えている */
await send('Page.navigate', { url: `${BASE}/billing` }); await wait(2400);
const bill = await text();
ok('使ったぶんが台帳に出ている', /トークン|使った/.test(bill), bill.slice(0, 80));

console.log('\nerrs:', errs.length ? errs.slice(0, 4) : 'なし');
console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
