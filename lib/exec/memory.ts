import type { ToolDef } from '@/lib/ai/provider';
import { store } from '@/lib/store';
import { execPref } from './pref';
import { pickProvider } from './provider';

/**
 * **記憶の手入れ**（Hermes Agent の "agent-curated memory with periodic nudges"。2026-08-26）。
 *
 * 学びは1人30行、社長のことは20行が上限で、**あふれたら古いものから落ちて**いた。
 * 落ちるのは「古いもの」であって「もう要らないもの」ではない —
 * 一度きりの気づきが残り、毎回効く大事な1行が押し出される、が起きる。
 *
 * だから満杯に近づいたら**畳んで濃くする**。似た行をまとめ、
 * 一度きりのものを落とし、毎回効くものを残す。**捨てるのではなく、まとめる。**
 *
 * **いつも呼ばない。** 溜まったときだけ（`FOLD_AT`）。
 * ふだんの実行に1往復ぶんの上乗せをしない。
 */

/** 学び: 30行が上限。24行を超えたら畳んで12行にする */
const LEARN_FOLD_AT = 24, LEARN_KEEP = 12;
/** 社長のこと: 20行が上限。16行を超えたら畳んで10行にする */
const FOUNDER_FOLD_AT = 16, FOUNDER_KEEP = 10;

const TOOL: ToolDef = {
  name: 'fold_memory',
  description:
    '溜まったメモを畳んで濃くする。**捨てるのではなく、まとめる。**'
    + '① 同じことを言っている行は1行にする '
    + '② その一度きりのことしか言っていない行は落とす '
    + '③ 毎回効くこと・数字・社長が決めたことは**必ず残す**。'
    + '書き換えるときも、**元の言い方をできるだけ残す**（言い直すと意味がずれます）。',
  input_schema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        description: '畳んだあとの行。1行ずつ。渡された行数より必ず少なくする',
        items: { type: 'string' },
      },
    },
    required: ['lines'],
  },
};

async function fold(what: string, lines: string[], keep: number): Promise<string[]> {
  const { p } = pickProvider();
  const { model } = await execPref();
  const out: string[] = [];
  try {
    for await (const c of p.stream({
      // **深く考えない。** まとめるだけの仕事で、社長を待たせる理由が無い
      tier: 'fast', model, effort: 'low', maxTokens: 2000,
      system: 'あなたは一人社長の会社の統括AI。溜まったメモを畳みます。'
        + 'fold_memory を1回だけ呼んでください。文章では答えないでください。',
      messages: [{
        role: 'user',
        content: [`${what}（${lines.length}行）。**${keep}行以内**に畳んでください:`, '',
                  ...lines.map((l) => `- ${l}`)].join('\n'),
      }],
      tools: [TOOL],
      toolChoice: 'required',
    })) {
      if (c.type !== 'tool_use' || c.name !== 'fold_memory') continue;
      const rows = ((c.input ?? {}) as { lines?: unknown[] }).lines ?? [];
      for (const r of rows) {
        const t = String(r ?? '').trim();
        if (t) out.push(t.slice(0, 80));
      }
    }
  } catch {
    return [];                                  // 倒れたら畳まない（元のまま残る）
  }
  /**
   * **元より悪くしない**（計画の引き直しと同じ守り）。
   * 増えていたり空だったりしたら、畳まなかったことにする。
   */
  if (!out.length || out.length >= lines.length) return [];
  return out.slice(0, keep);
}

/**
 * 溜まっていたら畳む。実行の終わりに1回呼ぶ（社員の学びと、社長のこと）。
 * **倒れても実行は倒さない** — 記憶の手入れは成果物ではない。
 */
export async function tendMemory(employeeId?: string): Promise<void> {
  const s = store();
  if (employeeId) {
    const lines = await s.learnings(employeeId).catch(() => []);
    if (lines.length >= LEARN_FOLD_AT) {
      const next = await fold('この社員が仕事から書き溜めた学び', lines, LEARN_KEEP);
      if (next.length) await s.setLearnings(employeeId, next).catch(() => {});
    }
  }
  const notes = await s.founderNotes().catch(() => []);
  if (notes.length >= FOUNDER_FOLD_AT) {
    const next = await fold('会社が社長から覚えたこと', notes, FOUNDER_KEEP);
    if (next.length) await s.setFounderNotes(next).catch(() => {});
  }
}

/** 依頼文の1節に畳む。**無ければ節ごと出さない** */
export function founderBlock(notes: string[]): string[] {
  if (!notes.length) return [];
  return [
    '',
    '社長のこと（会社が覚えていること。**同じことを二度聞かない**）:',
    ...notes.map((n) => `- ${n}`),
  ];
}
