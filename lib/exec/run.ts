import { hasKey, providerFor, type Msg, type ModelProvider } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { CONSTITUTION } from './constitution';
import { PHASE5_TOOLS } from './tools';
import { checkStop, toOptions, toQuestions } from './parse';
import type { Container, Draft, Hire, Plan } from './types';
import { AppError } from '@/lib/errors';
import { slugOf } from '@/lib/roster';

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
  // 統括AIは deep で走るので、見る鍵も deep の通り道のもの
  if (!hasKey('deep')) return { p: new FakeProvider(), real: false };
  return { p: providerFor('deep'), real: true };
}

// 憲法は system に載る（provider が渡す）。ここは user の1通だけ
const shape = (goal: string, ctx: string): Msg[] => [
  { role: 'user', content: `${ctx}\n\n社長のゴール:\n${goal}\n\n道具を順に呼んでください。文章では答えないでください。` },
];

export type RunResult = { draft: Draft; real: boolean };

export async function draftWork(goal: string, ctx = ''): Promise<RunResult> {
  const { p, real } = pickProvider();
  const got = new Map<string, Record<string, unknown>>();
  let stop: string | null = null;

  for await (const c of p.stream({
    tier: 'deep',
    system: CONSTITUTION,
    messages: shape(goal, ctx),
    tools: PHASE5_TOOLS,
    /**
     * 道具を5つ、1往復で全部書かせる。**4,000 では足りない。**
     * 計画・質問・採用・タスクを1回で出すので、フェーズが増えると途中で切れる。
     * 切れても `tool_use` は途中まで届くので、**黙って中途半端な計画ができる**。
     */
    maxTokens: 16000,
    /**
     * 統括AIの計画は**いちばん深く考えさせる**。ここで外すと、
     * 全フェーズの組み立てと採用がまとめてずれる（→ CLAUDE.md「統括AI は常に deep」）。
     */
    effort: 'high',
  })) {
    if (c.type === 'tool_use') got.set(c.name, (c.input ?? {}) as Record<string, unknown>);
    if (c.type === 'done') stop = c.stopReason;
  }

  /**
   * **止まった理由を見る。** 前は見ていなかったので、
   * 枠に当たって切れたのか、断られたのかが分からないまま
   * 「統括AIが入れ物を決めませんでした」だけが出ていた。
   */
  checkStop(stop, got.keys(), '計画が長すぎて途中で切れました。ゴールを短く書き直してみてください');

  // 終わりが言えないときは、入れ物に入れずにここで止まる
  const end = got.get('ask_end');
  if (end) {
    return { real, draft: {
      kind: 'need_end',
      body: String(end.body ?? '何ができたら終わりですか。'),
      options: toOptions(end.options),
    } };
  }

  const c = got.get('decide_container');
  if (!c) {
    throw new AppError('upstream', `no decide_container (stop=${stop}, tools: ${[...got.keys()].join(',')})`,
      undefined, '統括AIが入れ物を決めませんでした');
  }

  const container = toContainer(c);
  /**
   * **計画が空なら、計画だけをもう一度頼む。**
   *
   * 1往復で道具を5つ書かせるのは、速さと安さを取ったモデルには重い。
   * 実際 `decide_container` までは来るのに `draft_plan` が空（フェーズ0・タスク0）で返り、
   * 「0フェーズで進めます。まず「」から —。」という**壊れた計画案**ができた。
   * ここでは**道具を1つだけ渡して、必ず使わせる** — 出力が全部その計画に向く。
   */
  let plan = toPlan(got.get('draft_plan'));
  if (!plan.phases.length || !plan.firstPhaseTasks.length) {
    plan = await drawPlan(p, goal, ctx, container);
  }

  return { real, draft: {
    kind: 'draft',
    container,
    // **型を被せるだけにしない。** options が落ちた質問は板で落ちる（→ parse.ts）
    questions: toQuestions(got.get('ask')?.questions),
    hires: toHires(got.get('propose_hires')?.hires as Record<string, string>[] | undefined),
    plan,
  } };
}

/** 計画だけをもう一度。**道具は1つ、必ず使わせる** */
async function drawPlan(p: ModelProvider, goal: string, ctx: string, c: Container): Promise<Plan> {
  const got = new Map<string, Record<string, unknown>>();
  for await (const ch of p.stream({
    tier: 'deep',
    system: CONSTITUTION,
    messages: [{
      role: 'user',
      content: [
        ctx, '', `社長のゴール:\n${goal}`, '',
        `決まっている入れ物: ${c.title}（${c.goal}／およそ${c.weeks}週）`, '',
        '**この Work の計画を draft_plan で書いてください。**',
        'フェーズは3〜5個、それぞれ名前・ねらい・週数。',
        '**直近のフェーズのタスクは必ず2件以上**（first_phase_tasks）。',
        '社長に聞く関門（gates）は多くても2つ。文章では答えないでください。',
      ].filter(Boolean).join('\n'),
    }],
    tools: [PHASE5_TOOLS.find((t) => t.name === 'draft_plan')!],
    toolChoice: 'required',
    maxTokens: 8000,
    effort: 'high',
  })) {
    if (ch.type === 'tool_use') got.set(ch.name, (ch.input ?? {}) as Record<string, unknown>);
  }
  return toPlan(got.get('draft_plan'));
}

const toContainer = (r: Record<string, unknown>): Container => ({
  verdict: (r.verdict as Container['verdict']) ?? 'work',
  title: String(r.title ?? ''), goal: String(r.goal ?? ''),
  weeks: Number(r.weeks ?? 0),
  intoWorkId: r.into_work_id ? String(r.into_work_id) : undefined,
  ends: !!r.ends, alone: !!r.alone, short: !!r.short,
  reason: String(r.reason ?? ''),
});

/**
 * 採用の提案。**definition_id はロスターの slug に寄せてから持つ**（`slugOf`）—
 * 別名のまま在籍に入ると、同じ担当が「在籍」と「まだいない」の両方に並ぶ。
 */
const toHires = (rows?: Record<string, string>[]): Hire[] =>
  (rows ?? []).map((h) => ({
    definitionId: slugOf(h.definition_id), displayName: h.display_name, why: h.why, forPhase: h.for_phase,
  }));

const toPlan = (r?: Record<string, unknown>): Plan => ({
  weeks: Number(r?.weeks ?? 0),
  // **名前の無いフェーズを通さない。** 通すと「まず「」から —。」になる
  phases: ((r?.phases as Record<string, unknown>[]) ?? [])
    .map((x) => ({ name: String(x?.name ?? ''), goal: String(x?.goal ?? ''), weeks: Number(x?.weeks ?? 0) }))
    .filter((x) => x.name),
  gates: ((r?.gates as Record<string, string>[]) ?? []).map((g) => ({
    afterPhase: g.after_phase, question: g.question,
  })),
  firstPhaseTasks: ((r?.first_phase_tasks as Record<string, string>[]) ?? [])
    .map((t) => ({ title: String(t?.title ?? ''), intent: String(t?.intent ?? ''), ownerHint: String(t?.owner_hint ?? '') }))
    .filter((t) => t.title),
  deliverables: (r?.deliverables as string[]) ?? [],
});
