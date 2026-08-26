import { redirect } from 'next/navigation';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Work の行き先は、いちばん新しい Work。まだ無ければ、はじめての画面へ。
 *
 * **まだ承認していないものは、計画の画面へ**（2026-08-26）。
 * 承認しないと何も始まらないので、行き先は Work の中身ではなく承認のほう —
 * 前は「まだ始まっていません。」とだけ書かれた画面に落ちていた。
 */
export default async function WorkIndex() {
  const works = await store().listWorks().catch(() => []);
  if (!works.length) redirect('/start');
  const last = works[works.length - 1];
  redirect(last.status === 'plan_review' ? `/work/${last.id}/plan` : `/work/${last.id}`);
}
