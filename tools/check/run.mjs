// 実行の道を1本通す（Phase 7）。
//   承認 → Work 画面を開いたまま → タスクが順に走る → 成果物が並ぶ
// DEMO_MODE の保存先はメモリ。モデルは決め打ち（FakeProvider）だが、
// **本物と同じ4道具・同じ順**なので、通り道の穴はこれで見つかる。
import { WebSocket } from 'ws';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const errs = [];
await new Promise((r) => ws.on('open', r));
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = () => ev('document.body.innerText');
let bad = 0;
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 80)}`}`); if (!pass) bad++; };

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① ゴール → 計画 → 承認
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2500);
await ev(`(() => { const t = document.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, '韓国人向けの日本語学習サービスを立ち上げたい');
  t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await wait(4000);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3500);
ok('承認して Work に着いた', /\/work\/[^/]+$/.test(await ev('location.pathname')), await ev('location.pathname'));

// ② 開いたまま待つ — ポンプが順にタスクを走らせる（fake は1タスク約4秒 × 3）。
//    状態の文字は出ない（タイトル前のアイコンで言う設計）ので、
//    **実行の最中にタスクの行を開いて、歩みが流れていること**で確かめる
let sawProgress = false, sawFlow = false;
for (let i = 0; i < 40; i++) {
  await wait(1200);
  const b = await text();
  if (/[1-9]\d?%/.test(b)) sawProgress = true;
  if (sawProgress && !sawFlow) {
    await ev(`[...document.querySelectorAll('button')].find(x => x.className.includes('row') && /フェーズ1/.test(x.innerText))?.click()`);
    await wait(600);
    const pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
    if (/段取り|集めて|振り分け/.test(pane)) sawFlow = true;
    await ev(`document.querySelector('aside button')?.click()`); await wait(300);
  }
  if (b.includes('タスクが終わりました')) break;
}
ok('進捗が 0% から動いた', sawProgress);
ok('実行の最中に歩みが読めた', sawFlow);

const done = await text();
ok('全タスクが終わった', done.includes('タスクが終わりました') || done.includes('3/3'), done.match(/\d\/\d/)?.[0]);
ok('成果物が並んだ', done.includes('成果物') && !done.includes('まだありません。AI社員が出したら'), '');
ok('進捗の帯が 100%', done.includes('100%'));

// ③ 成果物を押すと右ペインに本文 ＋ 社長のレビューの口（Phase 8）
await ev(`[...document.querySelectorAll('button')].find(b => b.className.includes('row') && b.innerText.includes('競合'))?.click()`);
await wait(800);
let pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('成果物の本文が右ペインに出る', pane.includes('決め打ちの成果物') || pane.includes('分かったこと'), pane.slice(0, 60));
ok('承認と差し戻しの口がある', pane.includes('承認して受け取る') && pane.includes('直してほしい'));

// ④ 承認する → 承認済
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '承認して受け取る')?.click()`);
await wait(1200);
pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('承認すると 承認済 になる', pane.includes('承認済'), pane.slice(-60));
await ev(`document.querySelector('aside button')?.click()`); await wait(400);

// ⑤ 別の成果物を差し戻す → 直しタスクが走って、新しい成果物が出る
await ev(`[...document.querySelectorAll('button')].filter(b => b.className.includes('row') && /市場|対象/.test(b.innerText))[0]?.click()`);
await wait(700);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '直してほしい')?.click()`);
await wait(400);
await ev(`(() => { const t = document.querySelector('aside textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, '出典を1行ずつ付けてほしい');
  t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await wait(200);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '差し戻す')?.click()`);
await wait(1500);
ok('差し戻すと 差し戻し済 と出る', ((await ev(`document.querySelector('aside')?.innerText ?? ''`))).includes('差し戻し'), '');
await ev(`document.querySelector('aside button')?.click()`); await wait(300);

// 直しタスクが（開いたまま）走り終わるのを待つ
let fixed = false;
for (let i = 0; i < 30; i++) {
  await wait(1500);
  const b = await text();
  if (b.includes('を直す') === false && /タスクが終わりました|判断/.test(b)) { fixed = true; break; }
  if (b.includes('を直す') && b.includes('100%')) { fixed = true; break; }
}
const after = await text();
ok('直しタスクが積まれて走った', fixed || after.includes('を直す'), after.slice(0, 80));

// ⑥ 直しも含めて全部終わると、最新の状況が「終わった」と言う
//    （フェーズ→review の遷移と判断待ち通知は closePhaseIfDone の中。
//     supabase 側の書き込みは SQL の探針、memory 側はこの lead で見える）
let allDone = false;
for (let i = 0; i < 30; i++) {
  await wait(1500);
  if ((await text()).includes('タスクが終わりました')) { allDone = true; break; }
}
await ev(`history.replaceState(null,'',location.pathname+'?open=about'); window.dispatchEvent(new PopStateEvent('popstate'))`);
await wait(600);
const about = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('全部終わると「終わった」と言う', allDone || about.includes('終わりました'), about.slice(0, 60));
await ev(`document.querySelector('aside button')?.click()`); await wait(300);
await ev(`history.replaceState(null,'',location.pathname); window.dispatchEvent(new PopStateEvent('popstate'))`);
await wait(300);
console.log('\nerrs:', errs.length ? errs.slice(0, 3) : 'なし');
console.log(bad ? `${bad}件` : 'ぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
process.exit(bad ? 1 : 0);
