'use server';

import { draftWork } from '@/lib/exec/run';
import { store, type DraftWork, type LiveWork } from '@/lib/store';
import type { Draft } from '@/lib/exec/types';
import type { PlanLimits } from '@/lib/exec/plan-check';
import { sayError } from '@/lib/errors';

/**
 * ゴールを1つ受け取って、**承認を待つ計画まで**作る（Phase 5）。
 *
 *   ゴール → 入れ物の判定 → 質問 → 採用の提案 → 計画 → 保存
 *
 * 承認して状態を進めるのは `approveWork`（Phase 6）。
 */
export type StartResult =
  | { ok: true; id: string; real: boolean }
  /** 終わりが言えないので、入れ物に入れずに聞き返す */
  | { ok: false; need: 'end'; body: string; options: { label: string; description: string }[] }
  | { ok: false; need: 'error'; message: string };

/**
 * `goal` は**社長の言葉**（画面の吹き出しにそのまま出る）。
 * `ctx` は**統括AIにだけ渡す背景**（候補のねらい・集めた条件・診断の根拠）。
 *
 * 分けているのは、前は全部つないで1つのゴールにしていたから —
 * 「◯◯を立ち上げたい 終わり: … 背景: … 分野: … 使える時間: … やりたくない: …」が
 * **社長が書いた言葉として吹き出しに出ていた**。読めたものではないし、嘘でもある。
 */
export async function startWork(
  goal: string, ctx = '', limits: PlanLimits = {},
): Promise<StartResult> {
  const text = goal.trim();
  if (!text) return { ok: false, need: 'error', message: 'やりたいことを書いてください' };

  let out: { draft: Draft; real: boolean };
  try {
    out = await draftWork(text, ctx, limits);
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, '統括AIが応えませんでした') };
  }

  if (out.draft.kind === 'need_end') {
    return { ok: false, need: 'end', body: out.draft.body, options: out.draft.options };
  }

  const d = out.draft;
  /**
   * **空の計画を作らない。**
   * 道具は来たのに中身が無い（フェーズ0・タスク0）ことが実際に起きて、
   * 「0フェーズで進めます。まず「」から —。」という**壊れた計画案**ができた。
   * 空のまま Work にすると、承認しても動くものが1つも無い。
   * ここで止めて、社長には**引き直せる**ことを言う。
   */
  if (!d.plan.phases.length || !d.plan.firstPhaseTasks.length) {
    return {
      ok: false, need: 'error',
      message: '計画を引けませんでした（中身が空でした）。もう一度お試しください',
    };
  }

  const id = await store().createDraft({
    title: d.container.title,
    // 画面の吹き出しは**社長が書いた言葉そのまま**。統括AIが言い直したものは container.goal に持つ
    goal: text,
    container: d.container,
    questions: d.questions,
    hires: d.hires,
    plan: d.plan,
    real: out.real,
  });
  return { ok: true, id, real: out.real };
}

/** 質問に答える。**台帳には出さない**（事業判断だけが decisions に昇格する） */
export async function answerQuestion(id: string, index: number, answer: string) {
  await store().answer(id, index, answer);
}

export async function getDraft(id: string): Promise<DraftWork | null> {
  return store().getDraft(id);
}


/**
 * **承認して始める**（Phase 6）。ここで初めて状態が進む。
 *   works → `active` ／ 最初のフェーズ → `active` ／ 提案した社員を採用
 * **タスクは `queued` のまま。** 走らせるのは Phase 7 —
 * ここで `running` にすると、動いていないのに動いていることになる。
 */
export type ApproveResult = { ok: true } | { ok: false; message: string };

export async function approveWork(id: string): Promise<ApproveResult> {
  try {
    await store().approve(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '承認できませんでした') };
  }
}

/**
 * **計画を直す**（Phase 6）。書いた直しを統括AIに渡して引き直す。
 * 立てたときと同じ道を通す（鍵が無ければ決め打ちのプロバイダ）。
 */
export type ReviseResult = { ok: true; real: boolean } | { ok: false; message: string };

export async function reviseWork(id: string, ask: string): Promise<ReviseResult> {
  const text = ask.trim();
  if (!text) return { ok: false, message: '直したいところを書いてください' };

  const before = await store().getDraft(id);
  if (!before) return { ok: false, message: 'その計画は見つかりませんでした' };
  if (before.approved) return { ok: false, message: 'もう承認された計画は直せません' };

  let out: { draft: Draft; real: boolean };
  try {
    // 前の計画を文脈に渡す。**ゼロから引き直させない**（直しなので、残すところは残す）
    // **社長が答えたことも渡す** — 聞いておいて引き直しで忘れるのがいちばん失礼
    const answered = before.questions
      .filter((q) => q.answer)
      .map((q) => `${q.body} → ${q.answer}`);
    out = await draftWork(before.goal, [
      'これは引き直しです。前に立てた計画はこうでした:',
      JSON.stringify({ container: before.container, plan: before.plan, hires: before.hires }),
      ...(answered.length ? ['', '社長がすでに答えていること:', ...answered] : []),
      '',
      '社長からの直しの指示:',
      text,
    ].join('\n'));
  } catch (e) {
    return { ok: false, message: sayError(e, '統括AIが応えませんでした') };
  }
  if (out.draft.kind === 'need_end') return { ok: false, message: out.draft.body };

  const d = out.draft;
  /**
   * **空の計画で上書きしない**（2026-08-25）。立てるときには止めていたのに、
   * **引き直しには同じ守りが無かった** — 「直したい」を押した往復が空で返ると、
   * ちゃんとしていた計画が「0フェーズ」に置き換わる。直しは元より悪くならない、が要る。
   */
  if (!d.plan.phases.length || !d.plan.firstPhaseTasks.length) {
    return { ok: false, message: '引き直せませんでした（中身が空でした）。前の計画はそのままです' };
  }
  await store().revise(id, {
    title: d.container.title, goal: before.goal,
    container: d.container, questions: d.questions, hires: d.hires, plan: d.plan, real: out.real,
  });
  return { ok: true, real: out.real };
}

/** 承認したあとの Work。**Work 画面が読む** */
export async function getWork(id: string): Promise<LiveWork | null> {
  return store().getWork(id);
}
