import { TIER_TABLE, TIERS, tierFromEffort } from '@/lib/ai/tiers'
import { errorResponse } from '@/lib/errors'

/** 土台が立っているかを1か所で見る。鍵の中身は返さない */
export async function GET() {
  try {
    return Response.json({
      ok: true,
      runtime: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? 'node',
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      models: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
      tiers: Object.fromEntries(TIERS.map((t) => [t, TIER_TABLE[t].model])),
      effortMap: { 10: tierFromEffort(10), 50: tierFromEffort(50), 90: tierFromEffort(90) },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
