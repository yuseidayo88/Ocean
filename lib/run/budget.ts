/**
 * **1日に使えるぶん**（2026-08-25。社長が「1時間ごと・上限つき」を選んだ）。
 *
 * 見ていないあいだも会社が進むようにした以上、**目を離しているうちに
 * どこまで使うか**が決まっていないと社長は安心して閉じられない。
 * 残高（`balanceCents`）は「もう無い」を言う線で、これは「きょうはここまで」の線。
 * 当たり方も違う —
 *   残高が尽きた → **Work ごと paused**（設計の言葉どおり「paused = 予算上限」）。
 *   きょうのぶんが尽きた → **止まるだけ。あすまた動く**（Work の状態は変えない）。
 *
 * 数字は `token_ledger` の実績から数える。**申告ではなく記帳**なので、
 * 走らせる前に見積もる必要がない（走った実行は必ず引き金で1行入る → 0014）。
 */

const DAY = 86_400_000;
/** 日本時間の時差。社長の1日は日本時間で数える（朝の報告と同じ考え方） */
const JST = 9 * 3_600_000;

/** いまが属する「きょう」のはじまり（ISO）。日本時間の 00:00 */
export function dayStart(now = Date.now()): string {
  return new Date(Math.floor((now + JST) / DAY) * DAY - JST).toISOString();
}

/** 通知の重複を止める鍵（`cap-2026-08-25`）。朝の報告の `morning-` と同じ作法 */
export function dayKey(now = Date.now()): string {
  return `cap-${new Date(now + JST).toISOString().slice(0, 10)}`;
}

/**
 * 1日の上限（セント）。**0 以下にすると上限なし**。
 * 既定 200セント = 20万トークン — トライアル残高（500セント）が
 * 目を離しているうちに1日で溶けない線として置いた。`DAILY_CAP_CENTS` で変えられる。
 */
export function capCents(): number {
  const raw = Number(process.env.DAILY_CAP_CENTS);
  return Number.isFinite(raw) ? raw : 200;
}
