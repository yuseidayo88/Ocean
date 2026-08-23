import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { OpenRouterProvider } from './openrouter'
import { TIER_TABLE, type Tier } from './tiers'
import type { ModelProvider } from './provider'
import { AppError } from '../errors'

export * from './provider'
export * from './tiers'

/**
 * 階層名からプロバイダを1つ返す。**呼ぶ側はモデル名も通り道も知らない。**
 *
 * 既定は **OpenRouter**（→ 05-tech-and-cost.md の判断ログ・2026-08 に方針を変えた）。
 * 直につなぐ道も残してあるので、`TIER_TABLE` の `vendor` を書き換えるだけで戻せる。
 */
export function providerFor(tier: Tier): ModelProvider {
  const { vendor } = TIER_TABLE[tier]
  if (vendor === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new AppError('upstream', 'OPENROUTER_API_KEY is not set')
    return new OpenRouterProvider(key)
  }
  if (vendor === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new AppError('upstream', 'ANTHROPIC_API_KEY is not set')
    return new AnthropicProvider(key)
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AppError('upstream', 'OPENAI_API_KEY is not set')
  return new OpenAIProvider(key)
}

/** 鍵が1つでも入っているか。**入っていなければ決め打ちのプロバイダに落とす** */
export const hasKey = () => Boolean(
  process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
