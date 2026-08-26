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

/**
 * **計画には理由が付いている**（2026-08-26）。
 * それまで右ペインの「なぜこの順番か」は**どの Work でも同じ決まり文句**で、
 * 社長は根拠ゼロのロードマップを承認していた。
 */
await ev(`document.querySelector('button[title="右を開く"]')?.click()`);
const plan = await until((b) => b.includes('なぜこの順番か'), 12, 500);
ok('計画に、この Work に固有の理由が付いている',
   plan.includes('調査を先に置きます'), plan.match(/なぜこの順番か[\s\S]{0,60}/)?.[0] ?? plan.slice(0, 90));
ok('前提にしていることが出る（確かめていないことを正直に）',
   plan.includes('前提にしていること') && plan.includes('売り方'), plan.slice(0, 90));
ok('見送った案が出る', plan.includes('見送った案'), plan.slice(0, 90));
/**
 * **辻褄の合わない計画は、社長に見せる前に引き直される。**
 * 決め打ちの1回目はフェーズを足すと12週で、全体の10週と食い違う（わざと）。
 * `checkPlan` がそれを見つけて1回だけ直させるので、画面に出るのは 4週 のほう。
 */
ok('週数の合わない計画は引き直されている（プロダクト 6週 → 4週）',
   !/プロダクト[\s\S]{0,40}6週/.test(plan), plan.match(/プロダクト[\s\S]{0,40}/)?.[0] ?? '');

await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
// **固定で待たない。** 承認した直後の数秒が、実行が見られる唯一の窓
//（決め打ちの1タスクは約3秒。並んで走るようになったので、待つと全部済んでしまう）
for (let i = 0; i < 30 && !/\/work\/[^/]+$/.test((await ev('location.pathname')) ?? ''); i++) await wait(250);
ok('承認して Work に着いた', /\/work\/[^/]+$/.test(await ev('location.pathname')), await ev('location.pathname'));
const workUrl = await ev('location.href');

// ② タスクが**並んで**走る（歩みが読める）→ 判断のタスクだけがそこで止まる
//    **決める行が出たら切り上げる、はもうできない**（2026-08-26）。全員同時に動き出すので、
//    判断で止まる1本は最初の数秒で現れる。見るのは「実行中の行を開いて歩みが読めるか」
let sawProgress = false, sawFlow = false, sawPair = false;
for (let i = 0; i < 40 && !(sawFlow && sawPair); i++) {
  const b = await text();
  if (/[1-9]\d?%/.test(b)) sawProgress = true;
  // **同時に2人動いているか**（社長の「他のAIが全員動き出す」）。
  // 同じ人に2本は持たせないので、担当が分かれた2本が並んで走る
  if (await ev(`[...document.querySelectorAll('button')].filter(
    (x) => x.className.includes('row') && /フェーズ1/.test(x.innerText) && /\\d+%/.test(x.innerText)).length >= 2`))
    sawPair = true;
  // **実行中の行だけ開く**（判断待ちの行を開くと、歩みではなく聞かれごとが出る）
  const opened = sawFlow ? false : await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.className.includes('row') && /フェーズ1/.test(x.innerText) && /\\d+%/.test(x.innerText));
    if (!b) return false; b.click(); return true; })()`);
  if (!opened) { await wait(400); continue; }
  await wait(600);
  const pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
  if (/段取り|集めて|振り分け/.test(pane)) sawFlow = true;
  await ev(`document.querySelector('aside button')?.click()`); await wait(300);
  await wait(400);
}
ok('進捗が 0% から動いた', sawProgress);
ok('実行の最中に歩みが読めた', sawFlow);
ok('社員が並んで動き出す（同時に2人）', sawPair);
const stopped = await until((b) => b.includes('決める'));
ok('判断で止まった（◆ 決める）', stopped.includes('決める'), stopped.slice(0, 60));

// ③ 判断に答える → 決定が次の実行に入って、タスクが最後まで走る
// 押してから開くまでに、読み直しの1回が挟まることがある（器のポンプが3秒ごとに回っている）。
// **開くまで押し直す** — 見ているのは「開くか」であって「1回目で開くか」ではない
let dpane = '';
for (let i = 0; i < 8 && !dpane.includes('推奨'); i++) {
  await ev(`[...document.querySelectorAll('button')].find(x => x.className.includes('row') && x.innerText.includes('決める'))?.click()`);
  await wait(700);
  dpane = await ev(`document.querySelector('aside')?.innerText ?? ''`) ?? '';
}
ok('聞かれていることが右ペインに出る', dpane.includes('対象の絞り込み') && dpane.includes('推奨'), dpane.slice(0, 60));
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('K-POPファン層'))?.click()`);
await wait(1000);

