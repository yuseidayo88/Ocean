import type { ToolDef } from '@/lib/ai/provider';
import { store, type LiveWork } from '@/lib/store';
import { staffPref } from './pref';
import { pickProvider } from './provider';

/**
 * **品質担当が、社長に出す前に1度読む**（2026-08-26。社長の「あとは何が不足してる？」で見つけた）。
 *
 * 名簿には最初から品質担当がいるのに、**呼び出しがコードのどこにも無かった** —
 * 定義とコメントだけがあって、一度も働いていない社員だった。
 * 成果物ができると統括AIが40字の一言を添えるだけで、そこには
 * 「**判定ではない**」と自分で書いてある。つまり**品質の門は社長ひとり**だった。
 *
 * ## 決めごと
 *
 * - **在籍しているときだけ効く。** 採っていない会社の振る舞いは変わらない
 *   （勝手に採用しない — 採用は社長の4つの仕事のひとつ）
 * - **1回だけ。** 直しの成果物（`◯◯ を直す`）は素通し。
 *   でないと品質担当と社員が延々と往復して、社長の見えないところで料金だけ増える
 * - **差し戻すのは、社長と同じ道**（`setDelStatus` → `addFixTask`）。
 *   2つ目の仕掛けを作らない
 * - **通すときは、いままでどおり一言を添える**（「どこを見ればいいか」）。
 *   品質担当がいる会社では、その一言が**確かめた結果**になる
 */

const TOOL: ToolDef = {
  name: 'judge_deliverable',
  description:
    '成果物を、タスクのねらいと社長が決めたことに突き合わせて読む。'
    + '**「良いと思います」で終えない** — 確かめた項目を挙げ、直す点は場所と直し方まで書く。'
    + '**自分では直さない**（差し戻すだけ）。'
    + '\n\n**通す基準** — ① タスクのねらいに答えているか ② 根拠のない数字を事実として'
    + '書いていないか ③ 社長が決めたことに反していないか ④ 社長がこれを読んで判断できるか。'
    + '\n**細かい好みで差し戻さない。** 直せば良くなる、ではなく、'
    + '**このままでは社長が判断できない**ときだけ差し戻します。',
  input_schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: '社長に出してよければ true' },
      note: {
        type: 'string',
        description: '通すときは「社長がどこを見ればいいか」を40文字以内で1文。'
          + '差し戻すときは**何が足りないか**を1文で',
      },
      fixes: {
        type: 'array',
        items: { type: 'string' },
        description: '差し戻すときだけ。直す点を**場所と直し方まで**。1〜3件',
      },
    },
    required: ['ok', 'note'],
  },
};

export type Verdict = { ok: boolean; note: string; fixes: string[] };

/**
 * 品質担当が在籍していれば読む。**いなければ null**（呼び出し側は今までどおり）。
 */
export async function reviewDeliverable(
  work: LiveWork,
  task: { title: string; intent?: string },
  del: { title: string; body: string },
): Promise<Verdict | null> {
  const qa = work.crew.find((c) => c.name === '品質担当');
  if (!qa) return null;
  const pref = await staffPref(qa.id);

  const s = store();
  // **止めている社員は働かない**（一時停止は本物 → `agent_prefs.paused`）。
  // 実行のほうは `nextQueued` が飛ばすが、これはタスクではないので自分で見る
  const off = (await s.listPrefs().catch(() => []))
    .some((x) => x.employeeId === qa.id && x.paused);
  if (off) return null;

  const decided = (await s.listDecisions(work.id).catch(() => []))
    .filter((d) => d.status === 'decided' && d.chosen);

  const { p } = pickProvider();
  let out: Verdict | null = null;
  try {
    for await (const c of p.stream({
      // **深く考えない。** 社長を待たせる理由が無い（判定は fast の1往復）
      tier: 'fast', model: pref.model, effort: 'low', maxTokens: 1200,
      system: [
        'あなたは一人社長の会社の品質担当（QA Reviewer）です。',
        '成果物を受け入れ条件と突き合わせ、直す点を具体的に返します。',
        '「良いと思います」で終えない。確認した項目を列挙する。',
        '直す点は場所と直し方まで書く。**自分では直さない。差し戻す。**',
        'judge_deliverable を1回だけ呼んでください。文章では答えないでください。',
      ].join('\n'),
      messages: [{
        role: 'user',
        content: [
          `この Work のゴール: ${work.goal}`,
          `タスク: ${task.title}`,
          `やること: ${task.intent || task.title}`,
          ...(decided.length
            ? ['', '社長が決めたこと（**これに反していたら差し戻す**）:',
               ...decided.map((d) => `- ${d.question} → ${d.chosen}`)]
            : []),
          '', `成果物「${del.title}」:`, del.body.slice(0, 6000),
        ].join('\n'),
      }],
      tools: [TOOL], toolChoice: 'required',
    })) {
      if (c.type !== 'tool_use' || c.name !== 'judge_deliverable') continue;
      const a = (c.input ?? {}) as Record<string, unknown>;
      out = {
        ok: !!a.ok,
        note: String(a.note ?? '').trim().slice(0, 60),
        fixes: Array.isArray(a.fixes) ? a.fixes.map(String).slice(0, 3) : [],
      };
    }
  } catch {
    // 倒れたら**通す**。品質担当が答えられなかったことを理由に、
    // できている成果物を社長から隠さない
    return null;
  }
  // 差し戻すのに直す点が1つも書かれていなければ、通す（「なんとなく駄目」で止めない）
  if (out && !out.ok && !out.fixes.length) return { ...out, ok: true };
  return out;
}
