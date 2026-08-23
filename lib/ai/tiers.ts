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
  /**
   * **Anthropic 直**につないだときの名前。OpenRouter が使えないときの逃げ道。
   * `vendor: 'openai'` に切り替えるなら、この表ごと OpenAI のモデル名に書き換えること
   * （`direct` は Anthropic の名前しか持っていない）。
   */
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

/**
 * **試すあいだ、ただで動かすためのモデル。**
 *
 * `stealth/ox-alpha`（Ox Alpha）— $0/M・道具（tools）対応・100万トークン。
 * 稼働 99.99%（実測 2026-08-24）。統括AIは1往復で道具を5つ呼ぶので、
 * **tools 対応であることが絶対条件**。無料モデルの多くは非対応で、そこで落ちる。
 *
 * **本番では使わない。** `stealth/` は前触れなく消える枠なので、
 * `APP_ENV=production`（Cloudflare の本番。`wrangler.jsonc`）では表のモデルに戻る。
 * env で明示すれば、そちらが常に勝つ。
 */
export const TEST_MODEL = 'stealth/ox-alpha'

/**
 * その階層で実際に呼ぶモデルを決める。順番は
 *   ① env の指定（`OPENROUTER_MODEL_DEEP` など）
 *   ② 本番でなければ**ただのモデル**
 *   ③ 表のモデル（有料）
 */
export function modelFor(tier: Tier): string {
  const named = process.env[`OPENROUTER_MODEL_${tier.toUpperCase()}`]
  if (named) return named
  if (process.env.APP_ENV !== 'production') return TEST_MODEL
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