/**
 * ①' **Work を見ていなくても会社は進む**（2026-08-25。ポンプは器にある）。
 *
 *     答えたあと**ホームへ移ってから**、そこで「対象を1つに絞る」が走りきるのを待つ。
 *     見るのは**残るもの**（オフィスのログに歩みが積まれたか）で、
 *     「いま実行中」ではない — 1タスクが3秒で終わるので、
 *     **その瞬間を捕まえられるかどうか**を検査にすると、速さで結果が変わる。
 */
await send('Page.navigate', { url: `${BASE}/home` }); await wait(1500);
const away = await until((b) => b.includes('対象を1つに絞る の段取りを決めた'), 30, 900);
ok('Work を開いていなくても会社が進む（ホームで待つあいだに走った）',
   away.includes('対象を1つに絞る の段取りを決めた'),
   (await ev('location.pathname')) + ' / ' + (away.match(/[^\n]*絞る[^\n]*/)?.[0] ?? away.slice(0, 60)));
await send('Page.navigate', { url: workUrl }); await wait(1500);
/**
 * ③' **成果物ができたら、社長が見るまで進まない**（2026-08-25。社長の指示
 *    「完全自動で動くというよりかは、成果物ができたら確認してもらって、
 *    それで進めていいのか確認してもらう」）。
 *
 *    決め打ちの計画は ◆ を 戦略 と プロダクト に置いている＝**調査には無い**。
 *    それでも**成果物が 要確認 のあいだは待つ** — 見せる前に次へ行くと、
 *    直したいところがあっても後戻りになる。
 *    決めたことが文脈に入らないと fake は完走しないので、
 *    **調査フェーズが閉じたこと自体**が「決定が渡った」の証拠にもなる。
 */
const shut1 = await until((b) => b.includes('フェーズ「調査」が終わりました'), 90);
ok('決定が次の実行に渡って、調査フェーズが最後まで走った',
   shut1.includes('フェーズ「調査」が終わりました'), shut1.slice(0, 80));
ok('成果物が 要確認 のあいだは、◆ が無くても待つ',
   shut1.includes('を見て、次に進めてください')
   && await ev(`[...document.querySelectorAll('button')].some(b => b.innerText.includes('次のフェーズへ進める'))`),
   shut1.match(/フェーズ「調査」[^\n]*/)?.[0]);
ok('待っているあいだ、次のフェーズは始まっていない',
   !(await text()).includes('収益モデル'));

// ④ 成果物: 1つ承認、1つ差し戻し → 直しタスクが走る（**まだフェーズ1のうち**）
await ev(`[...document.querySelectorAll('button')].find(b => b.className.includes('row') && b.innerText.includes('競合'))?.click()`);
await wait(700);
const pane = await ev(`document.querySelector('aside')?.innerText ?? ''`);
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
// 押したあと、ペインは読み直しを1回はさむ（器のポンプが3秒ごとに回っている）。
// **出るまで少し待つ** — 見ているのは「差し戻せたか」であって「1200ms で出るか」ではない
let back = '';
for (let i = 0; i < 10 && !back.includes('差し戻し'); i++) {
  await wait(600);
  back = (await ev(`document.querySelector('aside')?.innerText ?? ''`)) || await text();
}
ok('差し戻すと 差し戻し済', back.includes('差し戻し'), back.slice(0, 60));
await ev(`document.querySelector('aside button')?.click()`); await wait(300);
const gate2 = await until((b) => b.includes('を直す'), 40);
ok('差し戻しが直しタスクになって積まれた', gate2.includes('を直す'), gate2.match(/[^\n]*を直す[^\n]*/)?.[0]);

