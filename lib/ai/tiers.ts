/**
 * 階層は3つだけ。コードは階層名しか知らない。
 * どのモデルを当てるかは、ここの表を書き換えるだけで切り替わる。
 * （→ docs/design/05-tech-and-cost.md「ModelProvider を1枚挟む」）
 *
 * **通り道は OpenRouter**（2026-08 に方針を変えた → 05 の判断ログ）。
 * 直につなぐ道（`anthropic` / `openai`）は残してあるので、
 * `vendor` を書き換えるだけで戻せる。
 */
import { modelOf, type Effort, type ModelSpec } from './catalog'

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
 * 表のモデルが一覧（`lib/ai/catalog.ts`）に無いときだけ使う名前。
 * **ふつうは使われない** — 一覧にあれば、そちらの `label` がそのまま出る。
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
  /**
   * むずかしい判断。**統括AIの計画とフェーズ送りはここ**（会話は fast）。
   *
   * **2026-08-26 に Luna → Luna Pro に上げた。** ロードマップは
   * この製品でいちばん大事な出力なのに、5.6 一家でいちばん知能指数の低い
   * モデル（Luna 52.3）が引いていた。Luna Pro は**同じ素体を
   * `reasoning.mode = pro` で出したもので、単価はまったく同じ**
   * （$0.2 / $1.2。2026-08-26 に OpenRouter の一覧で確認）。
   * **タダで上がるので、断る理由が無かった。**
   */
  deep: {
    vendor: 'openrouter', model: 'openai/gpt-5.6-luna-pro', direct: 'gpt-5.6-luna-pro',
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

/** その階層で実際に呼ぶモデルの名前（→ `resolve`） */
export function modelFor(tier: Tier, chosen?: string): string {
  return resolve(tier, chosen).name
}

/**
 * **社長に見せる名前。** 表のモデルで走っているなら `MODEL_LABEL`、
 * 選んだモデルならその名前、env で差し替えているならその文字列をそのまま
 * （画面が嘘をつかない）。
 */
export function labelFor(tier: Tier, chosen?: string): string {
  return resolve(tier, chosen).label
}

/**
 * **その往復で本当に呼ぶモデル。** 順番は
 *   ① env の指定（`OPENROUTER_MODEL_DEEP` など。運用の逃げ道なので、いちばん強い）
 *   ② `OPENROUTER_FREE_TEST=1` かつ本番でなければ**ただのモデル**
 *   ③ **社長が選んだモデル**（メンバー画面。表に載っているものだけ）
 *   ④ 階層の表（既定）
 *
 * `known` ＝ 単価を知っているか。知らないもの（無料のテスト・env の差し替え）は
 * **0 で記帳する** — 定価で数えると、タダの実行がトライアル残高を減らす。
 */
export function resolve(tier: Tier, chosen?: string): {
  name: string; label: string; inPerMTok: number; outPerMTok: number; known: boolean; spec?: ModelSpec
} {
  const t = TIER_TABLE[tier]
  const named = process.env[`OPENROUTER_MODEL_${tier.toUpperCase()}`]
  if (named) return { name: named, label: named, inPerMTok: 0, outPerMTok: 0, known: false }
  if (process.env.OPENROUTER_FREE_TEST === '1' && process.env.APP_ENV !== 'production') {
    return { name: TEST_MODEL, label: TEST_MODEL, inPerMTok: 0, outPerMTok: 0, known: false }
  }
  const spec = modelOf(chosen)
  /**
   * **直つなぎのときは、通り道と同じ会社のモデルだけ選ばせる。**
   * OpenAI に直つなぎしている器へ `claude-opus-5` を渡しても通らない
   * （OpenRouter を通しているあいだは、どの会社のモデルでも1本で行ける）。
   */
  if (spec && (t.vendor === 'openrouter' || t.vendor === spec.vendor)) {
    return {
      name: t.vendor === 'openrouter' ? spec.id : spec.direct, label: spec.label,
      inPerMTok: spec.inPerMTok, outPerMTok: spec.outPerMTok, known: true, spec,
    }
  }
  const table = modelOf(t.model)
  return {
    // **表のモデルの名前をそのまま出す。** ここを1つの定数に固定していたので、
    // 階層ごとに違うモデルを当てた瞬間に画面が嘘をついた（deep だけ Luna Pro になった日）
    name: t.vendor === 'openrouter' ? t.model : t.direct, label: table?.label ?? MODEL_LABEL,
    inPerMTok: t.inPerMTok, outPerMTok: t.outPerMTok, known: true, spec: table,
  }
}

export function costUsd(tier: Tier, inTok: number, outTok: number, chosen?: string): number {
  const r = resolve(tier, chosen)
  return (inTok / 1e6) * r.inPerMTok + (outTok / 1e6) * r.outPerMTok
}

/**
 * 台帳に落とす原価。**単価を知っているモデルで走ったときだけ**数える。
 * 無料のテストモデル（Ox Alpha）や env で差し替えたモデルの単価は知らないので、
 * **知らない値は 0 で記帳する**。
 * 本当の実測（OpenRouter の usage の cost）は鍵が入って確かめてから。
 */
export function billedCostUsd(tier: Tier, inTok: number, outTok: number, chosen?: string): number {
  const r = resolve(tier, chosen)
  return r.known ? costUsd(tier, inTok, outTok, chosen) : 0
}

/**
 * **設定していないときの姿。** 画面はここを出し、実行もここで走る（食い違わせない）。
 *
 * ・統括AI（`exec`）は計画と判断が仕事なので `deep` の表のモデル・やや深め。
 *   **会話の返事だけは、深さを使わず速く返す**（→ `lib/exec/chat.ts`）
 * ・AI社員は `standard` の表のモデル・浅め（1タスク=1往復を速く回す）
 */
export const DEFAULT_PREF: Record<'exec' | 'employee', { model: string; effort: Effort }> = {
  exec: { model: TIER_TABLE.deep.model, effort: 'high' },
  employee: { model: TIER_TABLE.standard.model, effort: 'low' },
}
