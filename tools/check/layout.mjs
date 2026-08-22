import { scan } from './_probe.mjs';
const B = process.env.BASE ?? 'http://localhost:3300';
const q = (s) => encodeURIComponent(s);

/** 20画面。ペインを持つものは「閉じた URL / 開いた URL」の組で見る */
const pairs = [
  ['/tasks',               `${B}/tasks`,               `${B}/tasks?open=tk-price`],
  ['/deliverables',        `${B}/deliverables`,        `${B}/deliverables?open=d-rev,d-mkt,d-tam&at=1`],
  ['/decisions',           `${B}/decisions`,           `${B}/decisions?open=dec-price`],
  ['/team',                `${B}/team`,                `${B}/team?open=e-research`],
  ['/hire',                `${B}/hire`,                `${B}/hire?open=c-writer`],
  ['/skills',              `${B}/skills`,              `${B}/skills?open=${q('competitor-analysis.md')},${q('price-band.md')}&at=1`],
  ['/inbox',               `${B}/inbox`,               `${B}/inbox?open=n2`],
  ['/work/w-japanese',     `${B}/work/w-japanese`,     `${B}/work/w-japanese?open=about`],
  ['/work/w-japanese/plan',`${B}/work/w-japanese/plan`,`${B}/work/w-japanese/plan?open=why`],
  ['/diagnosis',           `${B}/diagnosis`,           `${B}/diagnosis?open=${q('継続率を測れていない')}`],
  ['/discovery/result',    `${B}/discovery/result`,    `${B}/discovery/result?open=${q('韓国人向け 日本語学習サービス')}`],
  ['/import',              `${B}/import`,              `${B}/import?open=${q('nihongo-lesson.jp')}`],
  ['/home',                `${B}/home`,                null],
  ['/home?view=desk',      `${B}/home?view=desk`,      null],
  ['/home?view=progress',  `${B}/home?view=progress`,  null],
  ['/home?view=flow',      `${B}/home?view=flow`,      null],
  ['/start',               `${B}/start`,               null],
  ['/discovery',           `${B}/discovery`,           null],
  ['/work/new',            `${B}/work/new`,            null],
  ['/chat/t-price',        `${B}/chat/t-price`,        null],
  ['/chat/t-korea',        `${B}/chat/t-korea`,        null],
  ['/chat/t-lp',           `${B}/chat/t-lp`,           null],
  ['/chat/new',            `${B}/chat/new`,            null],
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
