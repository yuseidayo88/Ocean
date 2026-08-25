import { DEFAULT_PREF, type Effort } from '@/lib/ai';
import { store } from '@/lib/store';

/**
 * **その人が、どのモデルで、どれだけ考えるか。**
 * メンバー画面で社長が選んだもの（`agent_prefs`）を、実行の直前に読む。
 *
 * **選べるのに効かない、を作らない。** 画面に出ている名前と、上流に届く名前は同じ。
 * まだ選んでいなければ既定（`DEFAULT_PREF`）— 画面もそれを出すので食い違わない。
 * 読めなくても実行は止めない（既定で走る）。
 */
export type Pref = { model: string; effort: Effort };

/** 統括AI（会社に1人。employees に行を持たないので employee_id は null） */
export async function execPref(): Promise<Pref> {
  const p = await store().prefOf(null).catch(() => null);
  return { model: p?.model ?? DEFAULT_PREF.exec.model, effort: p?.effort ?? DEFAULT_PREF.exec.effort };
}

/**
 * AI社員。**担当のいないタスクに統括AIの設定を当てない** —
 * `prefOf(null)` は統括AIを引くので、id が無いときは読みに行かない。
 */
export async function staffPref(employeeId: string | null | undefined): Promise<Pref> {
  const def = DEFAULT_PREF.employee;
  if (!employeeId) return { ...def };
  const p = await store().prefOf(employeeId).catch(() => null);
  return { model: p?.model ?? def.model, effort: p?.effort ?? def.effort };
}
