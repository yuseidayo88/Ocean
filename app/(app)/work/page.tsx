import { redirect } from 'next/navigation';
import { WORKS } from '@/lib/dummy';

/** Work の行き先は、いま見ている Work。一覧はホームの進捗が兼ねる */
export default function WorkIndex() {
  redirect(`/work/${WORKS[1].id}`);
}
