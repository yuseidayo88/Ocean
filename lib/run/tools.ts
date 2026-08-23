import type { ToolDef } from '@/lib/ai';

/**
 * AI社員に渡す道具（Phase 7）。
 *
 * **文章で返させない。** 統括AI（Phase 5）と同じ作法 — 画面に出すもの・DBに残るものは
 * 全部 `tool_use` で受け取る。自由文だと、パースに失敗したとき「なんとなく動いていない」になる。
 *
 * 道具は4つだけ。**少ないほど、弱いモデルでも間違えない**（テストは無料の Ox Alpha で走る）。
 */

/** いま何をしているか。デスクの工程の行と、タスクの進捗の出どころ */
export const logStep: ToolDef = {
  name: 'log_step',
  description:
    '作業の区切りごとに、いま何をしているかを1行で記録する。3〜6回呼ぶ。'
    + '社長がデスク画面で見る行なので、日本語で短く具体的に。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '10〜25文字。「競合5社の価格を表にした」のように、済んだ形で' },
      progress: { type: 'number', description: 'このタスク全体の進み具合（0-100）。正直に。盛らない' },
    },
    required: ['title', 'progress'],
  },
};

/** 成果物。タスクの結論はここに書く */
export const writeDeliverable: ToolDef = {
  name: 'write_deliverable',
  description:
    'タスクの成果物を書く。1タスクにつき1回、finish の前に必ず呼ぶ。'
    + '本文は markdown。見出し・表・箇条書きを使い、社長がそのまま判断に使える形にする。'
    + '**根拠の無い数字を書かない** — 確かでないものは「要確認」と明記する。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字の名詞。「競合比較表」のように' },
      kind: { type: 'string', enum: ['report', 'table', 'doc', 'copy', 'code'], description: '種類' },
      body: { type: 'string', description: 'markdown の本文。1000〜4000文字' },
    },
    required: ['title', 'kind', 'body'],
  },
};

/** 社長の判断が要るとき。勝手に決めずに止まる */
export const askDecision: ToolDef = {
  name: 'ask_decision',
  description:
    '事業の判断（価格・対象・方針など、あとから変えにくいこと）に当たったら、勝手に決めずにこれで止まる。'
    + '作業のやり方の迷いでは使わない — それは自分で決めて log_step に書く。',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '4〜20文字。「価格モデルの決定」のように名詞で' },
      why: { type: 'string', description: 'なぜ今この判断が要るか。1文' },
      options: {
        type: 'array',
        description: '2〜4択。推奨をいちばん上に',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '見出し。「B案 ¥1,980」のように' },
            description: { type: 'string', description: '1行の説明。選ぶとどうなるか' },
            recommended: { type: 'boolean' },
          },
          required: ['label', 'description'],
        },
      },
    },
    required: ['question', 'why', 'options'],
  },
};

/** 終わり。1回だけ、最後に呼ぶ */
export const finish: ToolDef = {
  name: 'finish',
  description: 'タスクを終える。write_deliverable のあとに1回だけ呼ぶ。',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '何をして何ができたか。1文。ログの最終行になる' },
    },
    required: ['summary'],
  },
};

export const RUN_TOOLS: ToolDef[] = [logStep, writeDeliverable, askDecision, finish];
