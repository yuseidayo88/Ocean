import { providerFor, type Msg, type ModelProvider } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { CONSTITUTION } from './constitution';
import { PHASE5_TOOLS } from './tools';
import type { Container, Draft, Hire, Plan, Question } from './types';

/**
 * Work を立てるまでを1回まわす。
 *
 *   ゴール → 入れ物の判定 → 質問 → 採用の提案 → 計画
 *
 * **1往復で全部受け取る。** 4回に分けて聞くと、そのたびに憲法を読み直させることになるし、
 * 前の判断を忘れる。道具を4つ渡して、順に呼ばせる。
 *
 * **返事の文章は使わない。** 画面に出すものは全部 `tool_use` から取る。
 */

/** キーが無ければ決め打ちのプロバイダ。**考えていないので、画面に必ずそう出す** */
export function pickProvider(): { p: ModelProvider; real: boolean } {
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasKey) return { p: new FakeProvider(), real: false };
  return { p: providerFor('deep'), real: true };
}

const shape = (system: string, goal: string, ctx: string): Msg[] => [
  { role: 'user', content: `${ctx}\n\n社長のゴール:\n${goal}\n\n道具を順に呼んでください。文章では答えないでください。` },
];

export type RunResult = { draft: Draft; real: boolean };

export async function draftWork(goal: string, ctx = ''): Promise<RunResult> {
  const { p, real } = pickProvider();
  const got = new Map<string, Record<string, unknown>>();

  for await (const c of p.stream({
    tier: 'deep',
    system: CONSTITUTION,
    messages: shape(CONSTITUTION, goal, ctx),
    tools: PHASE5_TOOLS,
    maxTokens: 4000,
  })) {
    if (c.type === 'tool_use') got.set(c.name, (c.input ?? {}) as Record<string, unknown>);
  }

  // 終わりが言えないときは、入れ物に入れずにここで止まる
  const end = got.get('ask_end');
  if (end) {
    return { real, draft: {
      kind: 'need_end',
      body: String(end.body ?? '何ができたら終わりですか。'),
      options: (end.options as Draft extends never ? never : { label: string; description: string }[]) ?? [],
    } };
  }

  const c = got.get('decide_container');
  if (!c) throw new Error('統括AIが入れ物を決めませんでした');

  return { real, draft: {
    kind: 'draft',
    container: toContainer(c),
    questions: (got.get('ask')?.questions as Question[]) ?? [],
    hires: toHires(got.get('propose_hires')?.hires as Record<string, string>[] | undefined),
    plan: toPlan(got.get('draft_plan')),
  } };
}

const toContainer = (r: Record<string, unknown>): Container => ({
  verdict: (r.verdict as Container['verdict']) ?? 'work',
  title: String(r.title ?? ''), goal: String(r.goal ?? ''),
  weeks: Number(r.weeks ?? 0),
  intoWorkId: r.into_work_id ? String(r.into_work_id) : undefined,
  ends: !!r.ends, alone: !!r.alone, short: !!r.short,
  reason: String(r.reason ?? ''),
});

const toHires = (rows?: Record<string, string>[]): Hire[] =>
  (rows ?? []).map((h) => ({
    definitionId: h.definition_id, displayName: h.display_name, why: h.why, forPhase: h.for_phase,
  }));

const toPlan = (r?: Record<string, unknown>): Plan => ({
  weeks: Number(r?.weeks ?? 0),
  phases: (r?.phases as Plan['phases']) ?? [],
  gates: ((r?.gates as Record<string, string>[]) ?? []).map((g) => ({
    afterPhase: g.after_phase, question: g.question,
  })),
  firstPhaseTasks: ((r?.first_phase_tasks as Record<string, string>[]) ?? []).map((t) => ({
    title: t.title, intent: t.intent, ownerHint: t.owner_hint,
  })),
  deliverables: (r?.deliverables as string[]) ?? [],
});
