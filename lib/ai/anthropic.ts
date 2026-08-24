import Anthropic from '@anthropic-ai/sdk'
import { TIER_TABLE } from './tiers'
import { EMPTY_USAGE, type Chunk, type ModelProvider, type RunInput } from './provider'

/** Anthropic：キャッシュの位置を明示する */
export class AnthropicProvider implements ModelProvider {
  readonly vendor = 'anthropic'
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async *stream(input: RunInput): AsyncIterable<Chunk> {
    const spec = TIER_TABLE[input.tier]
    const usage = { ...EMPTY_USAGE }
    let stopReason: string | null = null
    const toolInputs = new Map<number, { id: string; name: string; json: string }>()

    const s = this.client.messages.stream({
      model: spec.direct,
      max_tokens: input.maxTokens ?? 4096,
      // 変わらない前置きに印を置く。ここまでが使い回される
      system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }],
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      // **深さは thinking の量。モデルは変えない**（→ CLAUDE.md）
      ...(input.effort ? { output_config: { effort: input.effort } } : {}),
      ...(input.tools?.length ? { tools: input.tools } : {}),
      ...(input.tools?.length && input.toolChoice === 'required'
        ? { tool_choice: { type: 'any' as const } } : {}),
    }, { signal: input.signal })

    for await (const ev of s) {
      if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
        toolInputs.set(ev.index, { id: ev.content_block.id, name: ev.content_block.name, json: '' })
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta') {
          yield { type: 'text', text: ev.delta.text }
        } else if (ev.delta.type === 'input_json_delta') {
          const t = toolInputs.get(ev.index)
          if (t) t.json += ev.delta.partial_json
        }
      } else if (ev.type === 'content_block_stop') {
        const t = toolInputs.get(ev.index)
        if (t) {
          toolInputs.delete(ev.index)
          yield { type: 'tool_use', id: t.id, name: t.name, input: safeJson(t.json) }
        }
      } else if (ev.type === 'message_delta') {
        stopReason = ev.delta.stop_reason ?? stopReason
        usage.outputTokens += ev.usage?.output_tokens ?? 0
      } else if (ev.type === 'message_start') {
        const u = ev.message.usage
        usage.inputTokens += u?.input_tokens ?? 0
        usage.cacheReadTokens += u?.cache_read_input_tokens ?? 0
        usage.cacheWriteTokens += u?.cache_creation_input_tokens ?? 0
      }
    }

    yield { type: 'done', usage, stopReason }
  }
}

function safeJson(s: string): unknown {
  if (!s.trim()) return {}
  try { return JSON.parse(s) } catch { return { _raw: s } }
}