/** 要確認 の成果物を上から承認していく（**社長が見た**、の代わり） */
const seeAll = async (max = 6) => {
  for (let i = 0; i < max; i++) {
    const opened = await ev(`(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.className.includes('row') && x.innerText.includes('要確認'));
      if (!b) return false; b.click(); return true; })()`);
    if (!opened) return i;
    await wait(700);
    const did = await ev(`(() => {
      const b = [...document.querySelectorAll('aside button')].find((x) => x.innerText === '承認して受け取る');
      if (!b) return false; b.click(); return true; })()`);
    await wait(900);
    await ev(`document.querySelector('aside button')?.click()`); await wait(300);
    if (!did) return i;
  }
  return max;
};

// **直したものまで見終われば、◆ が無いフェーズは押さなくても次へ進む**
await until((b) => b.includes('フェーズ「調査」が終わりました'), 90);
ok('直したものが 要確認 で戻ってくる', (await seeAll()) > 0);
const auto = await until((b) => b.includes('収益モデル'), 90);
ok('見終わると、◆ が無いフェーズは押さなくても次へ進む', auto.includes('収益モデル'), auto.slice(0, 80));
const bar = await ev(`[...document.querySelectorAll('button')].some(b => b.innerText.includes('次のフェーズへ進める'))`);
ok('進んだあとは承認の帯が出ていない', !bar, String(bar));
const p2 = await until((b) => /フェーズ\n2 \/ /.test(b), 40);
ok('フェーズが 2 に進んだ', /フェーズ\n2 \/ /.test(p2), p2.match(/フェーズ\n[^\n]*/)?.[0]);

/**
 * ④' **前のフェーズを読んで、統括AIが社長に聞く**（2026-08-26。社長の
 *     「わからない部分は統括AIがユーザーに質問投げて他のAIが全員動き出す」）。
 *     決め打ちの計画は 戦略 の「収益モデルを比べる」に ◆ を置く。
 *     **待つのはその1本だけ** — ほかの2人は答えを待たずに動き出す。
 */
const ask2 = await until((b) => /収益モデルを比べる[\s\S]{0,60}決める/.test(b), 60);
ok('統括AIが、社長にしか決められないことを聞いてくる',
   /収益モデルを比べる[\s\S]{0,60}決める/.test(ask2),
   ask2.match(/収益モデルを比べる[\s\S]{0,60}/)?.[0]?.replace(/\n/g, ' '));
// **聞いているあいだも、ほかは止まらない** — 答える前に 戦略 の 2/3 が終わる
const par2 = await until((b) => /戦略[\s\S]{0,20}2\/3/.test(b), 90);
ok('聞いているあいだも、ほかのAIは動いている（2 / 3）',
   /戦略[\s\S]{0,20}2\/3/.test(par2), par2.match(/戦略[\s\S]{0,20}\d\/\d/)?.[0]?.replace(/\n/g, ' '));
