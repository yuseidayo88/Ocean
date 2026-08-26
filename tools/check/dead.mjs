import { WebSocket } from 'ws';

/**
 * **押しても何も起きないもの**を数える。
 * 押せる顔をしている要素を全部押して、URL も画面の中身も変わらなければ「死んでいる」。
 *
 * CLAUDE.md:「押せないものを押せる顔にしない」。
 * Phase 4 は書き込みが届かないので死んでいて当然のものもあるが、
 * **どれがどれだけあるか**を知らずに「使いにくい」を直せない。
 */

const PORT = process.argv[2] ?? '9335';
const BASE = process.env.BASE ?? 'http://localhost:3300';
const W = 1440, H = 860;

/** 固定の行き先。**Work と会話の id は決め打ちにしない**（走らせるたびに変わる） */
const PAGES = ['/home', '/home?view=desk', '/home?view=flow',
  '/tasks', '/inbox', '/team', '/deliverables', '/decisions', '/skills',
  '/work', '/start', '/chat/new'];

/** 押せる顔をしているもの。中の子は数えない（親が押せるなら1つ） */
const LIST = `(() => {
  const seen = new Set(), out = [];
  const cands = [...document.querySelectorAll('a[href], button, [role=button], [role=option], [role=switch], .row, .btn, .solid, .icob, .card, .lnk, .hit')];
  for (const el of cands) {
    if (cands.some((o) => o !== el && o.contains(el))) continue;   // 親が押せるなら子は数えない
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
    // **本当にそこを押せるか。** 親が幅0で切り取っていると、子は大きさを持っていても押せない
    const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit))) continue;
    // 戻る・進むは履歴が要る。まっさらな状態で押しても何も起きないのは正しい
    const ttl = el.getAttribute('title');
    if (ttl === '戻る' || ttl === '進む') continue;
    let label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 34);
    if (!label) label = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
      + (el.closest('nav') ? '@レール' : el.closest('header') ? '@トップバー' : el.closest('aside') ? '@右ペイン' : '@中央');
    const key = label + '@' + Math.round(r.x) + ',' + Math.round(r.y);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ label, href: el.getAttribute('href') || '', x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  }
  return out;
})()`;

/**
 * 「何か起きた」の見分け方。URL と中身の量だけだと、
 * **見た目しか変わらないもの**（レールの開閉・板が開く）を死んだと数えてしまう。
 */
const STATE = `[
  location.pathname + location.search,
  // **文字数ではなく中身。** 100% → 110% は長さが同じなので、数えるだけだと見逃す
  (() => { let h = 0; const t = document.body.innerText; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; })(),
  document.querySelectorAll('*').length,
  document.querySelector('aside') ? 1 : 0,
  // レールは中の <nav> が幅固定で、**外の器のほうが 0 になる**。内側を測ると開閉が見えない
  Math.round(document.querySelector('nav')?.parentElement?.getBoundingClientRect().width ?? -1),
  document.querySelectorAll('[role=dialog],[role=listbox],[role=status],.pop').length,
  (document.activeElement?.tagName ?? '') + (document.activeElement?.getAttribute?.('placeholder') ?? ''),
].join('|')`;

const conn = async (url) => {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { ws, send, id: t.id };
};

