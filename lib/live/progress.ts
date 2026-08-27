import type { LiveWork } from '@/lib/store/types';

/**
 * **Work がどこまで来たか。会社の中で1つの数え方**（2026-08-27）。
 *
 * 前はここに**2つの数え方**があった —
 * ホームの輪は**フェーズを週数で重みづけて**合成し（この関数）、
 * Work 画面は「済んだタスク ÷ ぜんぶのタスク」だった。ところが
 * **タスクは直近のフェーズぶんしか引かれていない**（先を固定しない設計）ので、
 * 4フェーズの Work でフェーズ1が終わると Work 画面は **100%**。
 * 実測で「進捗 100% / フェーズ 1 / 2」が隣り合って出ていて、
 * しかもホームの輪は同じ Work を 50% と描いていた。
 *
 * **同じ Work の進み具合を、2つの画面が別々に数えない。**
 */

/** フェーズの重み（弧とガントの幅）。週数があれば週数、無ければ等分 */
export const weight = (w: LiveWork) => {
  const ws = w.phases.map((p) => p.weeks ?? 0);
  return ws.some((x) => x > 0) ? ws.map((x) => Math.max(x, 0.5)) : w.phases.map(() => 1);
};

export const phaseTasks = (w: LiveWork, phaseId: string) => w.tasks.filter((t) => t.phaseId === phaseId);

/** フェーズの進み（0-1）。終わったタスク＋走っているタスクの自己申告 */
export function phaseDone(w: LiveWork, phaseId: string): number {
  const ts = phaseTasks(w, phaseId);
  if (!ts.length) return 0;
  const sum = ts.reduce((a, t) => a + (t.state === 'done' ? 100 : t.progress ?? 0), 0);
  return Math.min(1, sum / (ts.length * 100));
}

/** Work 全体の進み（%）。フェーズの重みで合成する */
export function workPct(w: LiveWork): number {
  const ws = weight(w);
  const total = ws.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let acc = 0;
  w.phases.forEach((p, i) => {
    const r = p.state === 'done' || p.state === 'skipped' ? 1 : phaseDone(w, p.id);
    acc += (ws[i] / total) * r;
  });
  return Math.round(acc * 100);
}
