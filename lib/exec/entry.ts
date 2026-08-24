import type { Msg } from '@/lib/ai';
import { AppError } from '@/lib/errors';
import { CONSTITUTION } from './constitution';
import { pickProvider } from './run';
import { ask } from './tools';
import { describeBusiness, proposeCandidates, reportDiagnosis, reportFacts, setConditions } from './entry-tools';
import type { CandidateDraft, Conditions, Fact, Finding, Question } from './types';

/**
 * 入口（Case B / D）を1回まわす。Phase 5 と同じ作法 —
 * **1往復で全部受け取り、返事の文章は使わない。**
 */

/* ══════════════ Case B — 条件を集めて候補を出す ══════════════ */

export type DiscoverOut = {
  real: boolean;
  /** 統括AIが構造に写した条件（差分。無い項目は前のまま） */
  conditions: Partial<Conditions>;
  /** まだ聞きたいこと（候補を出したら空） */
  questions: Question[];
  /** 候補3つ（まだなら空） */
  candidates: CandidateDraft[];
};

const DISCOVER_GUIDE = `
## いまの仕事 — 条件を集めて、事業の候補を3つ出す
社長はまだ、何をやるか決めていません。あなたは条件（使える時間 / 使えるお金 /
得意なこと / やりたくないこと / いつまでに）を集めて、候補を3つ出します。

- 社長が言ったことは、まず set_conditions で構造に写す（分かった項目だけ）
- 条件が2つ以上そろっていれば propose_candidates で候補を3つ出す。
  **全部そろうまで待たない** — 足りない分は仮に置いて、候補の summary にそう書く
- まだ2つ未満なら ask で聞く（1〜2問。質問攻めにしない）
- 社長が「もう出して」と言ったら、そろっていなくても必ず propose_candidates を呼ぶ`;

export async function discoverStep(
  current: Conditions, said: string, force: boolean,
): Promise<DiscoverOut> {
  const { p, real } = pickProvider();
  // 条件は道具（set_conditions）と同じ語彙（snake_case）で見せる — 別の綴りを2つ覚えさせない
  const snake = {
    hours_per_week: current.hoursPerWeek ?? null,
    budget_jpy: current.budgetJpy ?? null,
    strengths: current.strengths,
    avoid: current.avoid,
    deadline: current.deadline ?? null,
  };
  const messages: Msg[] = [{
    role: 'user',
    content: [
      `いまの条件（構造）:\n${JSON.stringify(snake)}`,
      `社長が言ったこと:\n${said || '（まだ何も言っていない。最初の質問をする）'}`,
      force ? '社長は「もう候補を出して」と言っています。必ず propose_candidates を呼んでください。' : '',
      '道具を順に呼んでください。文章では答えないでください。',
    ].filter(Boolean).join('\n\n'),
  }];

  const got = new Map<string, Record<string, unknown>>();
  let stop: string | null = null;
  for await (const c of p.stream({
    tier: 'deep',
    system: CONSTITUTION + '\n' + DISCOVER_GUIDE,
    messages,
    tools: [setConditions, ask, proposeCandidates],
    maxTokens: 8000,
    effort: 'high',
  })) {
    if (c.type === 'tool_use') got.set(c.name, (c.input ?? {}) as Record<string, unknown>);
    if (c.type === 'done') stop = c.stopReason;
  }
  if (stop === 'refusal') {
    throw new AppError('upstream', 'model refused', undefined, '統括AIがこの依頼には応えられませんでした');
  }

  const cRaw = got.get('set_conditions') ?? {};
  const conditions: Partial<Conditions> = {};
  if (cRaw.hours_per_week != null) conditions.hoursPerWeek = Number(cRaw.hours_per_week);
  if (cRaw.budget_jpy != null) conditions.budgetJpy = Number(cRaw.budget_jpy);
  if (Array.isArray(cRaw.strengths) && cRaw.strengths.length) conditions.strengths = cRaw.strengths.map(String);
  if (Array.isArray(cRaw.avoid) && cRaw.avoid.length) conditions.avoid = cRaw.avoid.map(String);
  if (cRaw.deadline != null && cRaw.deadline !== '') conditions.deadline = String(cRaw.deadline);

  const cands = ((got.get('propose_candidates')?.candidates as Record<string, unknown>[]) ?? [])
    .map((x): CandidateDraft => ({
      name: String(x.name ?? ''), summary: String(x.summary ?? ''),
      why: Array.isArray(x.why) ? x.why.map(String) : [],
      fit: {
        speed: num((x.fit as Record<string, unknown>)?.speed),
        cost: num((x.fit as Record<string, unknown>)?.cost),
        strength: num((x.fit as Record<string, unknown>)?.strength),
      },
      recommended: !!x.recommended,
      notChosenWhy: x.not_chosen_why ? String(x.not_chosen_why) : undefined,
    }))
    .filter((x) => x.name);

  return {
    real, conditions,
    // 候補が出たら、質問は出さない（両方来ても候補が勝つ — 板と結果画面を同時に出さない）
    questions: cands.length ? [] : ((got.get('ask')?.questions as Question[]) ?? []),
    candidates: cands,
  };
}

