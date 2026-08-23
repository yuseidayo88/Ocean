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
  createdAt: string;
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
}