// 答える（推奨は 月額）
let dp2 = '';
for (let i = 0; i < 8 && !dp2.includes('収益の取り方'); i++) {
  await ev(`[...document.querySelectorAll('button')].find(x => x.className.includes('row') && x.innerText.includes('決める'))?.click()`);
  await wait(700);
  dp2 = await ev(`document.querySelector('aside')?.innerText ?? ''`) ?? '';
}
ok('聞かれているのは収益の取り方', dp2.includes('収益の取り方') && dp2.includes('推奨'), dp2.slice(0, 60));
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText.includes('月額'))?.click()`);
await wait(1200);
await ev(`document.querySelector('aside button')?.click()`); await wait(300);

// ⑤ **◆ があるフェーズでは、成果物を見終わっても止まる。** 押すまで先へは行かない
const done2 = await until((b) => b.includes('フェーズ「戦略」が終わりました'), 90);
ok('フェーズ「戦略」が閉じた', done2.includes('フェーズ「戦略」が終わりました'),
   done2.match(/フェーズ「戦略」[^\n]*/)?.[0]);
// **表（csv）の成果物**もここで出る（価格の帯 → 1行目が見出しの表）
ok('表は表として読める（記号のまま出さない）',
   await ev(`(() => {
     const b = [...document.querySelectorAll('button')].find(
       (x) => x.className.includes('row') && /価格/.test(x.innerText));
     if (!b) return false; b.click(); return true; })()`) ? (
     await wait(800), (await ev(`document.querySelectorAll('aside table').length`)) > 0
   ) : false);
await ev(`document.querySelector('aside button')?.click()`); await wait(300);
await seeAll();
await wait(4000);
ok('◆ があるフェーズは、見終わっても社長を待つ',
   (await ev(`[...document.querySelectorAll('button')].some(b => b.innerText.includes('次のフェーズへ進める'))`))
   && !/フェーズ\n3 \/ /.test(await text()));
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('次のフェーズへ進める'))?.click()`);
const p3 = await until((b) => /フェーズ\n3 \/ /.test(b), 40);
ok('承認するとフェーズ 3 へ進む', /フェーズ\n3 \/ /.test(p3), p3.match(/フェーズ\n[^\n]*/)?.[0]);

/**
 * **図の成果物**（archify の形）。AI社員が `draw_workflow` で描き、
 * OneFound の9つの検査を通ってから成果物になる。
 * 決め打ちのプロバイダは**1回目をわざと壊す**ので、
 * これが出ているなら「検証 → 描き直し → 通った」の輪が回っている。
 */
await send('Page.navigate', { url: `${BASE}/deliverables` }); await wait(2500);
const dels = await text();
ok('図が成果物になった（主線が書き出しに出る）',
   dels.includes('申込の流れ') && dels.includes('申し込みを受ける → 内容を確かめる'), dels.slice(0, 160));
await ev(`[...document.querySelectorAll('button,[role=button],a')].find(b => b.innerText.includes('申込の流れ'))?.click()`);
const shown = await until((b) => b.includes('受けるか決める'), 15, 600);
ok('図が絵として描かれる（判断は「あなたが決める」）',
   shown.includes('受けるか決める') && shown.includes('あなたが決める') && shown.includes('不足あり'),
   shown.slice(-160));
ok('壊れた線は残っていない', !shown.includes('resend'), shown.slice(-100));

// ⑤' 学びの輪（note_learning → 社員のメモ → 設定ペイン）と標準スキル
await send('Page.navigate', { url: `${BASE}/team` }); await wait(2200);
const team = await text();
ok('承認で採用した社員がメンバーに並ぶ', team.includes('調査担当'), team.slice(0, 80));
await ev(`[...document.querySelectorAll('.row')].find(r => r.innerText.includes('調査担当'))?.click()`);
const paneB = await until((b) => b.includes('学び'), 10, 800);
ok('社員の学びが設定ペインに残った', paneB.includes('数字は事実・推計・要確認の3束に分けてから出す'), paneB.slice(0, 120));

/**
 * ⑤'' モデルと深さ。**選んだものが本当に残るか**を1本通す
 * （画面 → サーバーアクション → 保存先 → 読み直し）。
 * 深さは**モデルごとに段が違う**ので、Claude を選ぶと「考えずに答える」が消える。
 */
await send('Page.navigate', { url: `${BASE}/team` }); await wait(2000);
const before = await text();
ok('選んでいない社員は既定のモデルで出る', before.includes('GPT-5.6 Luna'), before.match(/[^\n]*Luna[^\n]*/)?.[0]);
// 調査担当の行のモデルを Claude Sonnet 5 にする
await ev(`[...document.querySelectorAll('.row')].find(r => r.innerText.includes('調査担当'))
            ?.querySelector('button[aria-haspopup="listbox"]')?.click()`);
await wait(400);
await ev(`[...document.querySelectorAll('[role="option"]')].find(b => b.innerText.includes('Claude Sonnet 5'))?.click()`);
await wait(900);
await send('Page.navigate', { url: `${BASE}/team` });
const after = await until((b) => b.includes('Claude Sonnet 5'), 10, 600);
ok('選んだモデルが残る（読み直しても Claude Sonnet 5）', after.includes('Claude Sonnet 5'),
   after.match(/[^\n]*Claude[^\n]*/)?.[0]);
