'use server';

/**
 * ホーム4ビューが読む1本。**live のデータを絵の形にして渡す**（→ lib/live/home.ts）。
 * 読みだけ。失敗しても画面を壊さない（空の会社として返す）。
 */
import { store } from '@/lib/store';
import { buildHome, type HomeData } from '@/lib/live/home';
import type { RunStep } from '@/lib/store';

export async function homeData(): Promise<HomeData> {
  try {
    const s = store();
    const [works, employees, notes, steps] = await Promise.all([
      s.listWorks(), s.listEmployees(), s.listNotes(), s.recentSteps(30),
    ]);
    // 走っているタスクの歩み（少数）。デスクの工程の行が読む
    const runningIds = works.flatMap((w) => w.tasks.filter((t) => t.state === 'running').map((t) => t.id));
    const stepPairs = await Promise.all(runningIds.map(async (id) => [id, await s.getSteps(id)] as [string, RunStep[]]));
    return buildHome(works, employees, notes, steps, new Map(stepPairs));
  } catch {
    return buildHome([], [], [], [], new Map());
  }
}
