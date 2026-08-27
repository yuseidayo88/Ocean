// URL を読む道を1本通す（2026-08-27。社長の「他のやつから順に」の①）。
//   栓を入れる → 社員に read_url が渡る → 読んでから書く（往復する）
//   ＋ 社長が貼った URL は、栓に関係なく本当に読まれる（取り込み）
// 行き先の断り方そのものは `npx tsx tools/check/safe.ts`（ブラウザ不要）。
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
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 110)}`}`);
  if (!pass) bad++;
};
const say = async (msg, after = 1800) => {
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(msg)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(after);
};

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/**
 * ① **社長が貼った URL は、栓に関係なく読まれる**（材料を渡されただけ）。
 *    読ませる先はこのアプリ自身の `/login`（`DEMO_MODE` のときだけ localhost を通す）。
 */
const SELF = `${BASE.replace('localhost', '127.0.0.1')}/login`;
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await say(`すでに事業があります`, 2600);
await say(`サイトは ${SELF} です。月の売上は 480,000 円くらい`, 4000);
const diag = await until((b) => /診断|見つかったこと|事業/.test(b), 25, 900);
ok('取り込みが動いた', /診断|見つかったこと|事業/.test(diag), diag.slice(0, 90));

// 取り込んだものの中身が「待機」で終わっていない
const src = await ev(`(async () => {
  const r = await fetch('/api/health'); return r.ok; })()`);
ok('器は生きている', src !== false);

/**
 * ② **社員に read_url が渡る**のは、Web を見る の栓を入れたときだけ。
 *    入れる前は道具が無いので、往復もしない。
 */
await send('Page.navigate', { url: `${BASE}/team?open=all` }); await wait(2600);
const pane0 = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('「Web を見る」が全員に効くことにある', pane0.includes('Web を見る'), pane0.slice(0, 70));
await ev(`document.querySelector('aside [role=switch][aria-label="Web を見る"]')?.click()`);
await wait(1500);
const pane1 = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('入れると「調べてから答える」になる', pane1.includes('出どころを書ける'), pane1.slice(0, 110));

/* ③ 新しい Work を1本走らせて、読んでから書いているか見る */
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
// **URL は書かない。** 決め打ちのプロバイダは URL を見ると取り込みの道に入る
// （社長が材料を渡した、と読む）。ここで見たいのは**社員が自分で読む**ほう
await say('ホームページの直すところを出したい', 3200);
await until((b) => b.includes('この Work を作る'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
await until((b) => b.includes('承認して始める'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3000);

const ran = await until((b) => /要確認/.test(b), 60, 1500);
ok('読んでから成果物を書いた（往復した）', /要確認/.test(ran), ran.slice(0, 90));

// 歩みに「開いた」が残る（読めたかどうかに関わらず、**やったことは残す**）。
// **済んだタスクを開く** — 待機の行には歩みがまだ無い
await ev(`document.querySelector('[data-state="完了"]')?.click()`); await wait(1600);
const steps = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('歩みに「開いた」が残る', /開く|中身を確かめる/.test(steps), steps.slice(0, 140));

/**
 * ④ **読めなかったものは、読めなかったと成果物に残る**（黙って空にしない）。
 *    この環境は外に出られないので、たいてい「読めませんでした」が入る —
 *    **それが正しい**（読んだつもりで書かせない）。
 */
await send('Page.navigate', { url: `${BASE}/deliverables` }); await wait(2600);
await ev(`document.querySelector('[data-state="要確認"]')?.click()`); await wait(1600);
const body = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) ?? '';
ok('読んだもの（か、読めなかったこと）が成果物に入る',
   /読んだもの/.test(body) && /(読めませんでした|https?:\/\/)/.test(body), body.slice(0, 160));

console.log('\nerrs:', errs.length ? errs.slice(0, 4) : 'なし');
console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
