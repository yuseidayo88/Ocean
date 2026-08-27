import { WebSocket } from 'ws';

/**
 * 入口の3つの姿を1つずつ押す（2026-08-25）。
 *   ログイン → 新規登録 → パスワードを忘れた → ログイン、と回れるか。
 *   **弱いパスワードでは送れない**か（決まりが緑になるまで灰色のまま）。
 *   リンクを踏んでいない `/auth/reset` が、正直に「決められません」と言うか。
 *
 * ここは**押しても外に出ない**ところだけを見る（本当にアカウントは作らない）。
 * 実際に入れるかどうかは、鍵と受信箱が要るので機械では確かめられない。
 */
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value ?? '').join(' ').slice(0, 140));
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 140));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => (await ev('document.body.innerText')) ?? '';
let bad = 0;
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 100)}`}`); if (!pass) bad++; };
/** 文字で押す（この画面のボタンは全部ラベルで見分けられる） */
const click = async (label) => ev(`[...document.querySelectorAll('button,a')].find(b => b.innerText.trim() === ${JSON.stringify(label)})?.click()`);
/** 入力欄に打つ（React に届く形で） */
const type = async (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
/** 送るボタンが青いか（＝押せる顔をしているか） */
const sendable = async () => ev(`(() => { const b = document.querySelector('button[type=submit]');
  return b ? !b.disabled && getComputedStyle(b).backgroundColor === 'rgb(26, 115, 232)' : null })()`);

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① ログインの姿
await send('Page.navigate', { url: `${BASE}/login` }); await wait(2200);
const l = await text();
ok('ログインの姿（Google ＋ メールとパスワード）',
   l.includes('Google で続ける') && l.includes('ログイン') && l.includes('パスワードを忘れた') && l.includes('新規登録'),
   l.replace(/\n/g, ' | ').slice(0, 110));
ok('何も書いていないうちは送れない', (await sendable()) === false);

// ② 新規登録へ移る。**画面は変わるが、サーバーには行かない**
await click('新規登録'); await wait(500);
ok('新規登録の姿に移る（URL にも残る）',
   (await text()).includes('あなたの会社を作ります') && (await ev('location.search')) === '?mode=signup',
   await ev('location.search'));
const rules = await text();
ok('パスワードの決まりが出ている',
   ['10文字以上', '大文字', '小文字', '数字', '記号'].every((w) => rules.includes(w)), rules.slice(-120));

// ③ 弱いパスワードでは送れない
await type('input[type=email]', 'founder@example.com');
await type('input[type=password]', 'password'); await wait(300);
ok('弱いパスワードでは送れない', (await sendable()) === false);
const met = async () => ev(`[...document.querySelectorAll('span')].filter(s => getComputedStyle(s).color === 'rgb(91, 185, 116)' && /文字|大文字|小文字|数字|記号/.test(s.innerText)).length`);
ok('満たしたところだけ緑になる', (await met()) === 1, `緑 ${await met()} 個`);

// ④ 決まりを満たすと押せる顔になる
await type('input[type=password]', 'Founder#2026x'); await wait(300);
ok('決まりを満たすと押せる顔になる', (await sendable()) === true);
ok('決まりが5つとも緑になる', (await met()) === 5, `緑 ${await met()} 個`);

// ⑤ 表示 → 隠す
await click('表示'); await wait(200);
ok('打った文字を確かめられる', (await ev(`document.querySelectorAll('input[type=text]').length`)) >= 1);
await click('隠す'); await wait(200);

// ⑥ 忘れたときの姿。**ここだけ Google を出さない**
await click('ログイン'); await wait(400);
await click('パスワードを忘れた'); await wait(400);
const f = await text();
ok('忘れたときの姿（Google もパスワードも出さない）',
   f.includes('パスワードを再設定します') && !f.includes('Google で続ける')
   && (await ev(`document.querySelectorAll('input[type=password]').length`)) === 0,
   f.replace(/\n/g, ' | ').slice(0, 110));
await click('ログインに戻る'); await wait(400);
ok('ログインに戻れる', (await text()).includes('一人社長のための') && (await ev('location.search')) === '');

// ⑦ リンクを踏んでいない再設定
await send('Page.navigate', { url: `${BASE}/auth/reset` }); await wait(2000);
const r = await text();
ok('リンク無しの再設定は、正直に断る',
   r.includes('このリンクからは決められません') && r.includes('もう一度リンクを送る'), r.replace(/\n/g, ' | ').slice(0, 110));

console.log(errs.length ? `\nerrs: ${errs.slice(0, 3).join(' / ')}` : '\nerrs: なし');
console.log(bad ? `${bad}件 直すところがある` : 'ぜんぶ通った');
// **開いたタブは閉じる。** 残すと検査のたびに1枚ずつ増え、
// 何本も動いたままの画面（ポンプ・ホームの読み直し・粒の瞬き）がブラウザを詰まらせる
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
