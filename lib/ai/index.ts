import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { TIER_TABLE, type Tier } from './tiers'
import type { ModelProvider } from './provider'
import { AppError } from '../errors'

export * from './provider'
export * from './tiers'

/**
 * 階層名からプロバイダを1つ返す。呼ぶ側はモデル名を知らない。
 * OpenRouter のような仲介は挟まない（→ 05-tech-and-cost.md 判断ログ）。
 */
export function providerFor(tier: Tier): ModelProvider {
  const { vendor } = TIER_TABLE[tier]
  if (vendor === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new AppError('upstream', 'ANTHROPIC_API_KEY is not set')
    return new AnthropicProvider(key)
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AppError('upstream', 'OPENAI_API_KEY is not set')
  return new OpenAIProvider(key)
}
