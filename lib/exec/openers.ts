/**
 * 入口の最初の一言。**社長の発言として置く**ので、統括AIはこれを読んで道を見分ける。
 *
 * ここに置いてあるのは、**文言を1か所に持つため**だけではない。
 * この2つで始まった会話の1往復めは、**必ずカード（質問か候補か診断）になる**と
 * こちらが先に知っている — だから道具を必ず使わせる（`toolChoice: 'required'`）。
 * 「まだ決まっていない」と言ったのに、文章だけが返ってくるのを防ぐ。
 */
export type Entry = 'goal' | 'discovery' | 'import';

export const OPENER: Record<Entry, string> = {
  goal: '',
  discovery: '何をやればいいか、まだ決まっていません。条件から一緒に決めたいです。',
  import: 'すでに事業があります。いまの状態を見てもらって、次にやることを決めたいです。',
};

/**
 * チャットの見出し。**入口から始めたものには短い名前を付ける** —
 * 最初の一言をそのまま見出しにすると、左レールで切れて読めなくなる
 * （レールは 260px。入るのは16文字ほど）。
 */
export const TITLE: Record<Entry, string | undefined> = {
  goal: undefined,          // 書いたゴールの先頭を使う（store が刻む）
  discovery: '何をやるか決める',
  import: '事業を見てもらう',
};

/** その一言が入口のものか（＝この往復は必ずカードになる） */
export const isOpener = (text: string): boolean =>
  text === OPENER.discovery || text === OPENER.import;
