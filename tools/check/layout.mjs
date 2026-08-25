import { scan } from './_probe.mjs';
const B = process.env.BASE ?? 'http://localhost:3300';

/** ペインを持つものは「閉じた URL / 開いた URL」の組で見る */
/**
 * ゼロ状態の画面。**ダミーは無い** — 空の会社で、全画面が正直な空状態を出すことを測る。
 * 埋まった状態（Work が動いたあと）のレイアウトは run.mjs の最後のスイープが測る。
 */
const pairs = [
  ['/start',             `${B}/start`,             null],
  ['/chat/new',          `${B}/chat/new`,          null],
  ['/tasks',             `${B}/tasks`,             null],
  ['/inbox',             `${B}/inbox`,             null],
  ['/team',              `${B}/team`,              `${B}/team?open=exec`],
  ['/team?open=all',     `${B}/team?open=all`,     `${B}/team?open=all`],
  ['/team 候補',         `${B}/team`,              `${B}/team?open=d-market-researcher`],
  // 入口。**器の外にある唯一の画面**（レールも入力欄も無い＝右ペインも無い）。
  // 戻された理由が出ている姿も測る（1行増えて崩れないか）
  ['/login',             `${B}/login`,             null],
  ['/login 理由つき',    `${B}/login?e=provider`,  null],
  ['/login 新規登録',    `${B}/login?mode=signup`, null],
  ['/login 忘れた',      `${B}/login?mode=forgot`, null],
  ['/auth/reset',        `${B}/auth/reset`,        null],
  ['/deliverables',      `${B}/deliverables`,      null],
  ['/decisions',         `${B}/decisions`,         null],
  ['/skills',            `${B}/skills`,            null],
  ['/billing',           `${B}/billing`,           null],
  ['/home',              `${B}/home`,              null],
];
for (const [label, closed, open] of pairs) {
  const a = await scan(closed);
  const b = open ? await scan(open) : null;
  const lines = [];
  const rep = (tag, v) => {
    if (!v.v) { lines.push(`  ${tag} 取得できず`); return; }
    const x = v.v;
    if (x.docw > Number(process.argv[3])) lines.push(`  ${tag} 横スクロール ${x.docw}px`);
    for (const e of x.ell) lines.push(`  ${tag} …で切れ ${e.lost}px 「${e.full}」  ${e.tag}`);
    for (const s of x.scrollx) lines.push(`  ${tag} 横スクロール要 ${s.by}px  ${s.tag}`);
    for (const o of x.off.slice(0,4)) lines.push(`  ${tag} 画面外(${o.side}) ${o.by}px 「${o.txt}」`);
    for (const e of v.errs.slice(0,2)) lines.push(`  ${tag} ERR ${e}`);
  };
  rep('[閉]', a);
  if (b) {
    rep('[開]', b);
    if (b.v && b.v.pane === 0) lines.push('  [開] ペインが出ていない');
    if (a.v && b.v) {
      const setB = new Set(b.v.text);
      const lost = a.v.text.filter(t => !setB.has(t));
      if (lost.length) lines.push(`  [開] 消えた文字 ${lost.length}件: ${lost.slice(0,8).map(t=>'「'+t+'」').join(' ')}`);
    }
  }
  console.log(lines.length ? `✗ ${label}\n${lines.join('\n')}` : `✓ ${label}`);
}
process.exit(0);
