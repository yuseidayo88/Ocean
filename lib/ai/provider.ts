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

/**
 * **思考の深さ。** どれだけ考えてから答えるかで、**モデルは変わらない**
 * （→ CLAUDE.md「モデルは変わらない。`tierFor(effort)` にモデルを選ばせない」）。
 * 画面のつまみ（`EffortInline`）はこの5段に対応する。
 *
 * 前はここに口が無く、代わりに `tierFromEffort` が**深さでモデルを切り替えて**いた。
 * 決めごとと逆のものが、使われないまま残っていた。
 */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export interface RunInput {
  tier: Tier
  /** 変わらない前置き。ここをキャッシュの境目にする */
  system: string
  messages: Msg[]
  tools?: ToolDef[]
  /**
   * **道具を必ず1つ使わせるか。** 既定は `auto`（使うかどうかはモデルが決める）。
   * `required` は「この往復は必ずカードになる」と**こちらが先に知っている**ときだけ
   * （入口の最初の一言など）。ふつうの会話に付けると、雑談にまで道具を呼ぶ。
   */
  toolChoice?: 'auto' | 'required'
  maxTokens?: number
  /** 思考の深さ。省略すると各社の既定 */
  effort?: Effort
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
  /**
   * **道具を使いはじめた。** 引数はまだ届いていない（名前だけ分かる）。
   * 画面に「いま何をしているか」を出すためだけのもの — 中身は `tool_use` で来る。
   * 名前が分かるのは引数より**ずっと早い**ので、待っているあいだの表示に使える。
   */
  | { type: 'tool_begin'; name: string }
  /**
   * **考えている中身**（モデルが思考を開示するときだけ流れてくる）。
   * 画面の「考えています」を、実際の思考の断片に差し替えるためのもの。
   * 出さないモデルも多い（OpenAI 系は非公開）— 無いときは無いまま。
   */
  | { type: 'think'; text: string }
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
