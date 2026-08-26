import { hasKey, providerFor, type Msg, type ModelProvider } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { CONSTITUTION } from './constitution';
import { PHASE5_TOOLS } from './tools';
import { checkStop, toOptions, toQuestions } from './parse';
import { checkPlan, sayPlanDiags } from './plan-check';
import type { Container, Draft, Hire, Plan } from './types';
import { AppError } from '@/lib/errors';
import { crewFor, rosterBlock, slugOf } from '@/lib/roster';
import { store } from '@/lib/store';
import { execPref, type Pref } from './pref';

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

/**
 * 憲法は system に載る（provider が渡す）。ここは user の1通だけ。
 *
 * **名簿を必ず載せる。** 前は載せていなかったので、`propose_hires` は空で返り、
 * 担当には「商品設計担当」のような**この会社に存在しない名前**が書かれた
 * （→ `lib/roster` の `rosterBlock`）。
 */
const shape = (goal: string, ctx: string, roster: string, memory: string): Msg[] => [
  { role: 'user', content: [roster, memory, ctx, `社長のゴール:\n${goal}`,
    '道具を順に呼んでください。文章では答えないでください。'].filter(Boolean).join('\n\n') },
];

/**
 * **会社がもう知っていること。** 承認済みの成果物（題だけ）と、決めたこと。
 * 実行の依頼文に載せているものと同じ出どころ（→ `lib/run/worker.ts`）。
 * 何も無ければ空文字 — **空の見出しを渡さない**。
 */
async function memoryBlock(): Promise<string> {
  const s = store();
  const [dels, decs] = await Promise.all([
    s.listDels().catch(() => []),
    s.listDecisions().catch(() => []),
  ]);
  const done = dels.filter((d) => d.state === '承認済').slice(0, 6);
  const decided = decs.filter((d) => d.status === 'decided' && d.chosen).slice(0, 6);
  if (!done.length && !decided.length) return '';
  return [
    '## この会社がもう知っていること',
    ...(done.length
      ? ['承認された成果物（**二度調べ直さない。前提として使う**）:',
         ...done.map((d) => `- ${d.title}（${d.workTitle}）`)]
      : []),
    ...(decided.length
      ? ['決めたこと（**社長の決定。これに沿う**）:',
         ...decided.map((d) => `- ${d.question} → ${d.chosen}`)]
      : []),
  ].join('\n');
}

export type RunResult = { draft: Draft; real: boolean };

