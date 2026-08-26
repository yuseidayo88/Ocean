/**
 * **いつのことか、を1か所で言う**（2026-08-26）。
 *
 * 前は通知の画面にだけ `ago()` があり、ほかの画面は
 * **ストアが「たった今」という文字を入れて渡していた**（メモリ版だけ）。
 * 本番のストアは何も入れないので、**本物の会社では日付がどこにも出ていなかった** —
 * 成果物にも、決めたことにも。
 *
 * 決めごとは1つ — **ストアが持つのは時刻（ISO）、言葉にするのは画面**。
 * 相対の言い方はサーバーで作ると古びる（「たった今」のまま1時間残る）。
 */
export function ago(at?: string): string {
  if (!at) return '';
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  if (min < 24 * 60) return `${Math.round(min / 60)}時間前`;
  return `${Math.round(min / (24 * 60))}日前`;
}
