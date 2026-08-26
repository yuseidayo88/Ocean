import type { Effort } from './catalog'
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
  /**
   * **どのモデルで走るか**（通り道での名前 ＝ `lib/ai/catalog.ts` の `id`）。
   * 省略すると階層の表のモデル（`TIER_TABLE`）。社長がメンバー画面で選んだものが、
   * ここに入って**そのまま上流に届く** — 選べるのに効かない、を作らない。
   */
  model?: string
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
  /**
   * **この往復だけ Web を見るか**（2026-08-26）。
   *
   * 検索は**従量で課金される**ので、全部の往復に付けない。
   * 付けるのは「調べないと嘘になる」ところだけ — 候補を出すときと、調査担当の実行。
   * 会社ごとの入り切りは `webOn()` が持つ（→ `lib/ai/web.ts`）。
   */
  web?: boolean
  maxTokens?: number
  /** 思考の深さ。省略すると各社の既定。**受けない段はモデルに合わせて寄せる**（→ catalog） */
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
