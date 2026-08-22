import type { Tier } from './tiers'

/**
 * 2社の違いを吸収する1枚。プロバイダごとに違うのは
 * 「キャッシュの指定」と「使える道具」だけ（→ 05-tech-and-cost.md）。
 */

export interface Msg {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolDef {
  name: string
  description: string
  /** JSON Schema */
  input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[]; [k: string]: unknown }
}

export interface RunInput {
  tier: Tier
  /** 変わらない前置き。ここをキャッシュの境目にする */
  system: string
  messages: Msg[]
  tools?: ToolDef[]
  maxTokens?: number
  signal?: AbortSignal
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type Chunk =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'done'; usage: Usage; stopReason: string | null }

export interface ModelProvider {
  readonly vendor: string
  /** 1ターン。ツールの実行はこの外側（AgentRunner）が回す */
  stream(input: RunInput): AsyncIterable<Chunk>
}

export const EMPTY_USAGE: Usage = {
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
}
