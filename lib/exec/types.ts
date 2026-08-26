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

export type PlanPhase = {
  name: string; goal: string; weeks: number;
  /**
   * **そのフェーズを回す人**（名簿の「◯◯担当」。2026-08-26）。
   *
   * 前は最初のフェーズしか担当が決まっておらず、画面には**あとのフェーズだけ
   * 「担当は未定」**と出ていた。しかもそれは表示の問題ではなく、
   * **承認のときに最初のフェーズの人しか採用されない**という中身の問題だった。
   *
   * もう1つ効く — 担当を名簿から選ばせると、**AI社員に終わらせられないフェーズが置けなくなる**。
   * 「受注」を回せる人は名簿にいない（他人が動くのを待つことだから）。
   */
  owner: string;
};
export type Gate = { afterPhase: string; question: string };
export type PlanTask = { title: string; intent: string; ownerHint: string };

export type Plan = {
  weeks: number;
  phases: PlanPhase[];
  gates: Gate[];
  /** **最初のフェーズぶんだけ。** 先は前の結果を見てから引き直す */
  firstPhaseTasks: PlanTask[];
  /**
   * 承認すると作られるもの。**どのフェーズのものかは統括AIに書かせる**（2026-08-25）。
   * 前は名前だけを受け取り、画面が `Math.floor(i / per) + 1` で**順番から割り当てて**いた —
   * 誰も言っていないことを、社長が承認する画面に事実として出していた
   * （実際「対象の定義」がフェーズ1のタスクなのにフェーズ2と出ていた）。
   * 古い控え（名前だけの配列）も読めるようにしてある。
   */
  deliverables: { name: string; phase?: string }[];
  /**
   * **なぜこの計画なのか**（2026-08-26）。社長が承認を判断する材料。
   * これが無かったあいだ、計画の右ペインには**どの Work でも同じ決まり文句**が出ていた。
   */
  why: string[];
  /** 前提にしていること。**確かめていないことを正直に**（0件でよい） */
  assumes: { label: string; value: string }[];
  /** 見送った案。無ければ空 */
  dropped?: string;
  /** 時間の使い方への一言。無ければ空 */
  timeNote?: string;
  /**
   * **直しきれなかったところ**（2026-08-26）。
   *
   * `checkPlan` は前から動いていたが、**引き直したあと誰も見直していなかった** —
   * 辻褄が合わないまま（関門の行き先が実在しない・週数が合わない）の計画が、
   * 黙って社長の承認画面に出ていた。図（`draw_workflow`）のほうは
   * 「それでも壊れていれば**通らなかったと正直に言う**」と決めてあるのに、
   * 計画だけがその作法から外れていた。
   *
   * 引き直しても残った**壊れる側の診断**だけを持つ（読みにくいだけのものは持たない）。
   * 承認の画面が、押す前にそのまま見せる。**無ければ空**（節ごと出さない）。
   */
  unfixed?: string[];
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

/**
 * fit も構造（3スコア）。画面では棒で並べる — 文章で「相性が良いです」と書かない。
 *
 * **軸を入れ替えた**（2026-08-26。社長の「実際に需要があって個人1人でもできるような仕事」）。
 * 前は speed（速さ）/ cost（安さ）/ strength（得意との相性）で、
 * **「誰かが欲しがっているか」も「1人で回せるか」も入っていなかった** —
 * だから抽象的で当たり障りのない案に寄っていた。
 * cost は落とした（**お金がかかることは「1人で回せない」に吸収される**）。
 */
export type Fit = {
  /** 欲しがっている人がいるか（すでにお金や時間を使っている人がいるか） */
  demand: number;
  /** 1人で回せるか（人を雇わず、社長の使える時間で回るか） */
  solo: number;
  /** 最初の1件までの近さ */
  speed: number;
};

export type CandidateDraft = {
  name: string; summary: string;
  /** **何ができたら完了か。** 候補の時点で決めておく（あとで聞き返さない） */
  ending: string;
  why: string[];
  fit: Fit; recommended: boolean;
  notChosenWhy?: string;
  /** **誰が買うのか。**「個人」「中小企業」では書いたことにならない */
  who?: string;
  /** **最初の1人をどこで見つけるか。** ここが書けない候補は、始められない */
  firstOne?: string;
  /** **確かめていないこと。** 統括AIは Web に出られないので、需要は記憶から言うしかない */
  unsure?: string;
  /** 週に何時間要るか。社長の使える時間と突き合わせる。0 は「書かれていない」 */
  hoursPerWeek?: number;
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
