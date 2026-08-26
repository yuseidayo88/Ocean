/**
 * **ポンプを起こす。**
 *
 * ポンプは器（`Shell`）に1つだけあって、**動いているときは3秒、静かなときは15秒**で回る。
 * 静かなときの15秒は、何も起きていない会社を叩き続けないためのものだが、
 * **社長が押した直後にそれを待たされるのは別の話**だった —
 * 計画を承認してから最初のタスクが動き出すまで、実測で **14秒**なにも起きなかった
 * （2026-08-26。押した本人には、壊れているのと見分けがつかない）。
 *
 * だから「いま仕事が増えたはずだ」と分かっている側から、その場で起こす。
 * **2つ目のポンプは立てない** — 起こすだけで、走らせるのは器の1本のまま
 * （上限を測る場所が2か所にならない）。
 *
 * 画面の移動でも起きる（`Shell` が `pathname` を見ている）ので、
 * ここで呼ぶのは**移動しない操作**だけでいい — 判断に答える / 成果物を見る /
 * フェーズを進める / 止めた Work を動かす。
 */
export const WAKE = 'onefound:wake';

export function wakePump() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WAKE));
}

/**
 * **1回に1本だけ。**
 *
 * 器のポンプは画面が変わるたびに起こし直す（そのほうが速い）ので、
 * 続けて画面を移ると**前の1本が返る前に次が出る**。取り合いそのものは
 * `startRun` の atomic な置き換えが捌くが、**同じ瞬間に2本走らせる理由が無い**ので
 * ここで止める。走っている最中の呼び出しは、その1本の結果を待って同じものを受け取る。
 *
 * 呼び方を**サーバーアクションではなく道筋（`/api/pump`）**にしている理由は
 * `app/api/pump/route.ts` を参照。
 */
let inflight: Promise<boolean> | null = null;

export function pumpNow(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch('/api/pump', { method: 'POST' });
      return !!((await r.json()) as { ran?: boolean }).ran;
    } catch {
      return false; // 次の回でまた来る
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
