import type { Tier } from './tiers'

/**
 * **選べるモデルの一覧。**
 *
 * ここまで「モデルは1つ」だった（→ `TIER_TABLE`）。社長が選べるようにしたので、
 * **選べる先はこの1枚が全部**になる — 画面のプルダウンも、実行に渡す名前も、
 * 原価の単価も、深さの段も、ここだけを見る。**2か所に書かない。**
 *
 * 決めごと（→ CLAUDE.md）:
 *   ・**Thinking 版を一覧に並べない。** それは深さの仕事
 *     （`openai/gpt-5.6-luna-pro` は Luna の thinking 版なので、ここには載せない）
 *   ・**深さ＝thinking の量。モデルは変わらない。**
 *     だから深さの段は**モデルごとの持ちもの**で、モデルを選ぶと段の数が変わる
 *   ・**受けない段は出さない。** 無い段を送るとその往復ごと弾かれる。
 *     Claude Haiku 4.5 は深さを受けない（別の指定の仕方をする）ので、段は空
 *   ・**単価は画面に出さない**（出していいのは請求とプランの画面だけ）。
 *     ここに持つのは原価の記帳のため
 *
 * **この環境から `openrouter.ai` に出られない**ので、**通り道での綴り（`id`）は
 * `openai/gpt-5.6-luna` だけが実測で確かめてある**（2026-08-24 の `GET /api/v1/models`）。
 * 残りは各社の名前から組んだもの。鍵が入ったら最初に一覧と突き合わせる（→ `docs/RUNNING.md`）。
 * 綴りが違っていたら、直すのは**この表の1行**か `OPENROUTER_MODEL_<階層>` の env。
 */

/**
 * **思考の深さ。** どれだけ考えてから答えるかで、**モデルは変わらない**。
 * 画面のつまみ（`EffortInline`）はこの段に1対1で対応する — **言葉と段を食い違わせない**
 * （前は段が5つ・言葉が6つで、つまみの位置がどの段を指すのか誰にも言えなかった）。
 */
export const EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

/** 深さの言葉。いちばん左は「考えずに答える」 */
export const EFFORT_WORD: Record<Effort, string> = {
  none: '考えずに答える',
  low: '浅め',
  medium: '標準',
  high: 'やや深め',
  xhigh: '深め',
  max: 'いちばん深く',
}

/** そのモデルが何に向いているか。**階層の語をそのまま使う**（新しい言い方を作らない） */
export const GRADE_WORD: Record<Tier, string> = {
  fast: '速い', standard: 'ふだん', deep: 'じっくり',
}

export type ModelSpec = {
  /** **保存されるのはこれ。** 通り道（OpenRouter）での名前 */
  id: string
  /** 直つなぎ（`vendor` に直接つないだとき）の名前 */
  direct: string
  vendor: 'anthropic' | 'openai'
  /** どこのモデルか。プルダウンの見出しになる */
  maker: 'Claude' | 'OpenAI'
  /** 画面に出す名前 */
  label: string
  /** 速い / ふだん / じっくり */
  grade: Tier
  /** **このモデルが受ける深さの段。**空なら深さを選べない（つまみごと出さない） */
  efforts: readonly Effort[]
  /** 100万トークンあたりの単価（USD）。**画面には出さない** */
  inPerMTok: number
  outPerMTok: number
}

/** Claude（4.6 以降）が受ける段。`none` は無い */
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
/** GPT-5.6 の3枚が受ける段（Luna は実測で6段を確認済み） */
const GPT_EFFORTS = EFFORTS

