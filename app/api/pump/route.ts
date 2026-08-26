import { pumpCompany } from '@/app/actions/run';

/**
 * **器のポンプの口**（2026-08-26）。
 *
 * 中身は画面と同じ `pumpCompany` — **2つ目の実行系は作らない**。
 * 変えたのは**呼び方**だけで、理由は1つ:
 *
 * サーバーアクションは**同じ画面のぶんが順番待ちになる**。
 * ポンプは1往復ぶん（決め打ちで約3秒、本物のモデルなら数十秒）返らないので、
 * そのあいだ **`getWork` も `homeData` も後ろで待つ** —
 * 動いているのに画面は「待機」のまま固まり、走り終わってからいきなり「要確認」になる
 * （実測: 承認から 14秒なにも変わらず、0.5秒で2件が完了に飛んだ）。
 * **動いているところを見せる**のがこの製品の売りなので、これは直さないといけない。
 *
 * 道筋（route handler）は順番待ちに入らないので、走っているあいだも読み直しが通る。
 * 誰として読み書きするかは変わらない（社長の cookie のまま）。
 */

export const dynamic = 'force-dynamic';
/** 1タスクが1往復ぶん。layout の maxDuration はこのセグメントには効かない */
export const maxDuration = 300;

export async function POST() {
  try {
    const r = await pumpCompany();
    return Response.json(r);
  } catch {
    // 倒れても画面は動き続ける（次の回でまた来る）
    return Response.json({ ran: false, why: 'error' });
  }
}
