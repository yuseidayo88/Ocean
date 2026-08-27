'use server';

import { store } from '@/lib/store';
import { sayError } from '@/lib/errors';
import type { PublishedPage } from '@/lib/store/types';

/**
 * **公開する**（2026-08-27。社長の「他のやつから順に」の③）。
 *
 * **外に出る道具は Approval 必須**（→ `docs/PLAN.md` 守るルール）。
 * ここは社長が押したときにしか呼ばれない — AI社員の道具にはしていない。
 * **統括AIも自分では公開できない。**
 */

export async function publishPage(delId: string): Promise<{
  ok: boolean; message?: string; page?: PublishedPage;
}> {
  try { return await store().publishPage(delId); }
  catch (e) { return { ok: false, message: sayError(e, '公開できませんでした') }; }
}

export async function unpublishPage(delId: string): Promise<{ ok: boolean; message?: string }> {
  try { await store().unpublishPage(delId); return { ok: true }; }
  catch (e) { return { ok: false, message: sayError(e, '下げられませんでした') }; }
}

/** いま出ているか。**下げてあれば null**（出ていないものを出ていると言わない） */
export async function publishedFor(delId: string): Promise<PublishedPage | null> {
  try { return await store().publishedFor(delId); } catch { return null; }
}