export async function draftWork(goal: string, ctx = ''): Promise<RunResult> {
  const { p, real } = pickProvider();
  // **統括AIの設定で走る**（メンバー画面のいちばん上の行）
  const pref = await execPref();
  // いま誰がいるか。**もう居る人をもう一度採らせない**ために渡す
  const roster = rosterBlock((await store().listEmployees().catch(() => []))
    .map((e) => ({ slug: slugOf(e.definitionId), name: e.name })));
  /**
   * **会社がもう知っていること**（2026-08-26）。
   *
   * AI社員の実行には渡していたのに、**計画には渡していなかった** —
   * だから3本目の Work でも、1本目で何が分かったかを知らずに引いていた。
   * 承認済みの成果物と決めたことは、そのまま新しい計画の前提になる。
   */
  const memory = await memoryBlock();
  const got = new Map<string, Record<string, unknown>>();
  let stop: string | null = null;

  for await (const c of p.stream({
    tier: 'deep',
    model: pref.model,
    system: CONSTITUTION,
    messages: shape(goal, ctx, roster, memory),
    tools: PHASE5_TOOLS,
    /**
     * 道具を5つ、1往復で全部書かせる。**4,000 では足りない。**
     * 計画・質問・採用・タスクを1回で出すので、フェーズが増えると途中で切れる。
     * 切れても `tool_use` は途中まで届くので、**黙って中途半端な計画ができる**。
     */
    maxTokens: 16000,
    /**
     * 統括AIの計画は**深く考えさせる**。ここで外すと、全フェーズの組み立てと採用が
     * まとめてずれる（→ CLAUDE.md「統括AI は常に deep」）。
     * 深さは社長が選べる（既定は「やや深め」）— 選んだものがそのまま効く。
     */
    effort: pref.effort,
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
    plan = await drawPlan(p, goal, ctx, container, pref);
  }

  /**
   * **引いた計画を、機械で読み返す**（2026-08-26。→ `lib/exec/plan-check.ts`）。
   *
   * 憲法には「着かない計画は、引き直します」と書いてあるのに、
   * 引き直させる仕掛けがなかった。図（`draw_workflow`）には
   * validate → 描き直しがあるので、**同じ作法を計画にも当てる**。
   *
   * 辻褄が合わないところ（関門の行き先が無い・週数が合わない・理由が空…）を
   * **指したところだけ**渡して、**1回だけ**引き直させる。
   * それでも合わなければ、**直ったところだけ受け取って**社長に出す —
   * 引き直しは deep の1往復なので、何度も払わない。
   */
  const diags = checkPlan(plan);
  if (diags.length) {
    const again = await drawPlan(p, goal, ctx, container, pref, sayPlanDiags(diags), plan);
    // **元より悪くしない。** 引き直しが空で返ったら、元の計画を使う
    if (again.phases.length && again.firstPhaseTasks.length) plan = again;
  }

  /**
   * **担当の名前を、ここで名簿に寄せる。**
   *
   * 名簿をプロンプトに載せても、たまに「商品設計担当」のような
   * **この会社に居ない名前**が返る。承認のときに寄せるだけでは、
   * **計画の画面が「商品設計担当」と言い、実際には調査担当が動く** —
   * 画面がその場で嘘をつく。だから控えに入る前に直す。
   */
  const hires = toHires(got.get('propose_hires')?.hires as Record<string, string>[] | undefined);
  const crew = crewFor(hires, plan.firstPhaseTasks.map((t) => t.ownerHint));
  const byName = new Map(crew.map((c) => [c.displayName, c]));
  plan = {
    ...plan,
    firstPhaseTasks: plan.firstPhaseTasks.map((t) => ({
      ...t, ownerHint: (byName.has(t.ownerHint) ? t.ownerHint : crew[0]?.displayName) ?? t.ownerHint,
    })),
  };

  return { real, draft: {
    kind: 'draft',
    container,
    // **型を被せるだけにしない。** options が落ちた質問は板で落ちる（→ parse.ts）
    questions: toQuestions(got.get('ask')?.questions),
    // 採用も名簿の人だけ（居ない ID・名前は落とす）
    hires: crew.map((c) => {
      const src = hires.find((h) => h.displayName === c.displayName);
      return { ...c, why: src?.why ?? 'このフェーズのタスクの担当',
               forPhase: src?.forPhase ?? (plan.phases[0]?.name ?? '') };
    }),
    plan,
  } };
}

/**
 * 計画だけをもう一度。**道具は1つ、必ず使わせる**。
 * `fix` があれば「ここを直して」の頼み直し（前の計画も一緒に渡す）。
 */
async function drawPlan(
  p: ModelProvider, goal: string, ctx: string, c: Container, pref: Pref,
  fix?: string, prev?: Plan,
): Promise<Plan> {
  const got = new Map<string, Record<string, unknown>>();
  for await (const ch of p.stream({
    tier: 'deep',
    model: pref.model,
    system: CONSTITUTION,
    messages: [{
      role: 'user',
      content: [
        ctx, '', `社長のゴール:\n${goal}`, '',
        `決まっている入れ物: ${c.title}（${c.goal}／およそ${c.weeks}週）`, '',
        ...(prev ? ['さっき引いてもらった計画:', JSON.stringify(prev), ''] : []),
        fix ?? [
          '**この Work の計画を draft_plan で書いてください。**',
          'フェーズは3〜5個、それぞれ名前・ねらい・週数。',
          '**直近のフェーズのタスクは必ず2件以上**（first_phase_tasks）。',
          '社長に聞く関門（gates）は、**社長でないと決められないところにだけ**。数は決めない（0でもよい）。',
          '**なぜこの順番か（why）と、前提にしていること（assumes）を必ず書いてください。**',
        ].join('\n'),
        '文章では答えないでください。',
      ].filter(Boolean).join('\n'),
    }],
    tools: [PHASE5_TOOLS.find((t) => t.name === 'draft_plan')!],
    toolChoice: 'required',
    maxTokens: 8000,
    effort: pref.effort,
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
  /**
   * **古い控えは名前だけの配列**（`['競合表', …]`）。読めなくしない。
   * 新しい形は `{ name, phase }` で、どのフェーズで出来るかを統括AIが書く。
   */
  deliverables: ((r?.deliverables as (string | Record<string, unknown>)[]) ?? [])
    .map((m) => (typeof m === 'string'
      ? { name: m }
      : { name: String(m?.name ?? ''), phase: m?.phase ? String(m.phase) : undefined }))
    .filter((m) => m.name),
  /**
   * **なぜこの計画なのか**（2026-08-26）。古い控えには無いので、無ければ空。
   * 空のまま画面に出す — **統括AIが言っていないことを、こちらで書き足さない**。
   */
  why: ((r?.why as string[]) ?? []).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 5),
  assumes: ((r?.assumes as Record<string, unknown>[]) ?? [])
    .map((a) => ({ label: String(a?.label ?? '').trim(), value: String(a?.value ?? '').trim() }))
    .filter((a) => a.label && a.value).slice(0, 5),
  dropped: String(r?.dropped ?? '').trim() || undefined,
  timeNote: String(r?.time_note ?? '').trim() || undefined,
});