// 深さの段は選んだモデルのもの（Claude は `none` を受けない = 段が5つ）
const dots = await ev(`(() => {
  const r = [...document.querySelectorAll('.row')].find(x => x.innerText.includes('調査担当'));
  const sl = r?.querySelector('[role="slider"]');
  return sl ? [sl.querySelectorAll('button').length, sl.getAttribute('aria-valuetext')] : null;
})()`);
ok('深さの段はモデルが決める（Claude は5段）', Array.isArray(dots) && dots[0] === 5, JSON.stringify(dots));
// つまみを右へ1つ動かして、残ることを見る
await ev(`(() => {
  const r = [...document.querySelectorAll('.row')].find(x => x.innerText.includes('調査担当'));
  const bs = r.querySelector('[role="slider"]').querySelectorAll('button');
  bs[bs.length - 1].click();
})()`);
await wait(900);
await send('Page.navigate', { url: `${BASE}/team` }); await wait(2000);
const deep = await ev(`(() => {
  const r = [...document.querySelectorAll('.row')].find(x => x.innerText.includes('調査担当'));
  return r?.querySelector('[role="slider"]')?.getAttribute('aria-valuetext');
})()`);
ok('選んだ深さが残る（いちばん深く）', deep === 'いちばん深く', String(deep));

/**
 * ⑤''' 一時停止。**押したら本当に止まる**（新しいタスクは起こされない）。
 * 一覧の状態の語で見る — ペインの中の文には「一時停止」が説明としても出るので、
 * 行のほうを読む。
 */
const stateOf = async () => ev(`(() => {
  const r = [...document.querySelectorAll('.row')].find(x => x.innerText.includes('調査担当'));
  return r ? ((r.innerText.match(/実行中|待機|一時停止/) || [''])[0]) : '';
})()`);
await ev(`[...document.querySelectorAll('.row')].find(r => r.innerText.includes('調査担当'))?.click()`);
await wait(800);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '一時停止')?.click()`);
await wait(1000);
ok('一時停止すると、一覧の状態もそう出る', (await stateOf()) === '一時停止', await stateOf());
await send('Page.navigate', { url: `${BASE}/team` }); await wait(2000);
ok('一時停止は読み直しても残る', (await stateOf()) === '一時停止', await stateOf());
await ev(`[...document.querySelectorAll('.row')].find(r => r.innerText.includes('調査担当'))?.click()`);
await wait(800);
await ev(`[...document.querySelectorAll('aside button')].find(b => b.innerText === '再開する')?.click()`);
await wait(1000);
ok('再開すると戻る', (await stateOf()) === '待機', await stateOf());

await send('Page.navigate', { url: `${BASE}/skills` }); await wait(2200);
const sk = await text();
ok('標準スキルが見えている', sk.includes('標準') && sk.includes('調査のまとめ方'), sk.slice(0, 80));
ok('スキルが実行で読まれた（used_count）', /\d+回/.test(sk), sk.match(/[^\n]*回[^\n]*/)?.[0]);

// ⑤'' 入口 Case B — **チャットの中で**条件を集めて候補3つ
await send('Page.navigate', { url: `${BASE}/start` }); await wait(2200);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('まだ決まっていない'))?.click()`);
/** **まず、やさしい質問から。** 分野は最後（無数にあるので、一覧から選ばせない） */
const askInChat = await until((b) => b.includes('週にどれくらい使えますか'), 20, 800);
ok('「まだ決まっていない」は、やさしい質問（時間）から始まる',
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
await wait(1500);
const mid = await text();
ok('1問めでは送らず、2問めを出す',
   mid.includes('やりたくないこと') && (await replies()) === before1,
   `返事 ${before1} → ${await replies()}`);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('在庫を持つ'))?.click()`);
await wait(1200);
// 3問め（最後）＝分野。答えると3問ぶんまとめて送られ、**続きの仕掛け**が候補まで出す
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('学び・教える'))?.click()`);
// **候補カードだけが持つ言葉で待つ。** 「条件に合う道」は進行の帯（〇〇しています）にも
// 出るので、カードにしか無い「推さない理由」で待つ
const cands = await until((b) => b.includes('推さない理由'), 20, 800);
ok('分野と条件がそろうと、候補のカードが会話に出る',
   cands.includes('条件に合う道') && cands.includes('教材販売') && cands.includes('推さない理由'),
   cands.slice(-160));
