// 公開する道を1本通す（2026-08-27。社長の「他のやつから順に」の③）。
//   LP を作る → 承認する前は出せない → 承認 → 公開 → /p/<slug> が本当に開く
//   → script は落ちている → 下げると 404 → もう一度出すと同じ URL
//
// **出し先はこのアプリ自身**なので、外の業者の鍵が無くても最後まで通る。
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
  setTimeout(() => { if (pend.delete(i)) r(undefined); }, 20000);
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
const until = async (test, tries = 60, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
const untilPane = async (test, tries = 25, step = 700) => {
  for (let i = 0; i < tries; i++) { const b = await pane(); if (test(b)) return b; await wait(step); }
  return await pane();
};
let bad = 0;
const ok = (name, pass, saw = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 120)}`}`);
  if (!pass) bad++;
};
const go = async (path) => { await send('Page.navigate', { url: `${BASE}${path}` }); await wait(2200); };
const hit = async (re, root = 'document') => ev(`(() => {
  const xs = [...${root}.querySelectorAll('button, [role="button"]')];
  const b = xs.find((x) => ${re}.test(x.innerText ?? ''));
  if (!b) return false; b.click(); return true; })()`);
const say = async (msg, after = 2200) => {
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(msg)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(after);
};

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ① LP を1枚つくる */
await go('/start');
await say('サービスの LP を1枚つくりたい', 3200);
await until((b) => b.includes('この Work を作る'), 25, 900);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('この Work を作る'))?.click()`);
await until((b) => b.includes('承認して始める'), 30, 900);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('承認して始める'))?.click()`);
const made = await until((b) => /要確認/.test(b), 60, 1500);
ok('LP の成果物ができた', /要確認/.test(made), made.slice(0, 80));

/**
 * ② 承認する前は出せない — 節ごと出ない（押せないボタンを置かない）。
 *
 * **開くのは「ページ」の成果物**（一覧には報告も表も並ぶ）。
 * 形は行に出ているので、そこで選ぶ — 題は Work ごとに変わるので当てにしない。
 */
await go('/deliverables');
// **待ってから開く。** 1本目のタスクは報告で、LP は次の1本 —
// 最初の「要確認」で数え始めると、まだ書かれていないものを探すことになる
let opened = false;
for (let i = 0; i < 40 && !opened; i++) {
  opened = await ev(`(() => {
    const xs = [...document.querySelectorAll('[data-state="要確認"]')];
    const c = xs.find((x) => (x.innerText ?? '').includes('ページ'));
    if (!c) return false; c.click(); return true; })()`) === true;
  if (!opened) { await wait(1500); await go('/deliverables'); }
}
ok('ページの成果物がある', opened, '（一覧に「ページ」が無い）');
const p0 = await untilPane((b) => b.trim().length > 20, 20, 600);
ok('見ていないものは公開できない（節ごと無い）', !p0.includes('公開する'), p0.slice(0, 110));

/* ③ 承認すると「公開する」が出る */
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('承認して受け取る'))?.click()`);
const p1 = await untilPane((b) => b.includes('公開する') || b.includes('承認済'), 25, 700);
ok('承認すると公開できる', p1.includes('公開する'), p1.slice(0, 110));

/* ④ 一度だけ確かめてから出す（外に出るものは Approval 必須） */
await hit('/^公開する$/', 'document.querySelector("aside")');
const p2 = await untilPane((b) => b.includes('外の人が URL で読めます'), 15, 500);
ok('押すと、何が起きるかを先に言う', p2.includes('外の人が URL で読めます'), p2.slice(0, 110));
await hit('/^公開する$/', 'document.querySelector("aside")');
const p3 = await untilPane((b) => /\/p\/[a-z0-9-]+/.test(b), 20, 700);
const slug = /\/p\/([a-z0-9-]+)/.exec(p3)?.[1] ?? '';
ok('URL がひとつできた', !!slug, p3.slice(0, 110));
ok('落としたものを言う（黙って中身を変えない）',
   p3.includes('落としました'), p3.match(/[^\n]*落としました[^\n]*/)?.[0] ?? p3.slice(0, 110));

/* ⑤ その URL が本当に開く。**script は落ちている** */
const got = await fetch(`${BASE}/p/${slug}`);
const html = await got.text();
ok('公開したページが開く（ログイン無しで）', got.status === 200, String(got.status));
ok('LP の中身が出ている', html.includes('はじめての一歩'), html.slice(0, 90));
ok('script は落ちている', !/<script/i.test(html), (/<script[\s\S]{0,40}/i.exec(html) ?? [''])[0]);
ok('onclick も落ちている', !/onclick/i.test(html), (/onclick[\s\S]{0,30}/i.exec(html) ?? [''])[0]);
ok('落とし漏れても走らない（CSP）',
   (got.headers.get('content-security-policy') ?? '').includes("script-src 'none'"),
   got.headers.get('content-security-policy') ?? 'なし');

/* ⑥ 下げると読めなくなる */
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('公開をやめる'))?.click()`);
await untilPane((b) => b.includes('公開する') && !b.includes(`/p/${slug}`), 15, 600);
const off = await fetch(`${BASE}/p/${slug}`);
ok('下げると読めなくなる', off.status === 404, String(off.status));

/* ⑦ もう一度出すと、同じ行き先に戻る（URL を配ったあとで変えない） */
await hit('/^公開する$/', 'document.querySelector("aside")');
await wait(700);
await hit('/^公開する$/', 'document.querySelector("aside")');
const p4 = await untilPane((b) => /\/p\/[a-z0-9-]+/.test(b), 20, 700);
ok('もう一度出すと、同じ URL に戻る', p4.includes(`/p/${slug}`), p4.match(/\/p\/[a-z0-9-]+/)?.[0] ?? p4.slice(0, 90));
const again = await fetch(`${BASE}/p/${slug}`);
ok('戻した URL がまた開く', again.status === 200, String(again.status));

console.log('\nerrs:', errs.length ? errs.slice(0, 4) : 'なし');
console.log(bad ? `\n${bad}件 通らなかった` : '\nぜんぶ通った');
ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
process.exit(bad ? 1 : 0);
