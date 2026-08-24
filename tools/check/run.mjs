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
// 遷移の途中は評価が空で返る。**落とさない**（until が undefined を触って死ぬ）
const text = async () => (await ev('document.body.innerText')) ?? '';
const until = async (test, tries = 40, step = 1200) => {
  for (let i = 0; i < tries; i++) { const b = await text(); if (test(b)) return b; await wait(step); }
  return await text();
};
let bad = 0;
const ok = (name, pass, saw = '') => { console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : `  ← ${String(saw).slice(0, 90)}`}`); if (!pass) bad++; };

/** 入力欄に書いて送る。`after=0` で返りを待たない（同時操作を試すとき） */
const say = async (msg, after = 1200) => {
  await ev(`(() => { const t = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(msg)});
    t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  if (after) await wait(after);
};

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ① ゴール → **チャットが開く** → Work を作る確認 → 計画 → 承認
//    入口は3つともチャットになった（2026-08-24）。Work は確認を押すまでできない
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2500);
await say('韓国人向けの日本語学習サービスを立ち上げたい', 0);
const opened = await until((b) => b.includes('この Work を作る'), 20, 800);
ok('書くとチャットが開いて、Work を提案する',
   opened.includes('Work にできます') && /^\/chat\//.test(await ev('location.pathname')),
   await ev('location.pathname'));
// **確認を押すまで Work はできていない** — 押す前に一覧を見て、空のままなことを確かめる
const chatUrl = await ev('location.href');
await send('Page.navigate', { url: `${BASE}/work` }); await wait(2000);
const workList = await text();
ok('確認を押すまで Work は作られない',
   workList.includes('まだ') || workList.includes('ありません'), workList.slice(-90));
await send('Page.navigate', { url: chatUrl }); await wait(2200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
await until((b) => b.includes('承認して始める'), 20, 800);
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

// ⑤'' 入口 Case B — **チャットの中で**条件を集めて候補3つ
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('まだ決まっていない'))?.click()`);
const askInChat = await until((b) => b.includes('週にどれくらい使えますか'), 20, 800);
ok('「まだ決まっていない」がチャットで始まる',
   askInChat.includes('週にどれくらい使えますか') && /^\/chat\//.test(await ev('location.pathname')),
   await ev('location.pathname'));
const threadB = await ev('location.pathname');
/**
 * **最後の質問まで答えてから、1通で送る。**
 * 1問めを押した時点では会話に流れない（統括AIが途中の答えだけで走り出さない）。
 */
const replies = () => ev(`(document.body.innerText.match(/（仮の返事）/g) ?? []).length`);
const before1 = await replies();
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('週10時間'))?.click()`);
await wait(1800);
const mid = await text();
ok('1問めでは送らず、2問めを出す',
   mid.includes('やりたくないこと') && (await replies()) === before1,
   `返事 ${before1} → ${await replies()}`);
// 2問め（最後）に答えると、2問ぶんまとめて送られる
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('在庫を持つ'))?.click()`);
// **候補カードだけが持つ言葉で待つ。** 「おすすめ」は質問の選択肢にも出るので当てにならない
const cands = await until((b) => b.includes('条件に合う道'), 20, 800);
ok('条件が2つそろうと、候補のカードが会話に出る',
   cands.includes('条件に合う道') && cands.includes('教材販売') && cands.includes('推さない理由'),
   cands.slice(-160));
ok('2問ぶんの答えが両方とどいた（時間と避けるが条件に入る）',
   cands.includes('週10時間') && cands.includes('在庫を持つ'), cands.slice(-200));
ok('候補のカードは会話の中（別の画面に飛ばない）', (await ev('location.pathname')) === threadB, await ev('location.pathname'));
/**
 * **いちばん下の発言が入力欄の裏に潜らない。**
 * 会話は下に貼り付いていて（開いたときも、返ってきたときも）、
 * 中身の終わりは `COMPOSER_H` ぶん上で終わる。
 * 貼り付けは1回では足りない — 書体やカードで中身があとから伸びるので、伸びたら貼り直す。
 */
const foot = await ev(`(() => { const c = document.querySelector('.sy'); if (!c) return null;
  const kid = c.firstElementChild;
  return { gap: Math.round(c.scrollHeight - c.scrollTop - c.clientHeight),
           pad: parseInt(getComputedStyle(kid).paddingBottom, 10) }; })()`);
ok('会話は下に貼り付いていて、入力欄に隠れない',
   !!foot && foot.gap <= 2 && foot.pad >= 100, JSON.stringify(foot));
/**
 * 候補は**行そのものが選ぶもの**（ボタンではない）。押しやすさを3つとも同じにした。
 * ただし**押しただけでは Work はできない** — 中に出る確認の「作る」を押してはじめて。
 */
await ev(`[...document.querySelectorAll('[role=button]')].find(b => b.innerText.includes('この案にする'))?.click()`);
const sure = await until((b) => b.includes('この案で Work を作りますか'), 12, 500);
ok('候補を押しただけでは Work を作らない',
   sure.includes('この案で Work を作りますか') && !/\/plan$/.test(await ev('location.pathname')),
   await ev('location.pathname'));
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === '作る')?.click()`);
const planB = await until((b) => b.includes('承認して始める'), 20, 800);
ok('候補から Work の計画に入った', planB.includes('承認して始める') && /\/plan$/.test(await ev('location.pathname')),
   await ev('location.pathname'));

// ⑤''' 入口 Case D — **チャットの中で**取り込み → 診断
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('すでに事業がある'))?.click()`);
const askD = await until((b) => b.includes('あるものだけで構いません'), 20, 800);
ok('「すでに事業がある」がチャットで始まる',
   askD.includes('あるものだけ') && /^\/chat\//.test(await ev('location.pathname')), await ev('location.pathname'));
const threadD = await ev('location.pathname');
await say('月の売上は412,000円です。nihongo-lesson.jp で売っています。');
const diag = await until((b) => b.includes('継続率を測れていない'), 20, 800);
ok('材料を渡すと、診断のカードが会話に出る',
   diag.includes('継続率を測れていない') && diag.includes('412,000') && diag.includes('測れていません'),
   diag.slice(-160));
ok('診断のカードも会話の中', (await ev('location.pathname')) === threadD, await ev('location.pathname'));
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'Work にする')?.click()`);
const planD = await until((b) => b.includes('承認して始める'), 20, 800);
ok('診断から Work の計画に入った', planD.includes('承認して始める') && /\/plan$/.test(await ev('location.pathname')),
   await ev('location.pathname'));
// **1チャット = 1 Work。** 戻っても2本目は立たない
await send('Page.navigate', { url: `${BASE}${threadD}` });
const again = await until((b) => b.includes('Work を見る'), 20, 800);
ok('1チャット=1Work（戻ると「Work を見る」に変わる）', again.includes('Work を見る'), again.slice(-120));

// ⑤'''' `/chat/new` から始める道。**`/start` を通らない**ので、書いた先で id が変わる。
//        移ったあと誰が返事を頼むのか、が変わる道なので、ここも1本通しておく
await send('Page.navigate', { url: `${BASE}/chat/new` }); await wait(2200);
await say('ロゴを作りたい', 0);
const fromNew = await until((b) => b.includes('（仮の返事）'), 20, 800);
ok('新しいチャットからでも返事が来る',
   fromNew.includes('（仮の返事）') && /^\/chat\/(?!new)/.test(await ev('location.pathname')),
   await ev('location.pathname'));

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
