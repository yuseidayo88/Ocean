import { previewOf } from '@/lib/diagram/parse';
import { blocks, plain, type Block } from './md';

/**
 * **成果物の形は1か所で決める**（2026-08-25。社長の指示
 * 「文章だけでなく、LPやPDFや様々な出力できるようにしたい、CSVとかもそうだし」）。
 *
 * ここまで成果物は markdown 1種類しかなく、表は `|---|` のまま、
 * LPは書けなかった。**持ち出せない形で書かせても、社長の手もとでは使えない** —
 * 表は表計算に、LPはブラウザに、報告書は人に送る PDF に、そのまま渡せないと意味がない。
 *
 * この表を見るのは4か所 — AI社員の道具（何を書けるか）／画面（どう描くか）／
 * 持ち出し（拡張子と型）／一覧の書き出し。**業種は入れない**（何の会社でも同じ形）。
 */
export type Shape = 'markdown' | 'csv' | 'html' | 'code' | 'diagram' | 'image';

export type Format = {
  /** 画面と社長に見せる語。**短い名詞**（状態の6語とは別の語彙） */
  label: string;
  /** どう読むか。描き方も持ち出しの型もここから決まる */
  shape: Shape;
  /** 落とすときの拡張子 */
  ext: string;
  /** 落とすときの型 */
  mime: string;
  /** 印刷（PDF）に回せるか。図は画面の中で描くものなので回さない */
  print: boolean;
};

export const FORMATS: Record<string, Format> = {
  report:  { label: '報告',   shape: 'markdown', ext: 'md',   mime: 'text/markdown',  print: true },
  doc:     { label: '文書',   shape: 'markdown', ext: 'md',   mime: 'text/markdown',  print: true },
  copy:    { label: '文案',   shape: 'markdown', ext: 'md',   mime: 'text/markdown',  print: true },
  table:   { label: '表',     shape: 'markdown', ext: 'md',   mime: 'text/markdown',  print: true },
  csv:     { label: '表データ', shape: 'csv',    ext: 'csv',  mime: 'text/csv',       print: true },
  page:    { label: 'ページ', shape: 'html',     ext: 'html', mime: 'text/html',      print: true },
  code:    { label: 'コード', shape: 'code',     ext: 'txt',  mime: 'text/plain',     print: false },
  diagram: { label: '図',     shape: 'diagram',  ext: 'json', mime: 'application/json', print: false },
  /**
   * **画像**（2026-08-27。社長の「ロゴ作る時は GPT の AI 使うようにしようかな」）。
   *
   * ほかの7つと違って、**本文がここには無い**。中身はバイト列で、
   * 置き場所は `deliverables.storage_path`（0001 から空いていた列）。
   * `body` に入っているのは**何を頼んだか**（プロンプト）で、
   * 差し戻しのときに「前は何と言ったか」を読むために残す。
   */
  image:   { label: '画像',   shape: 'image',    ext: 'png',  mime: 'image/png',      print: true },
};

const FALLBACK: Format = FORMATS.report;

/**
 * 形を決める。**種類が先、中身は後**（種類が言っていないときだけ中身で見分ける）。
 * 図は昔から `{` で始まる JSON なので、種類が抜けていても図として読める。
 */
export function formatOf(kind?: string, body?: string): Format {
  const f = kind ? FORMATS[kind] : undefined;
  if (f) return f;
  const b = (body ?? '').trim();
  if (b.startsWith('{')) return FORMATS.diagram;
  if (/^\s*<(!doctype|html|section|div|main)\b/i.test(b)) return FORMATS.page;
  return FALLBACK;
}

