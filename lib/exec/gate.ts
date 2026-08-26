import type { ToolDef } from '@/lib/ai/provider';
import { store, type LiveWork } from '@/lib/store';
import { execPref } from './pref';
import { pickProvider } from './provider';

/**
 * **計画の ◆ を、本物の問いにする**（2026-08-26）。
 *
 * 社長の「簡単な例を作って0から最後までやり遂げられるのかが気になる」で、
 * ロゴを1本通して見つけた —— 計画の画面は
 * 「**あなたが決めるのは ◆ の1か所**」と言い、軸の上に `どの案で進めるか` と書く。
 * ところが `planGates` は **`afterPhase` だけを返して質問を捨てていた**ので、
 * ◆ は「そこで止まる」という印にしかなっておらず、社長は最後まで一度も聞かれず、
 * **決定事項は空のまま Work が完了した**。
 *
 * ## 決めごと
 *
 * - **問いは計画が持っている。** 統括AIが作り直さない（社長が承認したのはその問い）
 * - **選択肢は、そのフェーズの成果物から作る。**「どの案で進めるか」は、
 *   案が出てからでないと選択肢にならない。だから**閉じたその場で1往復**だけ払う
 * - **1つの Work に、開いている判断は1つだけ**（`addGateDecision` が二度立てない）
 * - **鍵が無い環境でも止めない。** 偽の選択肢は作らず、
 *   「このまま進める / 統括AIと相談してから決める」の2つで立てる
 *   （◆ を黙って無かったことにしない）
 */

const TOOL: ToolDef = {
  name: 'gate_options',
  description:
    '社長がこの場で決められるように、選択肢を並べる。'
    + '**このフェーズで出た成果物から作る** — 成果物に書かれていない案を足さない。'
    + '\n**説明は「選ぶと何が変わるか」**を1行で。「良い案です」のような中身の無い文を書かない。'
    + '\n推している案を1つだけ `recommended` にし、`why` に**なぜそれか**を1文で書く。',
  input_schema: {
    type: 'object',
    properties: {
      why: { type: 'string', description: 'なぜこれを決める必要があるかを1文（40〜80文字）' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '選択肢の名前。4〜16文字' },
            description: { type: 'string', description: '選ぶと何が変わるかを1行' },
            recommended: { type: 'boolean' },
          },
          required: ['label', 'description'],
        },
        description: '2〜4件',
      },
    },
    required: ['why', 'options'],
  },
};

/** 鍵が無いとき。**偽の選択肢を作らず、◆ も無かったことにしない** */
const PLAIN = {
  why: 'この先の進め方が変わるところです。成果物を見てから決めてください。',
  options: [
    { label: 'このまま進める', description: '出てきた成果物のまま、次のフェーズへ進みます', recommended: true },
    { label: '統括AIと相談してから決める', description: 'チャットで相談してから、あらためて決めます' },
  ],
};

/**
 * ◆ のフェーズが閉じたら、その問いを社長に出す。
 * **立てられたら true**（もう開いているものがあれば false）。
 */
export async function askGate(
  work: LiveWork, phaseName: string, question: string,
): Promise<boolean> {
  const s = store();
  const phase = work.phases.find((p) => p.name === phaseName);
  // そのフェーズの成果物だけを渡す（選択肢はここから作る）
  const mine = phase
    ? (work.dels ?? []).filter((d) => {
        const t = work.tasks.find((x) => x.id === d.taskId);
        return !!t && t.phaseId === phase.id;
      })
    : [];

  /**
   * **決め打ちのプロバイダにも同じ道を通す。**
   * 鍵が無いときだけ別の道にすると、`gate_options` の配線が
   * **一度も検査を通らない**（決め打ちは自分で「（仮）」と名乗る）。
   * 引けなかったときだけ、下の `PLAIN` に落ちる。
   */
  const { p } = pickProvider();
  let got: { why: string; options: { label: string; description?: string; recommended?: boolean }[] } | null = null;
  {
    const pref = await execPref();
    try {
      for await (const c of p.stream({
        // **社長を待たせない。** 深さは使わず、選択肢を並べるだけの1往復
        tier: 'fast', model: pref.model, effort: 'low', maxTokens: 1200,
        system: [
          'あなたは一人社長の統括AIです。',
          '社長が承認した計画に「ここで社長に決めてもらう」と書いた場所に来ました。',
          '**問いは変えないでください。** 選択肢だけを、出てきた成果物から作ります。',
          'gate_options を1回だけ呼んでください。文章では答えないでください。',
        ].join('\n'),
        messages: [{
          role: 'user',
          content: [
            `Work のゴール: ${work.goal}`,
            `終わったフェーズ: ${phaseName}`,
            `社長に決めてもらうこと: ${question}`,
            ...(mine.length
              ? ['', 'このフェーズで出た成果物:',
                 ...mine.map((d) => `--- ${d.title} ---\n${(d.body ?? d.preview ?? '').slice(0, 3000)}`)]
              : ['', '（このフェーズの成果物は読めませんでした。分かる範囲で選択肢を作ってください）']),
          ].join('\n'),
        }],
        tools: [TOOL], toolChoice: 'required',
      })) {
        if (c.type !== 'tool_use' || c.name !== 'gate_options') continue;
        const a = (c.input ?? {}) as Record<string, unknown>;
        const opts = Array.isArray(a.options) ? a.options as typeof PLAIN.options : [];
        if (opts.length >= 2) got = { why: String(a.why ?? ''), options: opts.slice(0, 4) };
      }
    } catch { got = null; }         // 引けなかった。**◆ は立てる**（下の決め打ちで）
  }

  const use = got ?? PLAIN;
  return s.addGateDecision(work.id, {
    question, why: use.why || PLAIN.why, options: use.options,
  }).catch(() => false);
}
