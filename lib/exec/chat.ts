import type { Msg } from '@/lib/ai';
import { hasKey, providerFor } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { AppError } from '@/lib/errors';
import { CONSTITUTION } from './constitution';
import { ask } from './tools';
import { proposeWork, rememberMaterial } from './chat-tools';
import { describeBusiness, proposeCandidates, reportDiagnosis, reportFacts, setConditions } from './entry-tools';
import { checkStop, finite, score, toQuestions } from './parse';
import type { CandidateDraft, Conditions, Fact, Finding, Question } from './types';

/**
 * チャットの1往復。**入口も相談も、ぜんぶここで起きる**（2026-08-24 の作り直し）。
 *
 * Phase 5（`run.ts`）と違うところ:
 *   ・**文章が主役。** 道具が1つも来ない往復（ただの返事）も正しい
 *   ・道具は返事に添える**カード**を作るためのもの
 *   ・**Work は勝手に作らない。** `propose_work` で提案し、社長が押してから作る
 *
 * 速さを優先して `fast`（＝いちばん浅い thinking）で回す。
 * 3階層とも同じモデルなので、違うのは考える量だけ（→ `lib/ai/tiers.ts`）。
 */

export type ChatOut = {
  real: boolean;
  /** 統括AIの返事（本文）。空のこともある */
  text: string;
  /** 聞きたいこと（カードになる） */
  questions: Question[];
  /** 条件の差分（言われた項目だけ） */
  conditions: Partial<Conditions>;
  /** 候補3つ（出たときだけ） */
  candidates: CandidateDraft[];
  /** 覚える材料 */
  materials: { kind: 'site' | 'doc' | 'sheet'; locator: string; content?: string }[];
  /** 事業の名前・段階 */
  business?: { name?: string; stage?: string };
  facts: Fact[];
  findings: Finding[];
  /** Work の提案（社長が押したら作る） */
  work?: { title: string; goal: string; weeks: number; why: string };
};

/** いまのスレッドの状態。プロンプトに畳んで渡す */
export type ChatState = {
  /** もう Work を作ったか（1チャット=1Work） */
  hasWork: boolean;
  /** 集まっている条件（まだ決まっていない人の道） */
  conditions?: Conditions;
  /** すでに候補を出したか */
  proposed: boolean;
  /** 取り込んだ材料の名前 */
  materials: string[];
  /** もう診断したか */
  diagnosed: boolean;
  /** 会社のいま（Work の一覧など） */
  company: string;
};

const GUIDE = `
## いまの仕事 — 社長との会話
あなたは社長と1対1で話しています。**返事は日本語で短く。** 話を進めるのが仕事です。

社長は3つのどれかで来ます。見分けて、その道に乗せてください。
1. **やりたいことがある** → 終わりが言えるか確かめ、まとまったら propose_work
2. **まだ決まっていない** → set_conditions で条件を構造に写す（使える時間 / 使えるお金 /
   得意なこと / やりたくないこと / いつまでに）。**2つそろったら** propose_candidates で候補を3つ
3. **すでに事業がある** → remember_material で材料を覚える。材料がそろったら
   describe_business → report_facts → report_diagnosis

## 守ること
- **Work は勝手に作らない。** propose_work で提案するだけ。作るのは社長が押したとき
- 雑談・質問・調べもので済む話に Work は要らない。**要らないときは提案しない**
- **この会話でもう Work を作っているなら、propose_work は二度と呼ばない**
- 聞きたいことがあるときは ask（1度に2〜4問まで）。選択肢には必ず1行の説明を付ける
- 道具を呼ぶときも、**本文は必ず書く**（カードだけ出して黙らない）`;

