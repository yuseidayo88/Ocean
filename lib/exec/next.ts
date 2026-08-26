import { hasKey, providerFor, type Msg } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { rosterBlock, slugOf } from '@/lib/roster';
import { store } from '@/lib/store';
import { execPref } from './pref';
import type { ToolDef } from '@/lib/ai';
import type { LiveWork } from '@/lib/store';

/**
 * 次のフェーズのタスクを引く（Phase 9）。
 *
 * 計画のとき先を固定しなかったぶん、ここで**前の結果を見てから**引く —
 *   前のフェーズの成果物 ＋ 社長の決めたこと → 次のフェーズのタスク2〜4件
 * これが「あとから引き直せる形」の中身（→ CLAUDE.md / docs/PLAN.md Phase 5 原文の要件）。
 */

const TOOL: ToolDef = {
  name: 'draft_phase_tasks',
  description:
    '次のフェーズのタスクを2〜4件引く。前のフェーズの成果物と社長の決定に沿うこと。'
    + '**成果物を読んで、社長にしか決められないことが分かったら、そのタスクに ask を付ける** — '
    + 'そのタスクだけが社長を待ち、ほかのタスクは動き出す。',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '4〜20文字' },
            intent: { type: 'string', description: '何をどこまでやるか。1〜2文' },
            owner_hint: { type: 'string', description: '名簿の「◯◯担当」。ここに無い名前を作らない' },
            /**
             * **前のフェーズの成果物を読んで、分からなかったところ**（2026-08-26。
             * 社長の「わからない部分は統括AIがユーザーに質問投げて」）。
             */
            ask: {
              type: 'object',
              description:
                '**そのタスクを始める前に、社長にしか決められないことがあるときだけ**書く。'
                + '前のフェーズの成果物を読んで、AI社員には決められないと分かったこと'
                + '（誰に売るか・いくらにするか・どこまで作るか）。'
                + '**無いなら書かない** — 付けたタスクはそこで待つので、'
                + '「一応聞いておく」で増やすと会社が遅くなる。',
              properties: {
                question: { type: 'string', description: '何を決めてもらうか。短く' },
                why: { type: 'string', description: 'なぜ社長でないと決められないか。1文' },
                options: {
                  type: 'array',
                  description: '選べる道を2〜4つ。**押すだけで答えられる形に**',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', description: '見出し。短く' },
                      description: { type: 'string', description: 'それを選ぶとどうなるか。1行' },
                      recommended: { type: 'boolean', description: 'おすすめなら true。1つだけ' },
                    },
                    required: ['label', 'description'],
                  },
                },
              },
              required: ['question', 'why', 'options'],
            },
          },
          /**
           * **担当は必ず書かせる**（2026-08-25）。任意にしていたので、
           * 書かれなかったタスクは**先頭の社員**に落ちていた — 通しで走らせると
           * 「ローンチの段取り」を調査担当が書いていて、画面にはそう出るのに
           * 誰も選んでいない。名簿は依頼文に載せてあるので、選べないはずがない。
           */
          required: ['title', 'intent', 'owner_hint'],
        },
      },
    },
    required: ['tasks'],
  },
};

export type NextTask = {
  title: string; intent: string; ownerHint?: string;
  /** 始める前に社長に決めてもらうこと。あればそのタスクだけ待つ（ほかは動き出す） */
  ask?: { question: string; why: string; options: unknown[] };
};

export async function draftNextTasks(
  work: LiveWork, nextPhase: { name: string; goal: string },
  decided: { question: string; chosen?: string }[],
): Promise<NextTask[]> {
  const p = hasKey('deep') ? providerFor('deep') : new FakeProvider();
  const pref = await execPref();   // 統括AIの設定（メンバー画面）
  const dels = (work.dels ?? []).slice(0, 4);

  // **名簿を渡す。** 渡さないと、この会社に居ない担当名が書かれる（run.ts と同じ穴）
  const roster = rosterBlock((await store().listEmployees().catch(() => []))
    .map((e) => ({ slug: slugOf(e.definitionId), name: e.name })));

  const messages: Msg[] = [{
    role: 'user',
    content: [
      roster,
      '',
      `会社のゴール: ${work.goal}`,
      `次のフェーズ: ${nextPhase.name} — ${nextPhase.goal}`,
      ...(decided.length ? ['', '社長の決定:', ...decided.map((d) => `- ${d.question} → ${d.chosen}`)] : []),
      ...(dels.length ? ['', 'ここまでの成果物:', ...dels.map((d) => `- ${d.title}: ${(d.preview ?? '').slice(0, 120)}`)] : []),
      '',
      'draft_phase_tasks を1回呼んで、このフェーズのタスクを引いてください。',
      '**ここまでの成果物を読んで、AI社員には決められないことが見つかったら、'
      + 'そのタスクに ask を付けてください**（誰に売るか・いくらにするか・どこまで作るか）。'
      + '無いなら付けない — 付けたタスクはそこで待ちます。',
      '**担当は名簿の「◯◯担当」から必ず選んでください**（居ない人は作らない。'
      + 'まだ在籍していない担当を選んでよい — そのときは採用されます）。',
      '文章では答えないでください。',
    ].join('\n'),
  }];

  let tasks: NextTask[] = [];
  for await (const c of p.stream({
    tier: 'deep', model: pref.model, effort: pref.effort, maxTokens: 4000,
    system: 'あなたは一人社長の統括AI。前のフェーズの結果と社長の決定を踏まえ、次のフェーズのタスクを引く。',
    messages, tools: [TOOL],
  })) {
    if (c.type === 'tool_use' && c.name === 'draft_phase_tasks') {
      const rows = ((c.input ?? {}) as { tasks?: Record<string, unknown>[] }).tasks ?? [];
      tasks = rows.map((t) => {
        const a = t.ask as unknown as { question?: string; why?: string; options?: unknown[] } | undefined;
        return {
          title: String(t.title ?? ''), intent: String(t.intent ?? ''),
          ownerHint: t.owner_hint ? String(t.owner_hint) : undefined,
          // **選択肢の無い質問は板で落ちる**（`ask` と同じ守り。→ `lib/exec/parse.ts`）
          ask: a?.question && Array.isArray(a.options) && a.options.length
            ? { question: String(a.question), why: String(a.why ?? ''), options: a.options }
            : undefined,
        };
      }).filter((t) => t.title);
    }
  }
  return tasks.slice(0, 4);
}
