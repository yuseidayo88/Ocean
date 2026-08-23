'use server';

import { runTask, type RunOutcome } from '@/lib/run/worker';
import { store, type LiveDeliverable, type RunStep } from '@/lib/store';
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
    // フェーズのタスクが出そろったら review に畳む（判断待ちの通知つき）
    await s.closePhaseIfDone(workId).catch(() => {});
    return { ran: true, taskId: next.taskId, outcome };
  } catch (e) {
    return { ran: true, taskId: '', outcome: { ok: false, error: sayError(e, '実行が止まりました') } };
  }
}

/** タスクの歩み。右ペインが読む */
export async function taskSteps(taskId: string): Promise<RunStep[]> {
  return store().getSteps(taskId);
}


/* ══════════════ レビューと承認（Phase 8）══════════════ */

/** 会社の成果物ぜんぶ（新しい順）。成果物画面が読む */
export async function listDels(): Promise<(LiveDeliverable & { workId: string; workTitle: string })[]> {
  try { return await store().listDels(); } catch { return []; }
}

/** 承認する。状態が 承認済 になるだけ — 大げさなことは起きない */
export async function approveDel(delId: string): Promise<void> {
  await store().setDelStatus(delId, 'approved');
}

/**
 * 差し戻す。**直しは言葉で** — 書いた指摘がそのまま直しタスクになり、
 * 同じ担当に積まれて、ポンプが走らせる。
 */
export async function sendBackDel(
  delId: string, workId: string, src: { taskId?: string; title: string }, note: string,
): Promise<{ ok: boolean; message?: string }> {
  const text = note.trim();
  if (!text) return { ok: false, message: '直したいところを書いてください' };
  try {
    await store().setDelStatus(delId, 'rejected');
    await store().addFixTask(workId, src, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '差し戻せませんでした') };
  }
}