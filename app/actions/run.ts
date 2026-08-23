'use server';

import { runTask, type RunOutcome } from '@/lib/run/worker';
import { store, type RunStep } from '@/lib/store';
import { sayError } from '@/lib/errors';

/**
 * ポンプ（Phase 7）。**開いている画面が、次のタスクを起こす。**
 *
 * Durable Object もキューも無い環境（Vercel / ローカル）でも死なない形 —
 * Work 画面が active のあいだ数秒ごとに呼び、running が居なければ次の queued を1つ走らせる。
 * 呼ばれなければ何も動かない＝**社長が見ていないところで料金だけ増える、が起きない**。
 * 常時実行（Cron / DO）は Cloudflare に出るときに足す（→ docs/design/05）。
 */
export type PumpResult =
  | { ran: false }
  | { ran: true; taskId: string; outcome: RunOutcome };

export async function pumpWork(workId: string): Promise<PumpResult> {
  try {
    const s = store();
    const next = await s.nextQueued(workId);
    if (!next) return { ran: false };
    const work = await s.getWork(workId);
    if (!work || work.status !== 'active') return { ran: false };
    const outcome = await runTask(work, next.taskId);
    return { ran: true, taskId: next.taskId, outcome };
  } catch (e) {
    return { ran: true, taskId: '', outcome: { ok: false, error: sayError(e, '実行が止まりました') } };
  }
}

/** タスクの歩み。右ペインが読む */
export async function taskSteps(taskId: string): Promise<RunStep[]> {
  return store().getSteps(taskId);
}
