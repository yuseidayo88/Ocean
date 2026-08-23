// 承認の道を1本通す（Phase 6）。
//   ゴールを書く → 計画が出る → 承認する → Work が動きだしている
// DEMO_MODE の保存先はメモリなので、走らせるたびに新しい Work ができる。
import { WebSocket } from 'ws';

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const GOAL = '韓国人向けの日本語学習サービスを立ち上げたい';

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
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${saw}`}`); if (!pass) bad++; };

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① ゴールを書いて送る
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2500);
await ev(`(() => { const t = document.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(GOAL)});
  t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await wait(4000);

const plan = await ev('location.pathname');
ok('ゴールを書くと計画の画面へ行く', /^\/work\/[^/]+\/plan$/.test(plan), plan);
ok('承認して始める が押せる', await ev(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('承認して始める'))`));

// ② 根拠のペインに、その計画と関係のない前提が残っていないか
await ev(`[...document.querySelectorAll('button')].find(b => b.title === '右を開く')?.click()`); await wait(700);
const why = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('根拠のペインが開く', why.includes('なぜこの順番か'), why.slice(0, 40));
ok('ダミーの前提が残っていない', !why.includes('韓国の日本語学習者'));
await ev(`document.querySelector('aside button')?.click()`); await wait(400);

// ③ 承認する
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(4000);
const work = await ev('location.pathname');
ok('承認したら Work の画面へ行く', work === plan.replace(/\/plan$/, ''), work);

const body = await text();
ok('タイトルとゴールが出ている', body.includes(GOAL));
ok('フェーズが 1 / N になっている', /フェーズ\n1 \/ [2-9]/.test(body), body.match(/フェーズ\n[^\n]*/)?.[0]);
ok('進捗は 0%（走らせるのは Phase 7）', body.includes('進捗\n0%'));
ok('タスクが待機で並んでいる', (body.match(/待機/g) ?? []).length >= 1);
ok('無い成果物を作っていない', body.includes('まだありません'));

// ④ 右ペイン
await ev(`[...document.querySelectorAll('button')].find(b => b.title === '右を開く')?.click()`); await wait(700);
const pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
ok('右ペインに AI社員 が出る', pane.includes('AI社員') && /\dタスク/.test(pane), pane.slice(0, 40));
ok('決めたことは空状態', pane.includes('まだありません'));

// ⑤ 承認したあと、計画は押せない
await send('Page.navigate', { url: BASE + plan }); await wait(2500);
ok('計画は承認済になる', (await text()).includes('承認済'));
ok('二度は押せない', !(await ev(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('承認して始める'))`)));

// ⑥ 無い Work
await send('Page.navigate', { url: `${BASE}/work/w-nope-nope` }); await wait(2500);
ok('無い id は行き先なし', (await text()).includes('この行き先はありません'));

ok('コンソールにエラーが出ていない', errs.length === 0, errs.join(' / '));
console.log(bad ? `\n${bad}件` : '\nぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
process.exit(bad ? 1 : 0);
