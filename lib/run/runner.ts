import { createClient } from '@supabase/supabase-js';
import { runAs } from '@/lib/supabase/server';

/**
 * **runner ＝ 見ていないあいだ会社を進める「もう1人」**（2026-08-25）。
 *
 * Cron のリクエストには cookie が無いので、そのままでは RLS がどの行も返さない
 * （`private.current_account_id()` は `auth.uid()` を見る）。
 *
 * 取れた道は3つあった —
 *   ① service role の鍵      … 漏れたら全社が出る。`docs/RUNNING.md` で持たないと決めてある
 *   ② 専用の Postgres ロール … 書き込みの既定値（`account_id`）が埋まらないので、
 *                              往復ごとに口座を渡す仕組みが要る。PostgREST では渡せない
 *   ③ **ふつうにログインする** … ← これ
 *
 * ③ は**特別扱いがどこにも無い**のが効いている。ポリシー28本も、既定値22表も、
 * store のコードも、1行も変わらない。止めたければその利用者を消せば止まる。
 * 見えるのはその1社だけ。
 *
 * 複数社に開くときは「1社に1人の runner」になる（→ `docs/PLAN.md` 見送りの台帳）。
 * いま会社は1つなので、環境変数1組で足りる。
 */

/** 設定されているか。**無いのに「動いています」と言わない** */
export function runnerReady(): boolean {
  return !!(process.env.RUNNER_EMAIL && process.env.RUNNER_PASSWORD
    && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * runner としてログインして、その中で走らせる。
 * セッションは持ち歩かない（1回の Cron ぶんだけ）ので `persistSession: false`。
 */
export async function asRunner<T>(fn: () => Promise<T>): Promise<T | { runner: string }> {
  if (!runnerReady()) return { runner: '設定されていません' };
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await c.auth.signInWithPassword({
    email: process.env.RUNNER_EMAIL!, password: process.env.RUNNER_PASSWORD!,
  });
  const token = data.session?.access_token;
  // **入れなかったことを黙らない。** 上流の英語はそのまま出さない（画面には出ないがログに残る）
  if (error || !token) return { runner: 'ログインできませんでした' };
  return runAs(token, fn);
}
