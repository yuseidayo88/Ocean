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
   *   openrouter → `<提供元>/<モデル>`（例 `openai/gpt-5.6-luna`）
   *   anthropic / openai → そのまま（例 `gpt-5.6-luna`）
   */
  model: string
  /**
   * **その提供元に直接つないだときの名前。** OpenRouter が使えないときの逃げ道で、
   * `vendor` を `openai` / `anthropic` に書き換えたときに使われる。
   * いまは3階層とも OpenAI なので、逃げ道も `openai`（`lib/ai/openai.ts`）。
   */
  direct: string
  /** 100万トークンあたりの単価（USD）。原価の計算に使う。**画面には出さない** */
  inPerMTok: number
  outPerMTok: number
}

/**
 * **通り道は OpenRouter、モデルは GPT-5.6 Luna**（2026-08-24 に社長が決めた）。
 * 理由は速さ — 「latency-sensitive な用途向けの速い・安いモデル」として出ている。
 *
 * **3階層とも同じモデルにしてある。** これは階層の設計を捨てたのではなく、
 * 「**深さ＝thinking の量。モデルは変わらない**」（→ CLAUDE.md）を素直に表した形。
 * 違いは `reasoning_effort` で付く（fast/standard は low、統括AIの計画は high）。
 * 階層ごとに別のモデルを当てたくなったら、この表を書き換えるだけで戻せる。
 *
 * **単価は OpenRouter の実測値**（2026-08-24 に `GET /api/v1/models` で確認）。
 * 27万トークンを超えると $0.4 / $1.8 に上がるが、こちらの依頼文はその桁に届かない
 * （いちばん長い統括AIの計画でも 16,000）ので、平の単価だけを持つ。
 */
/**
 * **画面に出す名前。** メンバーの行に「いま何で動いているか」を出すために使う。
 * 表のすぐ隣に置く — モデルを変えたら、ここも一緒に変える（画面が嘘をつかない）。
 * ※ 外に出す `/api/health` には出さない（構成を言わない、は変えない）。
 */
export const MODEL_LABEL = 'GPT-5.6 Luna'

export const TIER_TABLE: Record<Tier, TierSpec> = {
  // 軽い作業を速く（チャットの返事・成果物への一言）
  fast: {
    vendor: 'openrouter', model: 'openai/gpt-5.6-luna', direct: 'gpt-5.6-luna',
    inPerMTok: 0.2, outPerMTok: 1.2,
  },
  // ふだんの仕事（AI社員の実行）
  standard: {
    vendor: 'openrouter', model: 'openai/gpt-5.6-luna', direct: 'gpt-5.6-luna',
    inPerMTok: 0.2, outPerMTok: 1.2,
  },
  // むずかしい判断。統括AI（計画・判断・会話）は常にここ
  deep: {
    vendor: 'openrouter', model: 'openai/gpt-5.6-luna', direct: 'gpt-5.6-luna',
    inPerMTok: 0.2, outPerMTok: 1.2,
  },
}

/**
 * **ただで動かしたいときのモデル**（既定では使わない）。
 *
 * `stealth/ox-alpha`（Ox Alpha）— $0/M・道具（tools）対応・100万トークン。
 * 統括AIは1往復で道具を5つ呼ぶので、**tools 対応であることが絶対条件**。
 * 無料モデルの多くは非対応で、そこで落ちる。
 *
 * **既定から外した**（2026-08-24）。前は「本番以外は自動でこれ」だったので、
 * 表を書き換えても本番以外には効かず、**社長が選んだモデルで動いていなかった**。
 * ただで回したいときだけ `OPENROUTER_FREE_TEST=1` で明示的に呼ぶ。
 * `stealth/` は前触れなく消える枠なので、本番では使わない（下で弾く）。
 */
export const TEST_MODEL = 'stealth/ox-alpha'

/**
 * その階層で実際に呼ぶモデルを決める。順番は
 *   ① env の指定（`OPENROUTER_MODEL_DEEP` など）
 *   ② `OPENROUTER_FREE_TEST=1` かつ本番でなければ**ただのモデル**
 *   ③ 表のモデル（既定）
 */
export function modelFor(tier: Tier): string {
  const named = process.env[`OPENROUTER_MODEL_${tier.toUpperCase()}`]
  if (named) return named
  if (process.env.OPENROUTER_FREE_TEST === '1' && process.env.APP_ENV !== 'production') return TEST_MODEL
  return TIER_TABLE[tier].model
}

export function costUsd(tier: Tier, inTok: number, outTok: number): number {
  const s = TIER_TABLE[tier]
  return (inTok / 1e6) * s.inPerMTok + (outTok / 1e6) * s.outPerMTok
}

/**
 * 台帳に落とす原価。**表のモデルで走ったときだけ**表の単価で数える。
 * 無料のテストモデル（Ox Alpha）や env で差し替えたモデルの単価は知らないので、
 * **知らない値は 0 で記帳する** — 定価で数えると、タダの実行がトライアル残高を減らす。
 * 本当の実測（OpenRouter の usage の cost）は鍵が入って確かめてから。
 */
export function billedCostUsd(tier: Tier, inTok: number, outTok: number): number {
  if (modelFor(tier) !== TIER_TABLE[tier].model) return 0
  return costUsd(tier, inTok, outTok)
}
