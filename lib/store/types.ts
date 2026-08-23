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
  phases: { id: string; seq: number; name: string; goal: string; state: 'planned' | 'active' | 'done' | 'skipped' }[];
  tasks: { id: string; phaseId: string; title: string; intent: string; state: string; owner?: string }[];
  crew: { id: string; name: string; color: string }[];
  startedAt?: string;
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
}
