import OpenAI from 'openai'
import { TIER_TABLE } from './tiers'
import { EMPTY_USAGE, type Chunk, type ModelProvider, type RunInput } from './provider'

/** OpenAI：キャッシュは自動。道具の名前が違うのでここで揃える */
export class OpenAIProvider implements ModelProvider {
  readonly vendor = 'openai'
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async *stream(input: RunInput): AsyncIterable<Chunk> {
    const spec = TIER_TABLE[input.tier]
    const usage = { ...EMPTY_USAGE }

    const s = await this.client.responses.create({
      model: spec.direct,
      instructions: input.system,
      input: input.messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: input.maxTokens ?? 4096,
      ...(input.tools?.length
        ? {
            tools: input.tools.map((t) => ({
              type: 'function' as const,
              name: t.name,
              description: t.description,
              parameters: t.input_schema,
              strict: false,
            })),
            ...(input.toolChoice === 'required' ? { tool_choice: 'required' as const } : {}),
          }
        : {}),
      stream: true,
    }, { signal: input.signal })

    for await (const ev of s) {
      if (ev.type === 'response.output_text.delta') {
        yield { type: 'text', text: ev.delta }
      } else if (ev.type === 'response.output_item.done' && ev.item.type === 'function_call') {
        yield {
          type: 'tool_use',
          id: ev.item.call_id,
          name: ev.item.name,
          input: safeJson(ev.item.arguments),
        }
      } else if (ev.type === 'response.completed') {
        const u = ev.response.usage
        usage.inputTokens += u?.input_tokens ?? 0
        usage.outputTokens += u?.output_tokens ?? 0
        usage.cacheReadTokens += u?.input_tokens_details?.cached_tokens ?? 0
      }
    }

    yield { type: 'done', usage, stopReason: null }
  }
}

function safeJson(s: string): unknown {
  if (!s.trim()) return {}
  try { return JSON.parse(s) } catch { return { _raw: s } }
}
