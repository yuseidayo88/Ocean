import { scan } from './scan2.mjs';
const pairs = JSON.parse(process.argv[5]);
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
