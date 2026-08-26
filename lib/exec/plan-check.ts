import type { Plan } from './types';

/**
 * **引いたロードマップを、機械で読み返す**（2026-08-26）。
 *
 * 憲法には「**着かない計画は、引き直します**」と書いてあるのに、
 * 引き直させる仕掛けがありませんでした（図には validate → 描き直しがあるのに）。
 * 検査は2つだけ — 空でないか / 担当が名簿にいるか。
 *
 * ここで見るのは**言葉の中身ではなく、辻褄**です。
 * 「このフェーズの名前が良いか」はモデルにしか分からないが、
 * 「関門の行き先が実在しないフェーズを指している」は**こちらで分かる**。
 * 分かるものを見ずに社長へ出さない。
 *
 * 戻すのは日本語の指摘。**そのまま統括AIに渡して1回だけ直させる**（→ `lib/exec/run.ts`）。
 */
export type PlanDiag = { rule: string; say: string; fatal: boolean };

/** 社長が渡している条件のうち、計画が守るべきもの */
export type PlanLimits = { hoursPerWeek?: number | null; deadline?: string | null };

export function checkPlan(plan: Plan, limits: PlanLimits = {}): PlanDiag[] {
  const d: PlanDiag[] = [];
  const names = new Set(plan.phases.map((p) => p.name));

  /* ── 壊れている（社長に見せる前に直す） ── */

  if (plan.phases.length < 2) {
    d.push({ rule: 'phases', fatal: true,
      say: `フェーズが ${plan.phases.length} つしかありません。終わりの形から逆に引いて、2つ以上に分けてください` });
  }
  if (plan.phases.length > 7) {
    d.push({ rule: 'phases', fatal: true,
      say: `フェーズが ${plan.phases.length} つあります。7つ以内にまとめてください（細かすぎる計画は守れません）` });
  }
  if (!plan.firstPhaseTasks.length) {
    d.push({ rule: 'first-tasks', fatal: true,
      say: '最初のフェーズのタスクが1つもありません。承認したその日から動けるタスクを書いてください' });
  }
  for (const g of plan.gates) {
    if (!names.has(g.afterPhase)) {
      d.push({ rule: 'gate-phase', fatal: true,
        say: `関門「${g.question}」の after_phase が「${g.afterPhase}」ですが、そんなフェーズはありません。フェーズの名前と同じ字で書いてください` });
    }
  }
  for (const m of plan.deliverables) {
    if (m.phase && !names.has(m.phase)) {
      d.push({ rule: 'deliverable-phase', fatal: true,
        say: `成果物「${m.name}」のフェーズが「${m.phase}」ですが、そんなフェーズはありません` });
    }
  }
  const sum = plan.phases.reduce((a, p) => a + (p.weeks || 0), 0);
  if (plan.weeks > 0 && sum > 0 && Math.abs(sum - plan.weeks) > 0.6) {
    d.push({ rule: 'weeks', fatal: true,
      say: `フェーズの週数を足すと ${sum}週 ですが、全体は ${plan.weeks}週 と書いてあります。どちらかに合わせてください` });
  }
  if (!plan.why.length) {
    d.push({ rule: 'why', fatal: true,
      say: 'なぜこの順番なのかが書かれていません。社長はそれを読んで承認するかを決めます' });
  }

  /* ── 守れていない（直させるが、通らなくても出す） ── */

  /**
   * **社長が使える時間の中で回る形にします**（憲法）。
   * 週に使える時間が渡されているのに、10週で毎週20時間必要な計画を引いたら、
   * それは守れない計画。ざっくりでも、超えているなら言う。
   */
  if (limits.hoursPerWeek && plan.weeks > 0) {
    const perPhase = plan.phases.filter((p) => (p.weeks || 0) < 0.5).length;
    if (perPhase) {
      d.push({ rule: 'hours', fatal: false,
        say: `週 ${limits.hoursPerWeek}時間 と聞いているのに、半週で終わるフェーズが ${perPhase} つあります。使える時間の中で回る週数にしてください` });
    }
  }
  if (!plan.assumes.length) {
    d.push({ rule: 'assumes', fatal: false,
      say: '前提にしていることが1つも書かれていません。確かめていないことがあるなら、社長が「それは違う」と言えるように書いてください' });
  }
  // 名前がフェーズと同じ成果物、はたいてい書き写しの失敗
  for (const m of plan.deliverables) {
    if (names.has(m.name)) {
      d.push({ rule: 'deliverable-name', fatal: false,
        say: `成果物「${m.name}」がフェーズと同じ名前です。何が出来上がるのかが分かる名前にしてください` });
    }
  }

  return d;
}

export const fatalPlan = (d: PlanDiag[]): PlanDiag[] => d.filter((x) => x.fatal);

/** 直してもらうときの頼み文。**指したところだけ**言う（全部書き直させない） */
export const sayPlanDiags = (d: PlanDiag[]): string =>
  ['引いてもらった計画に、辻褄の合わないところがありました。',
   ...d.map((x) => `- ${x.say}`),
   '',
   '**ここだけ直して、`draft_plan` をもう一度呼んでください。**',
   'ほかは変えなくてかまいません。'].join('\n');