ok('3問ぶんの答えが全部とどいた（分野・時間・避けるが条件に入る）',
   cands.includes('学び・教える') && cands.includes('週10時間') && cands.includes('在庫を持つ'),
   cands.slice(-240));
// **候補は分野の名前を持つ**（「オンライン講座」だけにしない）
ok('候補の名前に分野が入っている', cands.includes('学び・教えるのオンライン講座'), cands.slice(-240));
// **完了の定義は候補が持っている**（採用したあとに聞き返さない）
ok('候補が「何ができたら完了か」を出している', cands.includes('完了') && cands.includes('受け終わっている'),
   cands.slice(-240));
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
/**
 * **どれも違うときの道。** 3つとも違う社長が行き止まりにならない —
 * 押すと会話に戻り、**何が違うかを1問だけ**聞かれる（すぐ3つ出し直さない）。
 * そして**答えを新しいゴールにしない**（質問文が Work の題になる穴があった）。
 */
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('どれも違う'))?.click()`);
const why = await until((b) => b.includes('どこが違いますか'), 20, 700);
ok('「どれも違う」と言うと、何が違うかを1問だけ聞かれる',
   why.includes('どこが違いますか') && why.includes('相手が違う'), why.slice(-140));
ok('答えを新しいゴールにしない（Work の提案が出ない）', !why.includes('この Work を作る'), why.slice(-140));
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('相手が違う'))?.click()`);
const axis = await until((b) => b.includes('相手を変えて'), 20, 800);
ok('違う軸で候補が出し直される', axis.includes('相手を変えて') && axis.includes('推さない理由'), axis.slice(-160));

