/**
 * **成果物のマークダウンを、器の要らない形に読む**（2026-08-25）。
 *
 * ここまで成果物の本文は `<pre>` に流し込んでいた。読めはするが、
 * `## 見出し` も `|---|---|` も記号のまま出ていて、**社長が人に見せられる形ではなかった**。
 * 社長の指示「文章だけでなく、LPやPDFや様々な出力できるようにしたい」の土台がここ —
 * 画面に描くのも、印刷（PDF）に回すのも、**同じ読み方から**分かれる。
 *
 * ライブラリは入れない。受けるのは**成果物に実際に出てくる7つだけ**で、
 * それ以上は素の段落にする（チャットの本文が3つだけ受けるのと同じ考え方）。
 */

export type Inline =
  | { t: 'text'; s: string }
  | { t: 'bold'; s: string }
  | { t: 'code'; s: string }
  | { t: 'link'; s: string; href: string };

export type Block =
  | { t: 'head'; level: 1 | 2 | 3; kids: Inline[] }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'code'; lang: string; lines: string[] }
  | { t: 'quote'; kids: Inline[] }
  | { t: 'rule' }
  | { t: 'para'; kids: Inline[] };

/** `**強調**` / `` `コード` `` / `[文字](url)` の3つだけ。あとは素の文字 */
export function inline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > at) out.push({ t: 'text', s: src.slice(at, m.index) });
    if (m[1] != null) out.push({ t: 'bold', s: m[1] });
    else if (m[2] != null) out.push({ t: 'code', s: m[2] });
    // **行き先の無いリンクにしない** — http(s) と素の path 以外は文字として出す
    else if (m[4] && /^(https?:\/\/|\/)/.test(m[4])) out.push({ t: 'link', s: m[3], href: m[4] });
    else out.push({ t: 'text', s: m[0] });
    at = m.index + m[0].length;
  }
  if (at < src.length) out.push({ t: 'text', s: src.slice(at) });
  return out.length ? out : [{ t: 'text', s: '' }];
}

/** 表の1行 `| a | b |` を割る。両端の `|` は落とす */
const cells = (line: string): string[] =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

const isSep = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');

/** 本文を段落の列に読む。**読めなかったものは段落**（捨てない） */
export function blocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (!para.length) return;
    out.push({ t: 'para', kids: inline(para.join(' ')) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (!raw.trim()) { flush(); continue; }

    // ``` で囲まれたところは、中を読まずにそのまま持つ
    const fence = /^\s*```(\w*)/.exec(raw);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ t: 'code', lang: fence[1] ?? '', lines: body });
      continue;
    }

    const head = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (head) {
      flush();
      out.push({ t: 'head', level: Math.min(3, head[1].length) as 1 | 2 | 3, kids: inline(head[2]) });
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) { flush(); out.push({ t: 'rule' }); continue; }

    // 表は「見出しの行 ＋ 区切りの行」がそろったときだけ表にする
    if (raw.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const head0 = cells(raw);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) rows.push(cells(lines[i]));
      i--;
      out.push({ t: 'table', head: head0, rows });
      continue;
    }

    const item = /^\s*([-*・]|\d+[.)])\s+(.*)$/.exec(raw);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const last = out[out.length - 1];
      if (last?.t === 'list' && last.ordered === ordered) last.items.push(inline(item[2]));
      else out.push({ t: 'list', ordered, items: [inline(item[2])] });
      continue;
    }

    if (/^\s*>\s?/.test(raw)) { flush(); out.push({ t: 'quote', kids: inline(raw.replace(/^\s*>\s?/, '')) }); continue; }

    para.push(raw.trim());
  }
  flush();
  return out;
}

/** 素の文字だけ取り出す（書き出しや `<title>` に使う） */
export const plain = (kids: Inline[]): string => kids.map((k) => k.s).join('');