let deadAll = 0, liveAll = 0;
for (const path of PAGES) {
  const { ws, send } = await conn(BASE + path);
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true }))?.result?.value;
  // オフィスの盤面は絵が重いので、描き終わるまで少し待つ
  const wait = path.startsWith('/home') && !path.includes('view=') ? 3600 : 2600;
  const go = async () => { await send('Page.navigate', { url: BASE + path }); await new Promise((r) => setTimeout(r, wait)); };
  await go();
  const items = await ev(LIST);
  const dead = [];
  /** 押すと板（メニュー・一覧）が出るもの。**その中も押す**（→ ②） */
  const opens = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.href && !it.href.startsWith('#')) { liveAll++; continue; }   // <a href> は行き先がある
    /**
     * **もう無いものを「死」と数えない**（2026-08-26）。
     *
     * 候補は画面をひらいた時点で1回だけ集めている。前の当たりで画面が進むと
     * （判断に答える、行を選ぶ等）、あとの候補は**その場所から消えている** —
     * そこを押しても何も起きないのは当たり前で、「押せる顔をしているのに死んでいる」
     * とは違う。実際 `/decisions` で、答えたあとの選択肢2つを毎回そう数えていた。
     *
     * 名前を持つものだけ見る（`button@中央` のような合成名は突き合わせられない）。
     */
    const still = await ev(`(() => {
      const e = document.elementFromPoint(${it.x}, ${it.y});
      const t = e && e.closest('a[href], button, [role=button], [role=option], [role=switch], .row, .btn, .solid, .icob, .card, .lnk, .hit');
      return t ? (t.textContent || '').trim().replace(/\\s+/g, ' ') : null; })()`);
    // **押せるものがもうそこに居ない。** 押しても何も起きなくて当たり前
    if (still === null) continue;
    // 名前を持つものは、同じものかどうかも見る（別のものに入れ替わっていたら判定しない）
    if (!it.label.includes('@') && !still.includes(it.label.slice(0, 6))) continue;
    const before = await ev(STATE);
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x: it.x, y: it.y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 320));
    const after = await ev(STATE);
    if (before === after) { dead.push(it.label); deadAll++; }
    else {
      liveAll++;
      // **押して初めて板が出たなら、その中も見る**（→ 下の ②）
      if ((await ev(`document.querySelectorAll('[role=dialog],[role=listbox],.pop').length`)) > 0) opens.push(it);
      await go(); continue;
    }
    /**
     * 死んでいても、開きっぱなしの板が次の当たりを塞ぐことがある。
     * ただし **Esc をむやみに押さない** — Esc で閉じるもの（質問の板）まで消えて、
     * そのあとの要素が全部「死」に見える（実際それで8件を誤判定した）。
     * **開いているものがあるときだけ**閉じる。
     */
    if ((await ev(`document.querySelectorAll('[role=dialog],[role=listbox],.pop').length`)) > 0) await go();
  }
  /**
   * ② **押して初めて出るものの中も押す**（2026-08-26）。
   *
   * 一覧（`LIST`）は**画面を開いた時点で**集めるので、
   * **開いてから出るメニューの中は一度も押されていなかった** —
   * 実際、左下の「わたし」の中でログアウトと設定が死んだまま残っていた
   * （ログアウトは、会社から出る唯一の道）。
   *
   * 板を出すものだけを対象にする（全部を2度押すと倍かかる）。
   * 中を1つ押すたびに読み直して開き直す — 押した拍子に板ごと消えることがある。
   */
  let n = 0;
  for (const op of opens) {
    for (let k = 0; k < 8; k++) {
      await go();
      for (const type of ['mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', { type, x: op.x, y: op.y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 360));
      const inner = await ev(`(() => {
        const box = document.querySelector('[role=dialog], [role=listbox], .pop');
        if (!box) return [];
        const out = [];
        for (const el of box.querySelectorAll('a[href], button, [role=button], [role=option], [role=switch], .row, .btn, .solid, .icob, .lnk, .hit')) {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          out.push({ label: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30),
                     x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
        }
        return out; })()`);
      if (!inner || k >= inner.length) break;
      const row = inner[k];
      const before = await ev(STATE);
      for (const type of ['mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', { type, x: row.x, y: row.y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 360));
      const after = await ev(STATE);
      n++;
      if (before === after) { dead.push(`${op.label} › ${row.label}`); deadAll++; } else liveAll++;
    }
  }
  console.log(`${path}  押せる ${items.length + n} / 死 ${dead.length}`);
  for (const d of dead) console.log(`    ✗ ${d}`);
  ws.close();
}
console.log(`\n合計: 生 ${liveAll} / 死 ${deadAll}`);
process.exit(0);
