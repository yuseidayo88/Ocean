import { pumpCompany } from '@/app/actions/run';
import { asRunner, runnerReady } from '@/lib/run/runner';

/**
 * **1時間ごとに、会社が自分で進む**（2026-08-25。社長が「1時間ごと・上限つき」を選んだ）。
 *
 * 器（Shell）のポンプは「開いているあいだ」しか動かない。閉じているあいだも進むのがここ。
 * 進め方は画面とまったく同じ `pumpCompany` — **2つ目の実行系を作らない**。
 * 走りすぎは**1日の上限**が受ける（→ `lib/run/budget.ts`）。上限に当たったら静かに帰る。
 *
 * 誰として読み書きするかは `lib/run/runner.ts`（ふつうにログインした「もう1人」）。
 * **設定が無いときは、無いと言って帰る** — 動いているふりをしない。
 */

export const dynamic = 'force-dynamic';
/** 1タスクが1往復ぶん。layout の maxDuration はこのセグメントには効かない */
export const maxDuration = 300;

/** 1回の Cron で進めるタスクの数。**まとめて走らせない**（上限に当たる場所を1か所に保つ） */
const PER_TICK = 4;
/** 時間切れで途中で殺されないように、自分で先に止まる */
const BUDGET_MS = 230_000;

export async function GET(req: Request) {
  /**
   * **鍵が無いなら開けない。** ここは押せば料金が減る口なので、
   * 「まだ設定していないから素通し」は一番やってはいけない形。
   * Vercel Cron は `CRON_SECRET` があると自動で Bearer を付けて呼ぶ。
   */
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, why: 'CRON_SECRET が設定されていません' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!runnerReady()) {
    return Response.json({ ok: false, why: 'runner が設定されていません' }, { status: 503 });
  }

  const began = Date.now();
  const out = await asRunner(async () => {
    const ran: string[] = [];
    let why: string | undefined;
    for (let i = 0; i < PER_TICK; i++) {
      if (Date.now() - began > BUDGET_MS) { why = 'time'; break; }
      const r = await pumpCompany();
      if (!r.ran) { why = r.why; break; }
      ran.push(r.taskId);
    }
    return { ran, why };
  });
  // asRunner が入れなかったとき（形が違う）は、そのまま正直に返す
  if ('runner' in out) return Response.json({ ok: false, why: out.runner }, { status: 503 });
  return Response.json({ ok: true, ...out, ms: Date.now() - began });
}
