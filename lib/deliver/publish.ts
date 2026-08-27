/**
 * **公開する**（2026-08-27。社長の「他のやつから順に」の③）。
 *
 * AI社員は LP を書ける（`page` の成果物）。でも**出し先がなかった** —
 * 書いたものはアプリの中にしかなく、⬇ で落として自分でどこかに上げるしかない。
 * 一人社長にそれをやらせるなら、**作れたことに意味がない**。
 *
 * ## 決めたこと
 *
 * - **出し先はこのアプリ自身**（`/p/<slug>`）。外の業者の鍵を待たない。
 *   Cloudflare も Vercel も要らないので、**いま動く**
 * - **公開は社長が押したときだけ**（外に出る道具は Approval 必須）。
 *   しかも**承認済の成果物だけ** — 見ていないものを世に出さない
 * - **script は落とす。** 出すのは自分のオリジンなので、置いたままにすると
 *   その script は**このアプリの名前で**走る。LP に script は要らないので落とし、
 *   落としたことは社長に言う（**黙って中身を変えない**）。
 *   さらに CSP の `script-src 'none'` で二重に止める（落とし漏れても走らない）
 * - **公開したのは押した時点のもの。** あとから直しても勝手には変わらない —
 *   もう一度押せば入れ替わる（`published_at` も更新される）
 */

/** 落とすもの。**中身ごと消す**（閉じ札だけ消すと、中の文字が地の文に出る） */
const KILL_BLOCK = /<(script|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi;
/** 閉じ札の無い書き方（`<script src=…>` を閉じずに置く）も落とす */
const KILL_OPEN = /<(script|iframe|object|embed)\b[^>]*\/?>/gi;
/** `onclick=` の類。引用符あり・無しの両方 */
const KILL_ON = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
/** `href="javascript:…"` と `src="data:text/html…"` */
const KILL_URL = /\b(href|src|action|formaction|xlink:href)\s*=\s*("|')?\s*(javascript:|data:text\/html)[^"'>\s]*("|')?/gi;
/** `<meta http-equiv="refresh" …>`（押していないのに別の場所へ飛ばす） */
const KILL_META = /<meta\b[^>]*http-equiv\s*=\s*("|')?refresh[^>]*>/gi;

export type Cleaned = { html: string; removed: string[] };

/**
 * 公開できる形にする。**落としたものは名前で返す**（社長が読める言葉で）。
 * 消すだけで、書き足しはしない — 社長が見た成果物と、公開したものを離さない。
 */
export function clean(src: string): Cleaned {
  const removed: string[] = [];
  let out = src;
  const cut = (re: RegExp, say: string) => {
    const before = out;
    out = out.replace(re, '');
    if (out !== before) removed.push(say);
  };
  cut(KILL_BLOCK, 'script などの動くもの');
  cut(KILL_OPEN, 'script などの動くもの');
  cut(KILL_ON, '押したときに走る指定（onclick など）');
  cut(KILL_URL, 'javascript: で始まる行き先');
  cut(KILL_META, '自動で別の場所へ飛ばす指定');
  return { html: out.trim(), removed: [...new Set(removed)] };
}

/**
 * 1枚の HTML にする。**丸ごとの HTML ならそのまま、断片なら包む** —
 * AI社員は `<section>` から書き始めることがある。
 * 題は `<title>` に入れる（タブとリンクの見出しになる）。
 */
export function pageHtml(title: string, body: string): string {
  const has = /<html[\s>]/i.test(body);
  if (has) return body;
  const t = esc(title);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
</head>
<body>
${body}
</body>
</html>`;
}

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * 行き先の名前。**題から作り、読めない題なら番号だけ**
 * （MCP の道具名と同じ決めごと — 英数字が残らなければ番号にする）。
 *
 * **後ろに短い符号を足す。** 題が同じでもぶつからないし、
 * 隣の会社の「/p/lp」を当てずっぽうで開かれることもない。
 */
export function slugOf(title: string): string {
  const base = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const tail = rand(7);
  return base ? `${base}-${tail}` : tail;
}

function rand(n: number): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';   // 見分けにくい 0 1 l o は使わない
  return [...b].map((x) => abc[x % abc.length]).join('');
}

/**
 * 公開できる成果物か。**理由を返す**（押せないボタンを黙って灰色にしない）。
 * `kind` は `page` だけ — 文章や表は「ページ」ではないので、出し先が違う。
 */
export function whyNot(kind: string | undefined, state: string, body: string): string | null {
  if (kind !== 'page') return 'ページの成果物だけ公開できます';
  if (state !== '承認済') return '承認したものだけ公開できます';
  if (!body.trim()) return '中身がありません';
  return null;
}
