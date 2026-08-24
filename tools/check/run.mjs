// 実行の道を1本通す（Phase 7〜9）。
//   承認 → タスクが順に走る → 判断で止まる → 決める → 決定が次の実行に効く
//   → フェーズ review → 承認/差し戻し → 次のフェーズのタスクを統括AIが引く
// DEMO_MODE の保存先はメモリ。モデルは決め打ち（FakeProvider）だが、
// **本物と同じ道具・同じ順**なので、通り道の穴はこれで見つかる。
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
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
let bad = 0;
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 90)}`}`); if (!pass) bad++; };

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

// ② タスク1〜2が走る（歩みが読める）→ タスク3は判断で止まる
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
  if (b.includes('決める')) break;
}
ok('進捗が 0% から動いた', sawProgress);
ok('実行の最中に歩みが読めた', sawFlow);
const stopped = await until((b) => b.includes('決める'));
ok('判断で止まった（◆ 決める）', stopped.includes('決める'), stopped.slice(0, 60));

// ③ 判断に答える → 決定が次の実行に入って、タスクが最後まで走る
await ev(`[...document.querySelectorAll('button')].find(x => x.className.includes('row') && x.innerText.includes('決める'))?.click()`);
await wait(800);
const dpane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('聞かれていることが右ペインに出る', dpane.includes('対象の絞り込み') && dpane.includes('推奨'), dpane.slice(0, 60));
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('K-POPファン層'))?.click()`);
await wait(1000);
// 決めたことが文脈に入らないと fake は完走しない — 完走そのものが受け渡しの証拠
const gate1 = await until((b) => b.includes('フェーズ「調査」が終わりました'), 40);
ok('決定が次の実行に渡って、フェーズが終わった', gate1.includes('フェーズ「調査」が終わりました'), gate1.slice(0, 80));

// ④ 成果物: 1つ承認、1つ差し戻し → 直しタスクが走って、また review に戻る
await ev(`[...document.querySelectorAll('button')].find(b => b.className.includes('row') && b.innerText.includes('競合'))?.click()`);
await wait(700);
let pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('成果物の本文と承認の口', pane.includes('承認して受け取る'), pane.slice(0, 50));
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '承認して受け取る')?.click()`);
await wait(1000);
ok('承認すると 承認済', ((await ev(`document.querySelector('aside')?.innerText ?? ''`))).includes('承認済'));
await ev(`document.querySelector('aside button')?.click()`); await wait(300);

await ev(`[...document.querySelectorAll('button')].filter(b => b.className.includes('row') && /市場/.test(b.innerText))[0]?.click()`);
await wait(700);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '直してほしい')?.click()`);
await wait(400);
await ev(`(() => { const t = document.querySelector('aside textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, '出典を1行ずつ付けてほしい');
  t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await wait(200);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '差し戻す')?.click()`);
await wait(1200);
ok('差し戻すと 差し戻し済', ((await ev(`document.querySelector('aside')?.innerText ?? ''`))).includes('差し戻し'));
await ev(`document.querySelector('aside button')?.click()`); await wait(300);
const gate2 = await until((b) => b.includes('フェーズ「調査」が終わりました'), 40);
ok('直しが走って、また review に戻った', gate2.includes('フェーズ「調査」が終わりました'), gate2.slice(0, 80));

// ⑤ フェーズを承認 → 統括AIが次のタスクを引いて、戦略フェーズが動きだす
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('次のフェーズへ進める'))?.click()`);
const next = await until((b) => b.includes('収益モデル'), 30);
ok('次のフェーズのタスクが引かれた', next.includes('収益モデル'), next.slice(0, 80));
ok('フェーズが 2 に進んだ', /フェーズ\n2 \/ /.test(next), next.match(/フェーズ\n[^\n]*/)?.[0]);
const done2 = await until((b) => b.includes('フェーズ「戦略」が終わりました'), 40);
ok('戦略フェーズも走って終わった', done2.includes('フェーズ「戦略」が終わりました'), done2.slice(0, 80));

// ⑤' 学びの輪（note_learning → 社員のメモ → 設定ペイン）と標準スキル
await send('Page.navigate', { url: `${BASE}/team` }); await wait(2200);
const team = await text();
ok('承認で採用した社員がメンバーに並ぶ', team.includes('調査担当'), team.slice(0, 80));
await ev(`[...document.querySelectorAll('.row')].find(r => r.innerText.includes('調査担当'))?.click()`);
const paneB = await until((b) => b.includes('学び'), 10, 800);
ok('社員の学びが設定ペインに残った', paneB.includes('数字は事実・推計・要確認の3束に分けてから出す'), paneB.slice(0, 120));

await send('Page.navigate', { url: `${BASE}/skills` }); await wait(2200);
const sk = await text();
ok('標準スキルが見えている', sk.includes('標準') && sk.includes('調査のまとめ方'), sk.slice(0, 80));
ok('スキルが実行で読まれた（used_count）', /\d+回/.test(sk), sk.match(/[^\n]*回[^\n]*/)?.[0]);

// ⑥ 埋まった状態のレイアウト。ダミーを消したので、**ここでしか測れない**
//    （ホーム4ビューは Work が動いてはじめて絵になる）
const { scan } = await import('./_probe.mjs');
const SWEEP = ['/home', '/home?view=desk', '/home?view=progress', '/home?view=flow',
               '/tasks', '/team', '/deliverables', '/decisions', '/inbox'];
let cut = 0;
for (const u of SWEEP) {
  const r = await scan(`${BASE}${u}`);
  const x = r.v;
  const n = x ? x.ell.length + x.scrollx.length + x.off.length : 1;
  if (n) {
    cut += n;
    const first = x ? (x.ell[0]?.full ?? x.off[0]?.txt ?? x.scrollx[0]?.tag ?? '') : '取得できず';
    console.log(`  レイアウト ${u}: ${n}件  ${String(first).slice(0, 60)}`);
  }
}
ok('埋まった状態のレイアウト（9画面）', cut === 0, `${cut}件`);

console.log('\nerrs:', errs.length ? errs.slice(0, 3) : 'なし');
console.log(bad ? `${bad}件` : 'ぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
process.exit(bad ? 1 : 0);
