import type { Container, Hire, Plan, Question } from '@/lib/exec/types';

/** 承認を待っている Work 1件ぶん。画面（計画の承認）が読むのはこれだけ */
export type DraftWork = {
  id: string;
  title: string; goal: string;
  container: Container;
  questions: (Question & { answer?: string })[];
  hires: Hire[];
  plan: Plan;
  /** **本物のモデルが書いたのか、決め打ちか。** 画面に出す */
  real: boolean;
  /** 承認済みかどうか。承認したあとの計画画面は「承認済」と出して、もう押させない */
  approved?: boolean;
  createdAt: string;
};

/** 承認したあとの Work 1件ぶん。**Work 画面が読むのはこれだけ**（→ `lib/exec/work-view.ts`） */
export type LiveWork = {
  id: string;
  title: string; goal: string;
  status: 'plan_review' | 'active' | 'paused' | 'done' | 'archived';
  phases: { id: string; seq: number; name: string; goal: string; state: 'planned' | 'active' | 'review' | 'done' | 'skipped' }[];
  tasks: {
    id: string; phaseId: string; title: string; intent: string; state: string;
    owner?: string;
    /** 進捗（0-100）。**run_steps から導出される値**で、アプリは直接書けない */
    progress?: number;
    /** 担当の定義 slug。実行のとき定義文を引くのに使う */
    ownerSlug?: string;
    ownerId?: string;
  }[];
  crew: { id: string; name: string; color: string }[];
  /** その Work の成果物（新しい順） */
  dels?: LiveDeliverable[];
  startedAt?: string;
};

export type LiveDeliverable = {
  id: string; title: string; kind: string; state: string;
  preview?: string; body?: string; by?: string; when?: string; taskId?: string;
};

/** 実行の1歩。デスクの工程の行と、タスクの右ペインに出る */
export type RunStep = {
  seq: number; kind: 'message' | 'tool_use' | 'tool_result' | 'handoff';
  tool?: string; summary?: string; progress?: number; at?: string;
};

/**
 * 書き込み先。**本番は Supabase、出られない環境ではメモリ。**
 * どちらも同じ形にして、呼ぶ側が分岐しないようにする。
 */
export interface Store {
  readonly kind: 'supabase' | 'memory';
  createDraft(d: Omit<DraftWork, 'id' | 'createdAt'>): Promise<string>;
  getDraft(id: string): Promise<DraftWork | null>;
  listDrafts(): Promise<DraftWork[]>;
  answer(id: string, index: number, answer: string): Promise<void>;

  /**
   * 承認して動かす（Phase 6）。**ここで初めて状態が進む。**
   * works → active / 最初のフェーズ → active / 提案した社員を採用。
   * タスクは `queued` のまま（走らせるのは Phase 7）。
   */
  approve(id: string): Promise<void>;
  /** 計画を引き直す。フェーズとタスクを入れ替え、控えも差し替える */
  revise(id: string, d: Omit<DraftWork, 'id' | 'createdAt'>): Promise<void>;
  /** 承認したあとの Work。**Work 画面が読む** */
  getWork(id: string): Promise<LiveWork | null>;

  /* ══════════════ 実行（Phase 7）══════════════
   * 進捗（tasks.progress）はここでは書かない。**run_steps から導出される**
   * （0012 の引き金）。書けるのは、歩みと成果物と状態だけ。
   */

  /** タスクを走らせはじめる。task→running / 社員→running / runs に1行 */
  startRun(taskId: string): Promise<string>;
  /** 1歩を記録する。進捗はここから導出される */
  addStep(runId: string, step: { seq: number; kind: RunStep['kind']; tool?: string; summary?: string; progress?: number }): Promise<void>;
  /** 実行を閉じる。done なら task→done・進捗100。失敗なら task→blocked に落とす */
  finishRun(runId: string, r: { status: 'done' | 'failed'; tokensIn: number; tokensOut: number; costCents: number; error?: string }): Promise<void>;
  /** 成果物を書く。preview は本文の書き出し */
  addDeliverable(d: { workId: string; taskId: string; employeeId?: string; title: string; kind: string; body: string }): Promise<void>;
  /** 通知を立てる（判断待ち / 要確認 / エラー） */
  addNotification(n: { kind: string; body: string; subjectType?: string; subjectId?: string }): Promise<void>;
  /** タスクの歩み（右ペインが読む） */
  getSteps(taskId: string): Promise<RunStep[]>;
  /** 次に走らせる queued のタスク。無ければ null。running が居るあいだも null */
  nextQueued(workId: string): Promise<{ taskId: string } | null>;
  /**
   * 社長の判断で止まる（失敗ではない）。task→needs_decision、
   * decisions に open の1行、判断待ちの通知（Phase 9 で答える側を作る）
   */
  markDecision(taskId: string, d: { question: string; why: string; options: unknown[] }): Promise<void>;
}
