'use server';

import { draftWork } from '@/lib/exec/run';
import { store, type DraftWork } from '@/lib/store';
import type { Draft } from '@/lib/exec/types';

/**
 * ゴールを1つ受け取って、**承認を待つ計画まで**作る（Phase 5）。
 *
 *   ゴール → 入れ物の判定 → 質問 → 採用の提案 → 計画 → 保存
 *
 * **承認はしない。** 状態を進めるのは Phase 6。
 */
export type StartResult =
  | { ok: true; id: string; real: boolean }
  /** 終わりが言えないので、入れ物に入れずに聞き返す */
  | { ok: false; need: 'end'; body: string; options: { label: string; description: string }[] }
  | { ok: false; need: 'error'; message: string };

export async function startWork(goal: string): Promise<StartResult> {
  const text = goal.trim();
  if (!text) return { ok: false, need: 'error', message: 'やりたいことを書いてください' };

  let out: { draft: Draft; real: boolean };
  try {
    out = await draftWork(text);
  } catch (e) {
    return { ok: false, need: 'error', message: e instanceof Error ? e.message : '統括AIが応えませんでした' };
  }

  if (out.draft.kind === 'need_end') {
    return { ok: false, need: 'end', body: out.draft.body, options: out.draft.options };
  }

  const d = out.draft;
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
