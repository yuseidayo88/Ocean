'use server';

import { runTask, type RunOutcome } from '@/lib/run/worker';
import { store, type LiveDecision, type LiveDeliverable, type LiveEmployee, type RunStep } from '@/lib/store';
import { AppError } from '@/lib/errors';
import { draftNextTasks } from '@/lib/exec/next';
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

    /**
     * **残高が尽きたら走らせない**（Phase 11）。Work ごと paused に落とす —
     * ポーリングのたびに同じ通知が積もらないし、設計の言葉どおり
     * 「paused = 止める / 予算上限」。トークンの数字はふだんの画面に出さない。
     * 再開は残高が入ってから（プラン画面）。
     */
    const balance = await s.balanceCents().catch(() => null);
    if (balance !== null && balance <= 0) {
      await s.pauseWork(workId, '枠に当たって止まりました。プランを見てください');
      return { ran: false };
    }

    const outcome = await runTask(work, next.taskId);
    // フェーズのタスクが出そろったら review に畳む（判断待ちの通知つき）
    await s.closePhaseIfDone(workId).catch(() => {});
    return { ran: true, taskId: next.taskId, outcome };
  } catch (e) {
    // 取り合いに負けただけなら何も起きていない（もう一方のポンプが走らせている）
    if (e instanceof AppError && e.kind === 'conflict') return { ran: false };
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

/** 承認する。状態が 承認済 になるだけ — 大げさなことは起きない（二度押しは何もしない） */
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
    // 差し戻せた1回だけが直しタスクを積む（二度押し・同時押しで2つ積まれない）
    const flipped = await store().setDelStatus(delId, 'rejected');
    if (!flipped) return { ok: false, message: 'この成果物はもう片づいています' };
    await store().addFixTask(workId, src, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '差し戻せませんでした') };
  }
}

/* ══════════════ 判断と受け渡し（Phase 9）══════════════ */

/** そのタスクで開いている判断（右ペインが読む） */
export async function taskDecision(taskId: string): Promise<LiveDecision | null> {
  try { return await store().getDecision(taskId); } catch { return null; }
}

/**
 * 社長が決める。decisions → decided、タスクは queued に戻り、
 * **次の実行は決めたことを文脈に持って**走り直す（ポンプが拾う）。
 */
export async function decide(decisionId: string, chosen: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await store().answerDecision(decisionId, chosen);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '決められませんでした') };
  }
}

/** 会社の決めたこと（決定事項画面が読む） */
export async function listDecisions(): Promise<LiveDecision[]> {
  try { return await store().listDecisions(); } catch { return []; }
}

/**
 * **review のフェーズを承認して、次のフェーズへ。**
 * 統括AIが前のフェーズの成果物と決定を見て、次のタスクを引いてから進める。
 */
export async function approvePhase(workId: string): Promise<{ ok: boolean; next?: string | null; message?: string }> {
  try {
    const s = store();
    const work = await s.getWork(workId);
    if (!work) return { ok: false, message: 'Work が見つかりません' };
    const review = work.phases.find((p) => p.state === 'review');
    if (!review) return { ok: false, message: '承認を待っているフェーズがありません' };

    const after = work.phases.find((p) => p.seq === review.seq + 1);
    const tasks = after
      ? await draftNextTasks(work, { name: after.name, goal: after.goal },
          (await s.listDecisions(workId)).filter((d) => d.status === 'decided'))
      : [];
    const next = await s.advancePhase(workId, tasks);
    return { ok: true, next };
  } catch (e) {
    return { ok: false, message: sayError(e, '進められませんでした') };
  }
}

/* ══════════════ 社員（Phase 10）══════════════ */

/**
 * 採用する。**候補の id ではなくロスターの定義で採る**（→ lib/roster）。
 * 同じ定義の社員がいれば使い回す — 調査担当が2人にならない。
 */
export async function hire(definitionId: string, displayName: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await store().hireEmployee(definitionId, displayName);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '採用できませんでした') };
  }
}

/** 在籍の一覧（メンバー画面が読む） */
export async function listEmployees(): Promise<LiveEmployee[]> {
  try { return await store().listEmployees(); } catch { return []; }
}

/* ══════════════ 課金の骨格（Phase 11）══════════════ */

/** 請求・プラン画面が読む。**トークンの数字を出していいのはこの画面だけ** */
export async function billing(): Promise<{
  balanceTokens: number | null;
  rows: { deltaTokens: number; reason: string; when?: string }[];
}> {
  try {
    const s = store();
    const [cents, rows] = await Promise.all([s.balanceCents(), s.ledger()]);
    // 1トークン = $0.00001 → 1セント = 1,000トークン（→ docs/design/05）
    return {
      balanceTokens: cents === null ? null : cents * 1000,
      rows: rows.map((r) => ({ deltaTokens: r.deltaCents * 1000, reason: r.reason, when: r.when })),
    };
  } catch {
    return { balanceTokens: null, rows: [] };
  }
}
/* ══════════════ 朝の報告 ══════════════ */

/**
 * その日はじめて開いたとき、統括AIが**聞かれる前に**きのうの動きを1通にする。
 * 器（Shell）が開いたときに1回だけ呼ぶ。重複はストア側が日付で止める。
 * 失敗しても画面は困らない（報告は義務ではない）ので、黙って false。
 */
export async function morning(day: string): Promise<boolean> {
  try { return await store().morningBrief(day); } catch { return false; }
}
