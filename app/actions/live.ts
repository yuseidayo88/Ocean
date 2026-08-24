'use server';

/**
 * ゼロ状態の読み書き。**画面はここを通して store だけを読む** — ダミーは無い。
 * 読みは失敗しても画面を壊さない（空を返す）。書きは失敗を言う。
 */
import { hasKey, providerFor } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { CONSTITUTION } from '@/lib/exec/constitution';
import { store, type ChatMsg, type ChatThread, type LiveWork, type Note, type SkillRow } from '@/lib/store';
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
export async function railData(): Promise<{ threads: ChatThread[]; unread: number; staff: number }> {
  try {
    const s = store();
    const [threads, notes, staff] = await Promise.all([
      s.listThreads(), s.listNotes(), s.listEmployees(),
    ]);
    return { threads, unread: notes.filter((n) => !n.read).length, staff: staff.length };
  } catch { return { threads: [], unread: 0, staff: 0 }; }
}

export async function companyName(): Promise<string> {
  try { return await store().companyName(); } catch { return 'あなたの会社'; }
}

/**
 * チャットに書くと、統括AIが返す（fast の1往復・道具なし）。
 * 鍵が無い環境は FakeProvider が**仮の返事だと名乗って**返す — 偽の会話を作らない。
 * 返事の生成に失敗しても、書いた発言は消えない（先に保存する）。
 */
export async function sendChat(
  threadId: string | null, text: string,
): Promise<{ ok: boolean; threadId?: string; message?: string }> {
  const body = text.trim();
  if (!body) return { ok: false, message: '書いてから送ってください' };
  try {
    const s = store();
    const id = await s.addChat(threadId, 'user', body);

    // 会社のいまを1枚に畳んで渡す（Work をまたいだ相談に答えるため）
    const works = await s.listWorks().catch(() => [] as LiveWork[]);
    const snapshot = works.length
      ? works.map((w) => {
          const at = w.phases.find((p) => p.state === 'active' || p.state === 'review');
          return `- ${w.title}（${w.status === 'paused' ? '停止中' : at ? `フェーズ${at.seq}: ${at.name}` : w.status}）`;
        }).join('\n')
      : '- まだ Work はありません';

    const { messages } = (await s.getThread(id)) ?? { messages: [] };
    const history = messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));

    const provider = hasKey() ? providerFor('fast') : new FakeProvider();
    let out = '';
    for await (const c of provider.stream({
      tier: 'fast', effort: 'low', maxTokens: 1000,
      system: `${CONSTITUTION}\n\nいまの会社:\n${snapshot}\n\nあなたは社長との相談に日本語で短く答える。分からないことは分からないと言う。`,
      messages: history,
    })) {
      if (c.type === 'text') out += c.text;
    }
    if (out.trim()) await s.addChat(id, 'executive', out.trim());
    return { ok: true, threadId: id };
  } catch (e) {
    return { ok: false, message: sayError(e, '送れませんでした') };
  }
}
