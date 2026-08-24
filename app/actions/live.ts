'use server';

/**
 * ゼロ状態の読み書き。**画面はここを通して store だけを読む** — ダミーは無い。
 * 読みは失敗しても画面を壊さない（空を返す）。書きは失敗を言う。
 */
import { store, type ChatMsg, type ChatThread, type LiveEmployee, type LiveWork, type Note, type SkillRow } from '@/lib/store';
import { sayError } from '@/lib/errors';

export async function worksList(): Promise<LiveWork[]> {
  try { return await store().listWorks(); } catch { return []; }
}

export async function notesList(): Promise<Note[]> {
  try { return await store().listNotes(); } catch { return []; }
}

export async function readNote(id: string): Promise<void> {
  try { await store().readNote(id); } catch { /* 読んだ印が付かないだけ */ }
}

export async function threadsList(): Promise<ChatThread[]> {
  try { return await store().listThreads(); } catch { return []; }
}

export async function threadGet(id: string): Promise<{ thread: ChatThread; messages: ChatMsg[] } | null> {
  try { return await store().getThread(id); } catch { return null; }
}

export async function skillsList(): Promise<SkillRow[]> {
  try { return await store().listSkills(); } catch { return []; }
}

export async function skillToggle(id: string, on: boolean): Promise<void> {
  try { await store().setSkill(id, on); } catch { /* トグルが戻るだけ */ }
}

export async function skillAdd(x: { name: string; filename: string; body: string }): Promise<{ ok: boolean; message?: string }> {
  if (!x.filename.endsWith('.md') || !x.body.trim()) return { ok: false, message: '.md の中身が要ります' };
  try { await store().addSkill(x); return { ok: true }; }
  catch (e) { return { ok: false, message: sayError(e, '読み込めませんでした') }; }
}

export async function skillRemove(id: string): Promise<void> {
  try { await store().removeSkill(id); } catch { /* 消えなかったら残るだけ */ }
}

/** その社員の学び（設定ペインが読む・社長が消す） */
export async function learningsGet(employeeId: string): Promise<string[]> {
  try { return await store().learnings(employeeId); } catch { return []; }
}

export async function learningsSet(employeeId: string, lines: string[]): Promise<void> {
  try { await store().setLearnings(employeeId, lines); } catch { /* 消えなかったら残るだけ */ }
}

/** レールが読む3つ（チャット履歴・未読の数・在籍の数）。画面を移るたびに呼ばれるので安く */
/**
 * 器がいちばん最初に要るもの。**1回で全部取る。**
 *
 * 前は レール（3本）と 会社名 が別々のサーバーアクションで、**画面を開くたびに
 * 往復が2回**あった。器の中身は1つのまとまりなので、1回で返す。
 */
export type RailData = { threads: ChatThread[]; unread: number; staff: number; company: string };

/** メンバーの画面が要るもの。**1回で取る**（在籍とスキルは一緒に出る） */
export async function teamData(): Promise<{ staff: LiveEmployee[]; skills: SkillRow[] }> {
  try {
    const s = store();
    const [staff, skills] = await Promise.all([s.listEmployees(), s.listSkills()]);
    return { staff, skills };
  } catch { return { staff: [], skills: [] }; }
}

export async function railData(): Promise<RailData> {
  try {
    const s = store();
    const [threads, notes, staff, company] = await Promise.all([
      s.listThreads(), s.listNotes(), s.listEmployees(), s.companyName(),
    ]);
    return { threads, unread: notes.filter((n) => !n.read).length, staff: staff.length, company };
  } catch { return { threads: [], unread: 0, staff: 0, company: 'あなたの会社' }; }
}

