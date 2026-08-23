import { createClient } from '@/lib/supabase/server';
import type { DraftWork, Store } from './types';

/**
 * 本番の保存先。行は全部 RLS（`account_id = private.current_account_id()`）で絞られるので、
 * ここでは account_id を書かない — 既定値がデータベース側で入る。
 *
 * 承認前なので `works.status = 'plan_review'`、フェーズは `planned`、
 * タスクは `queued`。**状態を先に進めない**（それは Phase 6）。
 */
export const supabaseStore: Store = {
  kind: 'supabase',

  async createDraft(d) {
    const db = await createClient();
    const { data: work, error } = await db
      .from('works')
      .insert({ title: d.title, goal: d.goal, status: 'plan_review' })
      .select('id')
      .single();
    if (error || !work) throw new Error(error?.message ?? 'works の作成に失敗しました');

    const phases = d.plan.phases.map((p, i) => ({
      work_id: work.id, seq: i + 1, name: p.name, goal: p.goal, status: 'planned',
    }));
    if (phases.length) {
      const { data: rows, error: e2 } = await db.from('phases').insert(phases).select('id, seq');
      if (e2) throw new Error(e2.message);
      // タスクは**最初のフェーズぶんだけ**。先は前の結果を見てから引き直す
      const first = rows?.find((r) => r.seq === 1);
      if (first && d.plan.firstPhaseTasks.length) {
        const { error: e3 } = await db.from('tasks').insert(d.plan.firstPhaseTasks.map((t) => ({
          work_id: work.id, phase_id: first.id, title: t.title, intent: t.intent,
          status: 'queued', assignee_type: 'user', created_by: 'executive',
        })));
        if (e3) throw new Error(e3.message);
      }
    }
    return work.id as string;
  },

  async getDraft() {
    // 承認画面は作った直後に見るので、いまは書き戻しだけ。読みは Phase 6 で足す
    throw new Error('未実装: Phase 6 で足す');
  },
  async listDrafts() { return []; },
  async answer() { /* questions への書き戻しは Phase 6 */ },
};