export async function chatStep(state: ChatState, history: Msg[]): Promise<ChatOut> {
  const real = hasKey('fast');
  const p = real ? providerFor('fast') : new FakeProvider();

  const lines = [`いまの会社:\n${state.company}`];
  if (state.hasWork) lines.push('**この会話ではもう Work を作りました。** propose_work は呼ばないでください。');
  if (state.conditions) lines.push(`集まっている条件:\n${JSON.stringify({
    hours_per_week: state.conditions.hoursPerWeek ?? null,
    budget_jpy: state.conditions.budgetJpy ?? null,
    strengths: state.conditions.strengths,
    avoid: state.conditions.avoid,
    deadline: state.conditions.deadline ?? null,
  })}`);
  if (state.proposed) lines.push('候補はもう出しました。選び直したいと言われたら出し直してください。');
  if (state.materials.length) lines.push(`取り込んだ材料: ${state.materials.join(' / ')}`);
  if (state.diagnosed) lines.push('診断はもう出しました。');

  const got = new Map<string, Record<string, unknown>>();
  const many: Record<string, unknown>[] = [];
  let text = '';
  let stop: string | null = null;

  for await (const c of p.stream({
    tier: 'fast',
    system: `${CONSTITUTION}\n${GUIDE}\n\n${lines.join('\n\n')}`,
    messages: history,
    tools: [ask, setConditions, proposeCandidates, rememberMaterial, describeBusiness, reportFacts, reportDiagnosis, proposeWork],
    maxTokens: 8000,
    effort: 'low',
  })) {
    if (c.type === 'text') text += c.text;
    if (c.type === 'tool_use') {
      const input = (c.input ?? {}) as Record<string, unknown>;
      // 材料は1往復で何個来てもいい（ほかの道具は最後の1つが勝つ）
      if (c.name === 'remember_material') many.push(input);
      else got.set(c.name, input);
    }
    if (c.type === 'done') stop = c.stopReason;
  }
  checkStop(stop, got.keys(), '返事が長すぎて途中で切れました。短く聞き直してみてください');

  const cRaw = got.get('set_conditions') ?? {};
  const conditions: Partial<Conditions> = {};
  const hours = finite(cRaw.hours_per_week);
  if (hours !== undefined) conditions.hoursPerWeek = hours;
  const budget = finite(cRaw.budget_jpy);
  if (budget !== undefined) conditions.budgetJpy = budget;
  if (Array.isArray(cRaw.strengths) && cRaw.strengths.length) conditions.strengths = cRaw.strengths.map(String);
  if (Array.isArray(cRaw.avoid) && cRaw.avoid.length) conditions.avoid = cRaw.avoid.map(String);
  if (cRaw.deadline != null && cRaw.deadline !== '') conditions.deadline = String(cRaw.deadline);

  const candidates = ((got.get('propose_candidates')?.candidates as Record<string, unknown>[]) ?? [])
    .map((x): CandidateDraft => ({
      name: String(x.name ?? ''), summary: String(x.summary ?? ''),
      why: Array.isArray(x.why) ? x.why.map(String) : [],
      fit: {
        speed: score((x.fit as Record<string, unknown>)?.speed),
        cost: score((x.fit as Record<string, unknown>)?.cost),
        strength: score((x.fit as Record<string, unknown>)?.strength),
      },
      recommended: !!x.recommended,
      notChosenWhy: x.not_chosen_why ? String(x.not_chosen_why) : undefined,
    }))
    .filter((x) => x.name);

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

  const w = got.get('propose_work');
  // **もう Work があるなら、提案が来ても捨てる**（1チャット=1Work の最後の砦）
  const work = w && !state.hasWork
    ? { title: String(w.title ?? ''), goal: String(w.goal ?? ''), weeks: Number(w.weeks ?? 0), why: String(w.why ?? '') }
    : undefined;

  const biz = got.get('describe_business');

  const out: ChatOut = {
    real, text: text.trim(),
    questions: toQuestions(got.get('ask')?.questions),
    conditions, candidates,
    materials: many.map((m) => ({
      kind: (['site', 'doc', 'sheet'] as const).find((k) => k === m.kind) ?? 'doc',
      locator: String(m.locator ?? '').slice(0, 200),
      content: m.content ? String(m.content).slice(0, 4000) : undefined,
    })).filter((m) => m.locator),
    business: biz ? { name: biz.name ? String(biz.name) : undefined, stage: biz.stage ? String(biz.stage) : undefined } : undefined,
    facts: ((got.get('report_facts')?.facts as Record<string, unknown>[]) ?? []).map((f): Fact => ({
      label: String(f.label ?? ''), value: String(f.value ?? '—'),
      note: f.note ? String(f.note) : undefined, missing: !!f.missing,
    })).filter((f) => f.label),
    findings,
    work: work?.title ? work : undefined,
  };

  // **黙って何も起きない、を作らない**（押しても画面が変わらない、の禁止）
  if (!out.text && !out.questions.length && !out.candidates.length && !out.findings.length
      && !out.work && !out.materials.length && !Object.keys(conditions).length) {
    throw new AppError('upstream', `empty chat turn (stop=${stop})`,
      undefined, '統括AIが応えませんでした。もう一度お試しください');
  }
  return out;
}
