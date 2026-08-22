/**
 * 階層は3つだけ。コードは階層名しか知らない。
 * どのモデルを当てるかは、ここの表を書き換えるだけで切り替わる。
 * （→ docs/design/05-tech-and-cost.md「ModelProvider を1枚挟む」）
 */
export const TIERS = ['fast', 'standard', 'deep'] as const
export type Tier = (typeof TIERS)[number]

export type Vendor = 'anthropic' | 'openai'

export interface TierSpec {
  vendor: Vendor
  model: string
  /** 100万トークンあたりの単価（USD）。原価の計算に使う。画面には出さない */
  inPerMTok: number
  outPerMTok: number
}

export const TIER_TABLE: Record<Tier, TierSpec> = {
  // 軽い作業を速く。出力は「指示」ではなく「データ」を書かせる
  fast:     { vendor: 'anthropic', model: 'claude-haiku-4-5-20251001', inPerMTok: 1,  outPerMTok: 5 },
  // ふだんの仕事
  standard: { vendor: 'anthropic', model: 'claude-sonnet-5',           inPerMTok: 3,  outPerMTok: 15 },
  // むずかしい判断。統括AI（計画・判断・会話）は常にここ
  deep:     { vendor: 'anthropic', model: 'claude-opus-5',             inPerMTok: 5,  outPerMTok: 25 },
}

/** 思考の深さ（0〜100 のスライダー）から階層を決める */
export function tierFromEffort(effort: number): Tier {
  if (effort < 34) return 'fast'
  if (effort < 74) return 'standard'
  return 'deep'
}

export function costUsd(tier: Tier, inTok: number, outTok: number): number {
  const s = TIER_TABLE[tier]
  return (inTok / 1e6) * s.inPerMTok + (outTok / 1e6) * s.outPerMTok
}
