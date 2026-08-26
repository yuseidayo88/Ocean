import type { ToolDef } from '@/lib/ai/provider';
import { store } from '@/lib/store';
import { execPref } from './pref';
import { pickProvider } from './provider';

/**
 * **社員が書いた手順書を、統括AIが通す**（2026-08-26。社長が選んだ形）。
 *
 * 元は NousResearch/hermes-agent（MIT）の閉じた学習の輪 —
 * 「難しい仕事のあと自分でスキルを作る」「使いながら自分で良くなる」。
 * あちらは**社員が自分で自分を書き換える**が、OneFound には先に決めたことがある —
 * 「勝手に増えると、社長が知らないうちに社員が変わる」。
 *
 * だから間に1枚だけ挟む。**社長の手は増やさない**（社長がやることは4つのまま）。
 * 統括AIが読んで、残す価値があるものだけ通す。落とした理由は残る — 社長が読んで戻せる。
 *
 * **1往復で、待っているものを全部見る。** 1枚ずつ見ると、
 * 社員が3枚書いた日に3回払うことになる。
 */

const TOOL: ToolDef = {
  name: 'review_skills',
  description:
    '待っている手順書を全部見て、会社に残すかどうかを1件ずつ決める。'
    + '**残す基準は3つだけ** — ① 次に同じ形の仕事が来たとき本当に読めるか '
    + '② この1回の結果ではなく「やり方」が書いてあるか '
    + '③ もうある手順書と同じことを言っていないか。'
    + '**迷ったら落とす** — 読まれない手順書が増えるほど、要るものが埋もれます。',
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '渡された id をそのまま写す' },
            keep: { type: 'boolean', description: '残すなら true' },
            note: {
              type: 'string',
              description: '**落とすときは理由を必ず書く**（社長がこれを読んで、戻すかを決める）。'
                + '残すときは空でよい。40文字まで',
            },
          },
          required: ['id', 'keep'],
        },
      },
    },
    required: ['verdicts'],
  },
};

/**
 * 待っているものを見て、通す / 落とす。返り値は判定した件数。
 *
 * **鍵が無い環境でも通す** — ここを黙って飛ばすと、下書きが永久に溜まって
 * 学習の輪が一度も回らない。ただし**仮の審査だと名乗る**（判定の理由に残す）。
 */
export async function reviewSkills(): Promise<number> {
  const s = store();
  const waiting = await s.pendingSkills().catch(() => []);
  if (!waiting.length) return 0;

  const { p, real } = pickProvider();
  const { model } = await execPref();

  const lines = waiting.map((w) => [
    `--- id: ${w.id} ---`,
    `名前: ${w.name}`,
    ...(w.desc ? [`いつ読むか: ${w.desc}`] : []),
    ...(w.authorName ? [`書いた人: ${w.authorName}`] : []),
    w.kind === 'new' ? '種類: 新しい手順書' : `種類: いまある手順書への直し（${w.why || '理由は書かれていません'}）`,
    ...(w.live ? ['いまの中身:', w.live.slice(0, 1500)] : []),
    w.kind === 'new' ? '中身:' : '直した中身:',
    w.body.slice(0, 2500),
  ].join('\n'));

  const verdicts = new Map<string, { keep: boolean; note: string }>();
  try {
    for await (const c of p.stream({
      // **深く考えない。** 残すかどうかの判断で、社長を待たせる理由が無い
      tier: 'fast', model, effort: 'low', maxTokens: 2000,
      system: 'あなたは一人社長の会社の統括AI。部下が書いた手順書を読んで、'
        + '会社に残すかどうかを決めます。review_skills を1回だけ呼んでください。文章では答えないでください。',
      messages: [{ role: 'user', content: ['待っている手順書:', '', ...lines].join('\n\n') }],
      tools: [TOOL],
      toolChoice: 'required',
    })) {
      if (c.type !== 'tool_use' || c.name !== 'review_skills') continue;
      const rows = ((c.input ?? {}) as { verdicts?: Record<string, unknown>[] }).verdicts ?? [];
      for (const r of rows) {
        const id = String(r.id ?? '');
        if (id) verdicts.set(id, { keep: !!r.keep, note: String(r.note ?? '').slice(0, 60) });
      }
    }
  } catch {
    // 倒れたら何も判定しない。**下書きのまま残す** — 通したことにしない
    return 0;
  }

  let done = 0;
  for (const w of waiting) {
    const v = verdicts.get(w.id);
    if (!v) continue;                          // 言われなかったものは、次の回にまた見る
    const note = [real ? '' : '（仮の審査）', v.note].filter(Boolean).join(' ');
    await s.reviewSkill(w.id, v.keep, note).catch(() => {});
    done += 1;
  }
  return done;
}
