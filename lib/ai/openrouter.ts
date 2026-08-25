import OpenAI from 'openai'
import { effortFor } from './catalog'
import { resolve } from './tiers'
import { EMPTY_USAGE, type Chunk, type ModelProvider, type RunInput } from './provider'

/**
 * OpenRouter。**OpenAI の Chat Completions と同じ形**なので、
 * `openai` の SDK に行き先だけ差し替えて使う（別のクライアントを入れない）。
 *
 * 直につなぐ道（`anthropic.ts` / `openai.ts`）は残してある。
 * `TIER_TABLE` の `vendor` を書き換えれば、いつでも戻せる。
 *
 * **この環境からは openrouter.ai に出られない**ので、
 * 下の3つは**実キーで確かめていない**（→ `docs/RUNNING.md`）:
 *   ① モデルの slug（`anthropic/claude-opus-5` の綴り）
 *   ② Anthropic のプロンプトキャッシュが透過するか（`cache_control` の渡し方）
 *   ③ `usage` に何が入るか（キャッシュの読み書き量が取れるか）
 * ①は `GET /api/v1/models` で一覧が取れる。鍵が入ったら最初に確かめる。
 */

const BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements ModelProvider {
  readonly vendor = 'openrouter'
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: BASE,
      // OpenRouter の一覧に出す名前。無くても動くが、出しておくと問い合わせが楽
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL ?? 'https://onefound.app',
        'X-Title': 'OneFound',
      },
    })
  }

  async *stream(input: RunInput): AsyncIterable<Chunk> {
    // 社長が選んだモデル、無ければ表のモデル、env があればそれが勝つ（→ tiers.ts）
    const { name: model, spec } = resolve(input.tier, input.model)
    /**
     * 深さ。OpenRouter は `reasoning_effort` を受ける。
     * **モデルごとに受ける段が違う**（無い段を送ると往復ごと弾かれる）ので、
     * 一覧の持っている段に寄せてから送る（→ `lib/ai/catalog.ts`）。
     */
    const effort = effortFor(spec, input.effort)
    const usage = { ...EMPTY_USAGE }
    const calls = new Map<number, { id: string; name: string; json: string }>()
    let stopReason: string | null = null

    const s = await this.client.chat.completions.create({
      model,
      max_tokens: input.maxTokens ?? 4096,
      messages: [
        // **変わらない前置きを先頭に置く。** ここまでが使い回される
        { role: 'system', content: input.system },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      ...(effort ? { reasoning_effort: effort } : {}),
      /**
       * Web検索（OpenRouter の web プラグイン）。**既定はオフ** —
       * 検索は従量で課金されるので、無料のテストを黙って有料にしない。
       * `OPENROUTER_WEB=1` で全階層に付く（Phase 8 の調査を本物のWebでやるとき）。
       */
      ...(process.env.OPENROUTER_WEB === '1' ? { plugins: [{ id: 'web' }] } : {}),
      ...(input.tools?.length
        ? {
            tools: input.tools.map((t) => ({
              type: 'function' as const,
              function: { name: t.name, description: t.description, parameters: t.input_schema },
            })),
            // 既定は auto。**必ずカードになる往復だけ** required にする
            ...(input.toolChoice === 'required' ? { tool_choice: 'required' as const } : {}),
          }
        : {}),
      stream: true,
      stream_options: { include_usage: true },
    }, { signal: input.signal })

    for await (const ev of s) {
      const d = ev.choices?.[0]
      // 思考の断片（OpenRouter の unified reasoning）。**開示するモデルのときだけ**届く
      const think = (d?.delta as { reasoning?: string } | undefined)?.reasoning
      if (think) yield { type: 'think', text: think }
      if (d?.delta?.content) yield { type: 'text', text: d.delta.content }

      // 道具の引数は少しずつ届く。番号ごとに繋いで、最後にまとめて出す。
      // **名前が分かった瞬間だけ先に知らせる**（画面の「いま何をしているか」用）
      for (const t of d?.delta?.tool_calls ?? []) {
        const at = t.index ?? 0
        const cur = calls.get(at) ?? { id: '', name: '', json: '' }
        const name = t.function?.name ?? cur.name
        if (name && name !== cur.name) yield { type: 'tool_begin', name }
        calls.set(at, {
          id: t.id ?? cur.id,
          name,
          json: cur.json + (t.function?.arguments ?? ''),
        })
      }
      if (d?.finish_reason) stopReason = d.finish_reason
      if (ev.usage) {
        usage.inputTokens += ev.usage.prompt_tokens ?? 0
        usage.outputTokens += ev.usage.completion_tokens ?? 0
        usage.cacheReadTokens += ev.usage.prompt_tokens_details?.cached_tokens ?? 0
      }
    }

    for (const c of calls.values()) {
      if (c.name) yield { type: 'tool_use', id: c.id, name: c.name, input: safeJson(c.json) }
    }
    yield { type: 'done', usage, stopReason }
  }
}

function safeJson(s: string): unknown {
  if (!s.trim()) return {}
  try { return JSON.parse(s) } catch { return {} }
}
