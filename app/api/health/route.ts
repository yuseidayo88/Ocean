import { TIER_TABLE, TIERS } from '@/lib/ai/tiers'
import { errorResponse } from '@/lib/errors'
import { capCents } from '@/lib/run/budget'

/**
 * 土台が立っているかを1か所で見る。**鍵の中身は返さない。**
 * 階層とモデルの対応も返さない（外から叩けるので、構成を言わない）。
 */
export async function GET() {
  try {
    return Response.json({
      ok: true,
      runtime: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? 'node',
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      /** モデルに繋がるか。**どのモデルかは言わない** */
      model: TIERS.every((t) => Boolean(keyFor(TIER_TABLE[t].vendor))),
      /**
       * **見ていないあいだも会社が進むか**（1時間ごとの Cron）。
       * 鍵は返さない — 3つそろっているかどうかだけ。
       * 「設定したつもりが効いていない」をここで見つける（Google の入り口と同じ理由）。
       */
      cron: {
        secret: Boolean(process.env.CRON_SECRET),
        runner: Boolean(process.env.RUNNER_EMAIL && process.env.RUNNER_PASSWORD),
        capCents: capCents(),
      },
      /** どの入り口が開いているか（入口の画面に出ているものと同じ。隠す意味が無い） */
      ...await auth(),
    })
  } catch (e) {
    return errorResponse(e)
  }
}

const keyFor = (vendor: string) =>
  vendor === 'openrouter' ? process.env.OPENROUTER_API_KEY
    : vendor === 'anthropic' ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY

/**
 * **設定したつもりが効いていない、を無くす。**
 * Google の入り口を有効にする場所は3つに分かれていて（Google Cloud の
 * OAuth クライアント / Supabase の Provider / Supabase の戻り先の許可）、
 * どこか1つ抜けても画面では同じ「押しても入れない」に見える。
 * ここが `google: true` と言えば、少なくとも Supabase 側は開いている。
 *
 * 認証サーバーが答えないときは**黙って false にしない** — 分からないなら分からないと言う。
 */
async function auth(): Promise<Record<string, unknown>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { login: null, signup: null }
  try {
    const r = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    })
    if (!r.ok) return { login: 'unknown', signup: 'unknown' }
    const s = await r.json() as {
      external?: Record<string, boolean>; disable_signup?: boolean; mailer_autoconfirm?: boolean;
    }
    return {
      login: Object.fromEntries(Object.entries(s.external ?? {}).filter(([, v]) => v === true)),
      /** 新規登録が開いているか。`confirm` が true なら**確認メールを踏まないと入れない** */
      signup: { open: s.disable_signup !== true, confirm: s.mailer_autoconfirm !== true },
    }
  } catch {
    return { login: 'unknown', signup: 'unknown' }
  }
}