await ev(`[...document.querySelectorAll('[role=button]')].find(b => b.innerText.includes('この案にする'))?.click()`);
const sure = await until((b) => b.includes('この案で Work を作りますか'), 12, 500);
ok('候補を押しただけでは Work を作らない',
   sure.includes('この案で Work を作りますか') && !/\/plan$/.test(await ev('location.pathname')),
   await ev('location.pathname'));
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === '作る')?.click()`);
const planB = await until((b) => b.includes('承認して始める'), 20, 800);
ok('候補から Work の計画に入った', planB.includes('承認して始める') && /\/plan$/.test(await ev('location.pathname')),
   await ev('location.pathname'));

/**
 * **吹き出しは社長の言葉だけ。** 前は候補のねらいと集めた条件を全部つないで
 * 1つのゴールにしていたので、「◯◯を立ち上げたい 終わり: … 背景: … 分野: …
 * 使える時間: …」が**社長が書いた言葉として**出ていた。
 */
const bubble = await ev(`(() => {
  const s = [...document.querySelectorAll('span')].find(x => x.innerText.includes('を立ち上げたい'));
  return s ? s.innerText : '';
})()`);
ok('計画の吹き出しは社長の言葉だけ（背景や条件を混ぜない）',
   bubble.includes('立ち上げたい') && bubble.includes('終わり:') && !bubble.includes('背景:') && !bubble.includes('分野:'),
   bubble.slice(0, 90));
/**
 * **どの道で進めるかは、いちばん最初の「決めたこと」。**
 * 選ばなかった2つと並べて台帳に残る（なぜその道かは、選ばなかった道と並べて意味になる）。
 */
await send('Page.navigate', { url: `${BASE}/decisions` }); await wait(2200);
const led = await text();
ok('選んだ道が決定事項に残る', led.includes('どの道で進めるか') && led.includes('オンライン講座'), led.slice(0, 140));

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

/**
 * **社員を1人も提案しない計画**（本番で実際に来た形）。統括AIが `hires: []` を返し、
 * 担当に「商品設計担当」「デザイン制作担当」という**この会社に居ない名前**を書く。
 * 前はそのまま承認でき、誰も採用されず、担当のいないタスクが走って失敗した。
 * いまは**タスクの担当名から採り、名簿に無い名前は落として調査担当に寄せる**。
 */
await until((b) => b.includes('この Work を作る'), 20, 800);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText === 'この Work を作る')?.click()`);
await until((b) => b.includes('承認して始める'), 20, 800);
const smallPlan = await text();
ok('居ない担当名を計画に残さない', !smallPlan.includes('商品設計担当') && !smallPlan.includes('デザイン制作担当'),
   smallPlan.slice(0, 120));
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('承認して始める'))?.click()`);
await wait(3500);
const small = await until((b) => /[1-9]\d?%|要確認/.test(b), 30);
// **寄せ先は「そのフェーズを回す人」**（2026-08-26）。先頭の社員ではない —
// フェーズ「案出し」の担当は企画担当なので、担当のいないタスクはそこへ落ちる
ok('社員を提案しない計画でも、担当が付いて動く',
   small.includes('企画担当') && /[1-9]\d?%|要確認/.test(small), small.slice(0, 140));

// ⑤'' **社長が止められる。** 見ていないあいだも動く会社に、止める手が要る
const smallUrl = await ev('location.href');
await send('Page.navigate', { url: `${smallUrl.split('?')[0]}?open=about` }); await wait(2600);
await ev(`document.querySelector('aside [role=switch]')?.click()`);
const held = await until((b) => b.includes('一時停止'), 12, 700);
ok('社長が Work を止められる', held.includes('一時停止') && held.includes('止めています'),
   held.match(/一時停止|止めています/g)?.join(' / ') ?? '(止まっていない)');
await ev(`document.querySelector('aside [role=switch]')?.click()`);
const back2 = await until((b) => !b.includes('一時停止'), 12, 700);
ok('もう一度押すと動きだす', !back2.includes('一時停止'), back2.match(/一時停止|進行中|完了/g)?.join(' / ') ?? '');

// ⑤' **もう作ってある会話は「作る」と書かない**（カードは id しか持たない）。
//     前は「作った」がカードの中の state にしかなく、開き直すと作るボタンに戻っていた
await send('Page.navigate', { url: chatUrl }); await wait(2600);
const madeCard = await text();
ok('作ってある会話のカードは「計画を見る」になる',
   madeCard.includes('計画を見る') && !madeCard.includes('この Work を作る'),
   madeCard.match(/この Work を作る|計画を見る/g)?.join(' / ') ?? '(どちらも無い)');

// ⑥ 埋まった状態のレイアウト。ダミーを消したので、**ここでしか測れない**
//    （ホーム4ビューは Work が動いてはじめて絵になる）
const { scan } = await import('./_probe.mjs');
const SWEEP = ['/home', '/home?view=desk', '/home?view=flow',
               '/tasks', '/team', '/deliverables', '/decisions', '/inbox'];
let cut = 0;
for (const u of SWEEP) {
  const r = await scan(`${BASE}${u}`);
  const x = r.v;
  const n = x ? x.ell.length + x.scrollx.length + x.off.length : 1;
  if (n) {
    cut += n;
    const first = x ? (x.ell[0]?.full ?? x.off[0]?.txt ?? x.scrollx[0]?.tag ?? '') : '取得できず';
    // **内訳まで出す。** 「17件」だけでは、どれを直せばいいのか分からない
    const kind = x ? `…切れ ${x.ell.length} / 横送り ${x.scrollx.length} / 画面外 ${x.off.length}` : '';
    console.log(`  レイアウト ${u}: ${n}件  ${kind}  ${String(first).slice(0, 60)}`);
  }
}
ok('埋まった状態のレイアウト（9画面）', cut === 0, `${cut}件`);

console.log('\nerrs:', errs.length ? errs.slice(0, 3) : 'なし');
console.log(bad ? `${bad}件` : 'ぜんぶ通った');
ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
process.exit(bad ? 1 : 0);