const num = (v: unknown) => Math.max(0, Math.min(100, Number(v ?? 0) || 0));

/* ══════════════ Case D — 取り込んだものから診断する ══════════════ */

export type DiagnoseOut = {
  real: boolean;
  name?: string; stage?: string;
  facts: Fact[];
  findings: Finding[];
};

const DIAGNOSE_GUIDE = `
## いまの仕事 — 取り込んだものから、いまの事業を診断する
社長にはすでに事業があります。渡された材料（サイト・資料・数字）**だけ**から診断します。

- describe_business で事業の名前を言う（サイト名・商品名から）
- report_facts で数字の帯を3〜4つ。**読み取れなかった大事な数字は missing で出す**
- report_diagnosis で見つかったことを効きそうな順に2〜4件。
  **1件ごとに、提案する Work まで必ず書く** — 問題を並べて終わりにしない
- 材料に無いことを、事実として書かない。URL の中身をまだ読めていないなら、読めていないと扱う`;

export async function diagnoseRun(
  sources: { kind: string; locator: string; summary?: string }[],
): Promise<DiagnoseOut> {
  const { p, real } = pickProvider();
  const material = sources.map((s, i) =>
    `### 材料${i + 1} — ${s.locator}（${s.kind}）\n${s.summary ?? '（中身はまだ読めていない。名前だけ分かっている）'}`,
  ).join('\n\n');

  const got = new Map<string, Record<string, unknown>>();
  let stop: string | null = null;
  for await (const c of p.stream({
    tier: 'deep',
    system: CONSTITUTION + '\n' + DIAGNOSE_GUIDE,
    messages: [{
      role: 'user',
      content: `取り込んだ材料:\n\n${material}\n\n道具を順に呼んでください。文章では答えないでください。`,
    }],
    tools: [describeBusiness, reportFacts, reportDiagnosis],
    maxTokens: 8000,
    effort: 'high',
  })) {
    if (c.type === 'tool_use') got.set(c.name, (c.input ?? {}) as Record<string, unknown>);
    if (c.type === 'done') stop = c.stopReason;
  }
  if (stop === 'refusal') {
    throw new AppError('upstream', 'model refused', undefined, '統括AIがこの依頼には応えられませんでした');
  }

  const findings = ((got.get('report_diagnosis')?.findings as Record<string, unknown>[]) ?? [])
    .map((f): Finding => ({
      severity: (['重い', '中くらい', '軽い'] as const).find((s) => s === f.severity) ?? '中くらい',
      title: String(f.title ?? ''), why: String(f.why ?? ''),
      evidence: Array.isArray(f.evidence) ? f.evidence.map(String) : [],
      work: {
        title: String((f.work as Record<string, unknown>)?.title ?? ''),
        goal: String((f.work as Record<string, unknown>)?.goal ?? ''),
        weeks: Number((f.work as Record<string, unknown>)?.weeks ?? 0),
      },
    }))
    .filter((f) => f.title && f.work.title);
  if (!findings.length) {
    throw new AppError('upstream', `no findings (stop=${stop}, tools: ${[...got.keys()].join(',')})`,
      undefined, '統括AIが診断を出せませんでした。材料を足してみてください');
  }

  const biz = got.get('describe_business');
  return {
    real,
    name: biz?.name ? String(biz.name) : undefined,
    stage: biz?.stage ? String(biz.stage) : undefined,
    facts: ((got.get('report_facts')?.facts as Record<string, unknown>[]) ?? []).map((f): Fact => ({
      label: String(f.label ?? ''), value: String(f.value ?? '—'),
      note: f.note ? String(f.note) : undefined, missing: !!f.missing,
    })).filter((f) => f.label),
    findings,
  };
}
