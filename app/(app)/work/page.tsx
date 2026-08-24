import { redirect } from 'next/navigation';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Work の行き先は、いちばん新しい Work。まだ無ければ、はじめての画面へ */
export default async function WorkIndex() {
  const works = await store().listWorks().catch(() => []);
  if (!works.length) redirect('/start');
  redirect(`/work/${works[works.length - 1].id}`);
}
