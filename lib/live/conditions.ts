import type { Conditions } from '@/lib/exec/types';

/**
 * 集めた条件 → 画面に出すチップ。**語はここ1か所**。
 *
 * 前は `/discovery` と `/discovery/result` が同じ関数を2つ持っていて、
 * 遷移するだけの2画面で 時間↔使える時間 / 資金↔元手 / 得意↔強み と言い換えていた
 * （「全画面で同じ語を使う」に反する）。**片方を直せば両方が直る形にする。**
 *
 * 「強み」は候補の相性の軸（`強みとの相性`）と同じ語に揃えてある。
 * **無いものは出さない** — 答えていない条件のチップは並べない。
 */
export function conditionChips(c: Conditions): [string, string][] {
  const out: [string, string][] = [];
  // **分野がいちばん上。** 何の話かが決まらないと、ほかの条件は意味を持たない
  if (c.interests?.length) out.push(['分野', c.interests.join(' · ')]);
  if (c.hoursPerWeek != null) out.push(['使える時間', `週${c.hoursPerWeek}時間`]);
  if (c.budgetJpy != null) out.push(['元手', `〜${Math.round(c.budgetJpy / 10000)}万円`]);
  if (c.strengths.length) out.push(['強み', c.strengths.join(' · ')]);
  if (c.avoid.length) out.push(['避ける', c.avoid.join(' · ')]);
  if (c.deadline) out.push(['期限', c.deadline]);
  return out;
}
