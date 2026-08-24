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

/* ══════════════ 入口（Case B / D）══════════════ */

/**
 * 条件は**構造で持つ**（→ 01-data-model.md 入口）。
 * 自由記述にすると、条件を1つ変えて候補を出し直せなくなる。
 */
export type Conditions = {
  /**
   * **何の分野か。** これが分からないまま候補を出すと
   * 「小さな実用品の販売所」「受注型テンプレート制作」のように、
   * **何に関するものか誰にも分からない案**になる（実際そうなった）。
   * 興味のある分野・やってみたい業種・扱いたいもの。
   */
  interests: string[];
  hoursPerWeek?: number | null;
  budgetJpy?: number | null;
  strengths: string[];
  avoid: string[];
  deadline?: string | null;
};

/** fit も構造（3スコア）。画面では棒で並べる — 文章で「相性が良いです」と書かない */
export type Fit = { speed: number; cost: number; strength: number };

export type CandidateDraft = {
  name: string; summary: string;
  /** **何ができたら完了か。** 候補の時点で決めておく（あとで聞き返さない） */
  ending: string;
  why: string[];
  fit: Fit; recommended: boolean;
  notChosenWhy?: string;
};

/** 診断の数字の帯1つ。missing = 測れていない（それ自体が診断） */
export type Fact = { label: string; value: string; note?: string; missing?: boolean };

/** 見つかったこと1件。**必ず「次に何をするか（Work）」まで持つ** */
export type Finding = {
  severity: '重い' | '中くらい' | '軽い';
  title: string; why: string;
  evidence: string[];
  work: { title: string; goal: string; weeks: number };
  /**
   * もう Work にしたなら、その id。**候補の `adopted_work_id` と同じ役目** —
   * これが無いと、戻って押すたびに同じ Work が何本でも立つ（入口2つで守りが食い違う）
   */
  workId?: string;
};
