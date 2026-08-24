import { hasKey, providerFor, type Msg } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import type { ToolDef } from '@/lib/ai';
import type { LiveWork } from '@/lib/store';

/**
 * 次のフェーズのタスクを引く（Phase 9）。
 *
 * 計画のとき先を固定しなかったぶん、ここで**前の結果を見てから**引く —
 *   前のフェーズの成果物 ＋ 社長の決めたこと → 次のフェーズのタスク2〜4件
 * これが「あとから引き直せる形」の中身（→ CLAUDE.md / docs/PLAN.md Phase 5 原文の要件）。
 */

const TOOL: ToolDef = {
  name: 'draft_phase_tasks',
  description: '次のフェーズのタスクを2〜4件引く。前のフェーズの成果物と社長の決定に沿うこと。',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '4〜20文字' },
            intent: { type: 'string', description: '何をどこまでやるか。1〜2文' },
            owner_hint: { type: 'string', description: '担当（「◯◯担当」の4文字）' },
          },
          required: ['title', 'intent'],
        },
      },
    },
    required: ['tasks'],
  },
};

export type NextTask = { title: string; intent: string; ownerHint?: string };

export async function draftNextTasks(
  work: LiveWork, nextPhase: { name: string; goal: string },
  decided: { question: string; chosen?: string }[],
): Promise<NextTask[]> {
  const p = hasKey('deep') ? providerFor('deep') : new FakeProvider();
  const dels = (work.dels ?? []).slice(0, 4);

  const messages: Msg[] = [{
    role: 'user',
    content: [
      `会社のゴール: ${work.goal}`,
      `次のフェーズ: ${nextPhase.name} — ${nextPhase.goal}`,
      ...(decided.length ? ['', '社長の決定:', ...decided.map((d) => `- ${d.question} → ${d.chosen}`)] : []),
      ...(dels.length ? ['', 'ここまでの成果物:', ...dels.map((d) => `- ${d.title}: ${(d.preview ?? '').slice(0, 120)}`)] : []),
      '',
      'draft_phase_tasks を1回呼んで、このフェーズのタスクを引いてください。文章では答えないでください。',
    ].join('\n'),
  }];

  let tasks: NextTask[] = [];
  for await (const c of p.stream({
    tier: 'deep', effort: 'high', maxTokens: 4000,
    system: 'あなたは一人社長の統括AI。前のフェーズの結果と社長の決定を踏まえ、次のフェーズのタスクを引く。',
    messages, tools: [TOOL],
  })) {
    if (c.type === 'tool_use' && c.name === 'draft_phase_tasks') {
      const rows = ((c.input ?? {}) as { tasks?: Record<string, string>[] }).tasks ?? [];
      tasks = rows.map((t) => ({
        title: String(t.title ?? ''), intent: String(t.intent ?? ''),
        ownerHint: t.owner_hint ? String(t.owner_hint) : undefined,
      })).filter((t) => t.title);
    }
  }
  return tasks.slice(0, 4);
}
