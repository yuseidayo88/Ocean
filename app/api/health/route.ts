import { TIER_TABLE, TIERS } from '@/lib/ai/tiers'
import { errorResponse } from '@/lib/errors'

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
    })
  } catch (e) {
    return errorResponse(e)
  }
}

const keyFor = (vendor: string) =>
  vendor === 'openrouter' ? process.env.OPENROUTER_API_KEY
    : vendor === 'anthropic' ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY
