/**
 * **思い出す**（Hermes Agent の cross-session recall。2026-08-26）。
 *
 * あちらは「過去のセッションを検索して、要約して思い出す」。
 * OneFound がこれまで渡していたのは —
 *   ・その Work の済んだ成果物3件（本文）
 *   ・承認された成果物の**タイトルだけ**（最新5件）
 *   ・決めたこと（その Work のぶん）
 * つまり**別の Work で調べたことの中身は、どこからも届いていなかった**。
 * 「会社がもう知っていることは、二度調べません」と憲法に書いてあるのに、
 * 知っているものを渡していなかった。
 *
 * **往復は増やさない。** 読む道具（`recall`）をモデルに渡すと1タスク=1往復が崩れるので、
 * **こちらが先に引いて、依頼文に載せる**。タダで、待たせない。
 * 足りなければ社長が資料を渡す道（チャットの ＋）が別にある。
 */

/**
 * 探す言葉を取り出す。
 *
 * 日本語には語の境目が無いので、**ひらがなを捨てて、漢字・カタカナ・英数の連なりだけ**を拾う。
 * 「収益モデルを比べる」→「収益」「モデル」。乱暴だが、
 * 形態素解析を積むより**ずれ方が読める**（外したときに理由が分かる）。
 *
 * **どこにでも当たる言葉は捨てる** — 「会社」「今回」で探すと全部当たって、
 * 思い出したことにならない。
 */
const STOP = new Set([
  '会社', '今回', '内容', '作成', '確認', '情報', '場合', '以下', '以上', '対応',
  '実施', '検討', '結果', '必要', '可能', '一覧', '資料', '状況', '全体', '部分',
]);

export function termsOf(text: string, max = 4): string[] {
  const hits = (text || '').match(
    /[一-鿿々]{2,}|[゠-ヿー]{2,}|[A-Za-z][A-Za-z0-9-]{2,}/g,
  ) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    // **PostgREST の `or()` に入る形にする** — カンマと丸括弧は絞り込みの区切り
    const t = h.replace(/[,()*%.]/g, '').slice(0, 12);
    if (t.length < 2 || seen.has(t) || STOP.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** 思い出したものを、依頼文の1節に畳む。**無ければ節ごと出さない** */
export function recallBlock(rows: { kind: string; title: string; snippet: string }[]): string[] {
  if (!rows.length) return [];
  return [
    '',
    '会社がすでに知っていること（**二度調べない**。前提として使う）:',
    ...rows.map((r) => `--- ${r.kind}: ${r.title} ---\n${r.snippet}`),
  ];
}
