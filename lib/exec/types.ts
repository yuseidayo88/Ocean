/** Phase 5 で統括AIが返してくるもの。道具の入力とそのまま同じ形 */

export type Verdict = 'work' | 'phase' | 'task';

export type Container = {
  verdict: Verdict;
  title: string; goal: string; weeks: number;
  intoWorkId?: string;
  /** 3条件の内訳。**なぜそう決めたかを画面に出す** */
  ends: boolean; alone: boolean; short: boolean;
  reason: string;
};

export type Option = { label: string; description: string; recommended?: boolean };
export type Question = { body: string; why: string; options: Option[] };
export type Hire = { definitionId: string; displayName: string; why: string; forPhase: string };

export type PlanPhase = { name: string; goal: string; weeks: number };
export type Gate = { afterPhase: string; question: string };
export type PlanTask = { title: string; intent: string; ownerHint: string };

export type Plan = {
  weeks: number;
  phases: PlanPhase[];
  gates: Gate[];
  /** **最初のフェーズぶんだけ。** 先は前の結果を見てから引き直す */
  firstPhaseTasks: PlanTask[];
  deliverables: string[];
};

/** 1回まわした結果。**途中で止まることがある**（終わりが言えないとき） */
export type Draft =
  | { kind: 'need_end'; body: string; options: Option[] }
  | { kind: 'draft'; container: Container; questions: Question[]; hires: Hire[]; plan: Plan };
