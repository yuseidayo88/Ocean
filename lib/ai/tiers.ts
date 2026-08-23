/**
 * 階層は3つだけ。コードは階層名しか知らない。
 * どのモデルを当てるかは、ここの表を書き換えるだけで切り替わる。
 * （→ docs/design/05-tech-and-cost.md「ModelProvider を1枚挟む」）
 *
 * **通り道は OpenRouter**（2026-08 に方針を変えた → 05 の判断ログ）。
 * 直につなぐ道（`anthropic` / `openai`）は残してあるので、
 * `vendor` を書き換えるだけで戻せる。
 */
export const TIERS = ['fast', 'standard', 'deep'] as const
export type Tier = (typeof TIERS)[number]

export type Vendor = 'openrouter' | 'anthropic' | 'openai'

export interface TierSpec {
  vendor: Vendor
  /**
   * モデルの名前。**vendor によって書き方が違う。**
   *   openrouter → `<提供元>/<モデル>`（例 `anthropic/claude-opus-5`）
   *   anthropic / openai → そのまま（例 `claude-opus-5`）
   */
  model: string
  /** 直につないだときの名前。OpenRouter が使えないときの逃げ道 */
  direct: string
  /** 100万トークンあたりの単価（USD）。原価の計算に使う。**画面には出さない** */
  inPerMTok: number
  outPerMTok: number
}

/**
 * **単価は Anthropic 直の定価。** OpenRouter は推論に上乗せしないが、
 * クレジット購入時に手数料がかかる（BYOK なら当面ゼロ）。
 * ここは原価の見積もりに使うだけなので、定価で持つ。
 */
export const TIER_TABLE: Record<Tier, TierSpec> = {
  // 軽い作業を速く。出力は「指示」ではなく「データ」を書かせる
  fast: {
    vendor: 'openrouter', model: 'anthropic/claude-haiku-4.5', direct: 'claude-haiku-4-5',
    inPerMTok: 1, outPerMTok: 5,
  },
  // ふだんの仕事
  standard: {
    vendor: 'openrouter', model: 'anthropic/claude-sonnet-5', direct: 'claude-sonnet-5',
    inPerMTok: 3, outPerMTok: 15,
  },
  // むずかしい判断。統括AI（計画・判断・会話）は常にここ
  deep: {
    vendor: 'openrouter', model: 'anthropic/claude-opus-5', direct: 'claude-opus-5',
    inPerMTok: 5, outPerMTok: 25,
  },
}

export function costUsd(tier: Tier, inTok: number, outTok: number): number {
  const s = TIER_TABLE[tier]
  return (inTok / 1e6) * s.inPerMTok + (outTok / 1e6) * s.outPerMTok
}