/** 落とすときのファイル名。**題をそのまま使う**（機械の id を出さない） */
export function fileName(title: string, f: Format): string {
  const safe = (title || '成果物').replace(/[\\/:*?"<>|]/g, '_').trim();
  return `${safe}.${f.ext}`;
}

/* ══════════════ CSV ══════════════ */

/**
 * CSV を割る。**引用符の中のカンマと改行**を守る（表計算が書き出したものをそのまま受ける）。
 * 壊れていても落ちない — 読めたところまでを返す。
 */
export function readCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = src.replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  // 空の行は落とす（末尾の改行で1行増える）
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/* ══════════════ 一覧の書き出し ══════════════ */

/**
 * 一覧に出す2〜3行。**中身が主役なので、実際の書き出しを出す**（灰色の棒を置かない）。
 * 形ごとに「いちばん中身らしいところ」が違う — 表は見出しの行、ページは題と最初の1文。
 */
export function previewFor(kind: string | undefined, body: string): string {
  const f = formatOf(kind, body);
  // **画像には書き出しが無い。** サムネイルは絵そのものを出すので、文字は要らない
  if (f.shape === 'image') return '';
  // 図は**主線**を書き出しにする（JSON をそのまま出すと記号の山になる）
  if (f.shape === 'diagram') return previewOf(body) ?? body.slice(0, 90);
  if (f.shape === 'csv') {
    const rows = readCsv(body);
    if (!rows.length) return '';
    return rows.slice(0, 3).map((r) => r.join(' · ')).join('\n');
  }
  if (f.shape === 'html') {
    const title = /<title>([^<]*)<\/title>/i.exec(body)?.[1]?.trim();
    const text = body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    return [title, text.slice(0, 90)].filter(Boolean).join('\n');
  }
  /**
   * markdown / code — **書き出しは中身から取る**（2026-08-26）。
   *
   * 前は最初の塊をそのまま取っていたが、markdown の1つめはたいてい題（`# 競合表`）で、
   * それは**カードのタイトルと同じもの**だった。サムネイルは「実際の書き出しを出して
   * 見分けられるようにする」ためにあるのに、**どの成果物も題を2回書くだけ**になっていた。
   * 見出しを飛ばして本文か箇条書きを先に探し、**それが無いときだけ**見出しに戻る。
   */
  const bs = blocks(body);
  const first = bs.find((b) => b.t === 'para' || b.t === 'list') ?? bs.find((b) => b.t === 'head');
  if (first?.t === 'para' || first?.t === 'head') return plain(first.kids).slice(0, 90);
  if (first?.t === 'list') return first.items.slice(0, 3).map((x) => `・${plain(x)}`).join('\n');
  return body.replace(/^#.*\n/, '').slice(0, 90);
}

/* ══════════════ 印刷（PDF）══════════════ */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inlineHtml = (kids: { t: string; s: string; href?: string }[]): string =>
  kids.map((k) => {
    if (k.t === 'bold') return `<b>${esc(k.s)}</b>`;
    if (k.t === 'code') return `<code>${esc(k.s)}</code>`;
    if (k.t === 'link') return `<a href="${esc(k.href ?? '')}">${esc(k.s)}</a>`;
    return esc(k.s);
  }).join('');

function blockHtml(b: Block): string {
  switch (b.t) {
    case 'head': return `<h${b.level}>${inlineHtml(b.kids)}</h${b.level}>`;
    case 'rule': return '<hr>';
    case 'quote': return `<blockquote>${inlineHtml(b.kids)}</blockquote>`;
    case 'code': return `<pre>${esc(b.lines.join('\n'))}</pre>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</${tag}>`;
    }
    case 'table':
      return `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
        + `<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    default: return `<p>${inlineHtml(b.kids)}</p>`;
  }
}

/**
 * 印刷に回す1枚。**画面の黒をそのまま刷らない** — 紙は白で、文字は黒。
 * ここだけはデザイン言語の外（人に送るものであって、アプリの中の面ではない）。
 *
 * ページ（LP）は**社員が書いた HTML をそのまま刷る**（体裁もその HTML のもの）。
 */
export function printable(title: string, body: string, kind?: string, src?: string): string {
  const f = formatOf(kind, body);
  if (f.shape === 'html') return body;
  /**
   * **画像は紙いっぱいに1枚**（2026-08-27）。本文（何を頼んだか）はその下に小さく。
   * 中身が無いのに刷らない — 道が無ければ、いつもの組み方に落とす。
   */
  if (f.shape === 'image' && src) {
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{margin:14mm}body{margin:0;font:13px/1.7 system-ui,sans-serif;color:#111}
img{display:block;width:100%;height:auto;max-height:220mm;object-fit:contain}
p{white-space:pre-wrap;margin:10mm 0 0;color:#444}</style></head>
<body><img src="${esc(src)}" alt="${esc(title)}"><p>${esc(body)}</p></body></html>`;
  }

  const inner = f.shape === 'csv'
    ? blockHtml({ t: 'table', head: readCsv(body)[0] ?? [], rows: readCsv(body).slice(1) })
    : f.shape === 'code'
      ? `<pre>${esc(body)}</pre>`
      : blocks(body).map(blockHtml).join('\n');

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: system-ui, "Noto Sans JP", sans-serif; font-weight: 400;
         color: #111; font-size: 11pt; line-height: 1.8; margin: 0; }
  h1 { font-size: 19pt; margin: 0 0 6pt; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; }
  h1, h2, h3 { font-weight: 400; break-after: avoid; }
  p, li { margin: 0 0 6pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 14pt 0; }
  blockquote { margin: 8pt 0; padding-left: 10pt; border-left: 2px solid #ccc; color: #444; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 10pt; background: #f4f4f4; padding: 0 2pt; }
  pre { font-family: ui-monospace, Menlo, monospace; font-size: 9.5pt; line-height: 1.6;
        background: #f7f7f7; padding: 8pt; white-space: pre-wrap; break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; break-inside: avoid; }
  th, td { border: 1px solid #ddd; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; font-weight: 400; }
  a { color: #1a56c4; }
  .t { font-size: 22pt; margin: 0 0 16pt; }
</style></head><body>
<div class="t">${esc(title)}</div>
${inner}
</body></html>`;
}
