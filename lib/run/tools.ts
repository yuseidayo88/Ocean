import type { ToolDef } from '@/lib/ai';

/**
 * AI社員に渡す道具（Phase 7）。
 *
 * **文章で返させない。** 統括AI（Phase 5）と同じ作法 — 画面に出すもの・DBに残るものは
 * 全部 `tool_use` で受け取る。自由文だと、パースに失敗したとき「なんとなく動いていない」になる。
 *
 * 道具は5つだけ。**少ないほど、弱いモデルでも間違えない**（テストは無料の Ox Alpha で走る）。
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
/**
 * 成果物を書く。**出す形は社長の手もとで使える形にする**（2026-08-25。社長の指示
 * 「文章だけでなく、LPやPDFや様々な出力できるようにしたい、CSVとかもそうだし」）。
 *
 * `kind` が形を決める（→ `lib/deliver/format.ts`）。書き方を間違えると
 * 画面が読めない — たとえば `csv` なのに markdown の表を書くと、1列の表になる。
 * だから**種類ごとに、本文の書き方まで説明に入れてある**。
 */
export const writeDeliverable: ToolDef = {
  name: 'write_deliverable',
  description:
    'タスクの成果物を書く。1タスクにつき1回、finish の前に必ず呼ぶ。'
    + '**社長がそのまま使える形で出す** — 表計算に入れる数字は csv、'
    + '公開するページは page（HTML）、読ませて判断してもらうものは report。'
    + '**根拠の無い数字を書かない** — 確かでないものは「要確認」と明記する。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字の名詞。「競合比較表」のように' },
      kind: {
        type: 'string',
        enum: ['report', 'doc', 'copy', 'table', 'csv', 'page', 'code'],
        description:
          'report=調べたこと・提案（markdown） / doc=手順書・仕様（markdown） / '
          + 'copy=広告や説明の文案（markdown） / table=説明のある比較表（markdown の表） / '
          + 'csv=そのまま表計算に入れる数字だけの表 / page=公開できる1枚のHTML（LP・お知らせ） / '
          + 'code=プログラム。**迷ったら report**',
      },
      body: {
        type: 'string',
        description:
          '本文。**種類で書き方が変わる** — '
          + 'markdown のもの（report / doc / copy / table）は見出し `##`・箇条書き `-`・'
          + '表 `| a | b |` を使って 1000〜4000文字。 '
          + 'csv は**1行目が見出し、2行目から数字**。説明文も markdown も混ぜない'
          + '（カンマを含む値は "…" で囲む）。 '
          + 'page は `<!doctype html>` から始まる**1枚で完結した HTML**。'
          + 'CSS は `<style>` に書き、外部のファイル・画像・スクリプトは読み込まない'
          + '（そのまま公開できることが条件。画像は色と文字で代わりを置く）。',
      },
    },
    required: ['title', 'kind', 'body'],
  },
};

/**
 * ワークフローの図。**成果物のもう1つの形**（1タスクに1つ、`write_deliverable` の代わり）。
 *
 * 形は archify の IR（→ `lib/diagram/types.ts`）。**座標は書かない** —
 * 列（`col`）とレーン（`lane`）だけ決めれば、格子が位置を決める。
 * 出したものは OneFound の中で9つの検査に掛かる（→ `lib/diagram/check.ts`）。
 * **通らなかったら、何が悪いかを返してもう一度だけ頼む。**
 */
export const drawWorkflow: ToolDef = {
  name: 'draw_workflow',
  description:
    '手順・承認の流れ・工程を**図**にする。文章より図のほうが早いときだけ使う。'
    + '1タスクにつき1回で、write_deliverable の代わりになる（両方は呼ばない）。'
    + '**主線を1本に決める**（mainPath）。枝はいちばん近い主線のノードから出す。'
    + 'ノードは12個まで。座標は書かない — lane と col だけ決める。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字の名詞。「申し込みの流れ」のように' },
      subtitle: { type: 'string', description: '1行の補足。無くてよい' },
      lanes: {
        type: 'array',
        description: '横の帯。誰が／どこでやるかで分ける。1〜4本',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '英数字の短い id' },
            label: { type: 'string', description: 'レーンの名前。短く' },
            variant: { type: 'string', enum: ['normal', 'exception'], description: '例外の道は exception' },
          },
          required: ['id', 'label'],
        },
      },
      phases: {
        type: 'array',
        description: '列の範囲に名前を付ける帯。無くてよい',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            fromCol: { type: 'number' },
            toCol: { type: 'number' },
          },
          required: ['id', 'label', 'fromCol', 'toCol'],
        },
      },
      nodes: {
        type: 'array',
        description: '**12個まで。** 同じレーンの同じ列に2つ置かない',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '英数字の短い id' },
            lane: { type: 'string', description: 'lanes の id' },
            col: { type: 'number', description: '何列目か（0 から）' },
            type: {
              type: 'string', enum: ['work', 'decision', 'deliverable', 'wait', 'end'],
              description: 'decision は**社長が決めるところ**（橙になる）',
            },
            label: { type: 'string', description: '何をするか。短く' },
            sublabel: { type: 'string', description: '1行の補足。無くてよい' },
          },
          required: ['id', 'lane', 'col', 'type', 'label'],
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            label: { type: 'string', description: '線の上の短い言葉。「承認」「差し戻し」など' },
            role: {
              type: 'string', enum: ['main', 'branch', 'async', 'return', 'error'],
              description: '主線は main。枝は branch。戻りは return',
            },
          },
          required: ['from', 'to'],
        },
      },
      mainPath: {
        type: 'array',
        description: '**いちばん通ってほしい道**。2つ以上のノード id を順に。線で繋がっていること',
        items: { type: 'string' },
      },
    },
    required: ['title', 'lanes', 'nodes', 'edges', 'mainPath'],
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

/**
 * 学び。**使うたびに賢くなる**ための口 — ただしルールには自動で書かない
 * （ルールは毎回効く制約。勝手に増えると社長が知らないうちに社員が変わる）。
 * ここに書いたものは社員のメモ（learnings.md）に溜まり、次の実行の依頼文に載る。
 * 社長には設定ペインで見え、消せる。
 */
export const noteLearning: ToolDef = {
  name: 'note_learning',
  description:
    'このタスクで学んだ、**次も効くこと**があれば1行で書き残す（任意。無ければ呼ばない）。'
    + '「この会社の価格表記は税込みで統一」のような、次の仕事で同じ判断を繰り返さないための粒。'
    + '作業の記録ではない — それは log_step に書く。',
  input_schema: {
    type: 'object',
    properties: {
      lesson: { type: 'string', description: '10〜40文字の1行。次の自分への申し送り' },
    },
    required: ['lesson'],
  },
};

export const RUN_TOOLS: ToolDef[] = [logStep, writeDeliverable, drawWorkflow, askDecision, noteLearning, finish];