export const CATALOG: readonly ModelSpec[] = [
  /* ── Claude ─────────────────────────────────────────────
   * 名前と単価は Anthropic の一覧（2026-06 時点）。**Thinking 版は別に無い** —
   * どれも深さ（`output_config.effort`）で thinking の量が変わる。
   * Haiku 4.5 だけは深さを受けない（送ると往復ごと弾かれる）ので段を空にする。 */
  {
    id: 'anthropic/claude-opus-5', direct: 'claude-opus-5',
    vendor: 'anthropic', maker: 'Claude', label: 'Claude Opus 5',
    grade: 'deep', efforts: CLAUDE_EFFORTS, inPerMTok: 5, outPerMTok: 25,
  },
  {
    id: 'anthropic/claude-sonnet-5', direct: 'claude-sonnet-5',
    vendor: 'anthropic', maker: 'Claude', label: 'Claude Sonnet 5',
    grade: 'standard', efforts: CLAUDE_EFFORTS, inPerMTok: 2, outPerMTok: 10,
  },
  {
    id: 'anthropic/claude-haiku-4.5', direct: 'claude-haiku-4-5',
    vendor: 'anthropic', maker: 'Claude', label: 'Claude Haiku 4.5',
    grade: 'fast', efforts: [], inPerMTok: 1, outPerMTok: 5,
  },

  /* ── OpenAI ─────────────────────────────────────────────
   * 3枚とも GPT-5.6。単価は 05-tech-and-cost.md の表（Luna だけ OpenRouter の実測）。 */
  {
    id: 'openai/gpt-5.6-sol', direct: 'gpt-5.6-sol',
    vendor: 'openai', maker: 'OpenAI', label: 'GPT-5.6 Sol',
    grade: 'deep', efforts: GPT_EFFORTS, inPerMTok: 2, outPerMTok: 10,
  },
  {
    id: 'openai/gpt-5.6-terra', direct: 'gpt-5.6-terra',
    vendor: 'openai', maker: 'OpenAI', label: 'GPT-5.6 Terra',
    grade: 'standard', efforts: GPT_EFFORTS, inPerMTok: 2, outPerMTok: 12,
  },
  {
    id: 'openai/gpt-5.6-luna', direct: 'gpt-5.6-luna',
    vendor: 'openai', maker: 'OpenAI', label: 'GPT-5.6 Luna',
    grade: 'fast', efforts: GPT_EFFORTS, inPerMTok: 0.2, outPerMTok: 1.2,
  },
  /**
   * **Luna Pro。「Thinking 版を一覧に並べない」の、ただ1つの例外**（2026-08-26）。
   *
   * これは深さの設定ではありません。**Luna とまったく同じ素体を、
   * 別の出し方（`reasoning.mode = pro`）で出したもの**で、深さのつまみからは届きません。
   * **単価も Luna と同じ**（$0.2 / $1.2。2026-08-26 に一覧で確認）。
   *
   * 並べないと社長は一生選べないので、ここだけ例外にしました。
   * ロードマップを引くのはこれです（`TIER_TABLE.deep`）。
   */
  {
    id: 'openai/gpt-5.6-luna-pro', direct: 'gpt-5.6-luna-pro',
    vendor: 'openai', maker: 'OpenAI', label: 'GPT-5.6 Luna Pro',
    grade: 'deep', efforts: GPT_EFFORTS, inPerMTok: 0.2, outPerMTok: 1.2,
  },
]

/** 通り道での名前から1枚引く。知らない名前なら undefined（表に無いモデルで走っている） */
export const modelOf = (id: string | undefined | null): ModelSpec | undefined =>
  CATALOG.find((m) => m.id === id)

/** プルダウンの見出しごとにまとめる（Claude → OpenAI の順） */
export const BY_MAKER: { maker: ModelSpec['maker']; models: ModelSpec[] }[] =
  (['Claude', 'OpenAI'] as const).map((maker) => ({
    maker, models: CATALOG.filter((m) => m.maker === maker),
  }))

/**
 * **そのモデルで実際に送れる深さ。**
 * 受けない段が選ばれていたら、**近いほうに寄せる**（勝手に深くしない — 下へ寄せる）。
 * 段を1つも持たないモデルなら undefined ＝ 深さを送らない。
 */
export function effortFor(spec: ModelSpec | undefined, want: Effort | undefined): Effort | undefined {
  if (!want) return undefined
  if (!spec) return want                       // 表に無いモデルは、言われたとおりに送る
  if (!spec.efforts.length) return undefined   // 深さを受けない（Haiku 4.5）
  if (spec.efforts.includes(want)) return want
  const at = EFFORTS.indexOf(want)
  // 受ける段のうち、いちばん近いもの（同じ距離なら浅いほう）
  return [...spec.efforts].sort((a, b) => {
    const da = Math.abs(EFFORTS.indexOf(a) - at)
    const db = Math.abs(EFFORTS.indexOf(b) - at)
    return da - db || EFFORTS.indexOf(a) - EFFORTS.indexOf(b)
  })[0]
}
