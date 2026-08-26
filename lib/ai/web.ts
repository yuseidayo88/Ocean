import { store } from '@/lib/store';

/**
 * **会社が Web を見るかどうか**（2026-08-26。社長の「実際に需要があって〜」の最後の一歩）。
 *
 * ここまで、需要は**統括AIの記憶から**言っているだけだった。
 * 候補は自分から「まだ確かめていない」と名乗るようにしたが、
 * **本当に調べる**にはここを開けるしかない。
 *
 * ## 決めごと
 *
 * - **既定はオフ。** 検索は**従量で課金される**（トークンとは別に、1回いくら）。
 *   黙って有料にしない
 * - **社長が押す。** メンバー画面の「全員に効くこと」から入り切りする —
 *   環境変数だけだと、社長には触れない
 * - **付くのは往復ごと。** 全部に付けない。付けるのは
 *   **候補を出すとき**と**調査担当の実行**だけ（`RunInput.web`）
 * - 置き場は `agent_skills` の `source='learned'` と同じ考え方ではなく、
 *   **会社ぜんぶに効く設定**なので `agent_prefs` の統括AIの行（`employee_id` が null）に持つ。
 *   **表を増やさない**
 */

/** 会社が Web を見てよいか。**鍵が無ければ、押されていても false** */
export async function webOn(): Promise<boolean> {
  // 環境変数はこれまでどおり効く（検査と、会社ごとの設定を持たない環境のため）
  if (process.env.OPENROUTER_WEB === '1') return true;
  try {
    const prefs = await store().listPrefs();
    return prefs.some((p) => p.employeeId === null && p.web);
  } catch {
    return false;
  }
}
