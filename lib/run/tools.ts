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
 * **URL を1本読む**（2026-08-27。社長の「他のやつから順に」の①）。
 *
 * ここまで AI社員が読めるのは、依頼文に載っているものだけだった。
 * 検索（Web プラグイン）はあるのに「**このページを読んで**」ができず、
 * 社長が渡した URL は取り込みの一覧に**待機のまま**並んでいた。
 *
 * **これは「読む」道具。** 1タスク＝1往復が崩れる唯一の型で、
 * MCP とまったく同じ仕掛けに乗せる（読んだ結果を渡して、もう一度書いてもらう）。
 * **つないでいない会社では往復しない**のと同じで、渡らない社員は1往復のまま。
 */
export const readUrl: ToolDef = {
  name: 'read_url',
  description:
    'Web のページを1つ読む。**渡された URL か、依頼文に出てくる URL だけ**。'
    + '読めるのは https の HTML かテキスト（PDF・画像は読めない）。'
    + '**当てずっぽうの URL を作らない** — 知らない住所は開かず、必要なら ask_decision で聞く。'
    + '読んだら、その中身を根拠として成果物に使う（出どころの URL も書く）。',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'https で始まる完全な URL' },
      why: { type: 'string', description: '何を確かめたくて読むか（1行）。歩みに出る' },
    },
    required: ['url', 'why'],
  },
};

/**
 * 絵を1枚出す。**成果物のもう1つの形**（1タスクに1つ、`write_deliverable` の代わり）。
 *
 * 2026-08-27。社長の「ロゴ作る時は GPT の AI 使うようにしようかな あと Nano Banana とか」。
 *
 * ここまで名簿は**全員が文章を書く人**だったので、「ロゴを作りたい」と言われても
 * 出てくるのはロゴの**説明**だった。この道具が、その穴そのものを埋める。
 *
 * **渡すのはデザイン担当のときだけ**、しかも**会社が絵を入れているときだけ**
 * （従量で課金される → `lib/ai/image.ts` の `imagesOn`）。
 * 持っていない社員に見せると「使えない道具の説明」を読ませるだけになる。
 */
export const makeImage: ToolDef = {
  name: 'make_image',
  description:
    'ロゴ・バナー・図案など、**見せるものを実際の画像1枚にする**。'
    + '1タスクにつき1回で、write_deliverable の代わりになる（両方は呼ばない）。'
    + '**説明で終わらせない** — 頼まれたものが「絵」なら、必ずこれで出す。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字の名詞。「ロゴ 案A」のように' },
      prompt: {
        type: 'string',
        description:
          '**英語で書く**（画像のモデルは英語のほうが正確に効く）。100〜400語。'
          + '何を・どんな形で・どんな色で・どんな雰囲気か、そして**背景**（白か透明か）まで書く。'
          + '文字を入れるなら綴りをそのまま引用符で書く。'
          + '**「ロゴを作って」だけにしない** — それでは何が出てくるか誰にも言えない。',
      },
      note: {
        type: 'string',
        description:
          '社長への一言（日本語・1〜3行）。**何を狙った絵か**と、'
          + '文字を入れたならその綴りと読み。画像の中の字は読み違えられるので、ここにも書く。',
      },
    },
    required: ['title', 'prompt', 'note'],
  },
};

/**
 * **台本を読み上げる**（2026-08-27。社長の「他のやつから順に」の④）。
 *
 * **渡すのは執筆担当のときだけ**、しかも**会社が声を入れているときだけ**
 * （従量で課金される → `lib/ai/voice.ts` の `voiceOn`）。
 * 読み上げるのは**言葉を書く人の仕事の続き**なので、担当を増やさない。
 */
export const makeVoice: ToolDef = {
  name: 'make_voice',
  description:
    'ナレーション・案内・読み上げなど、**聞かせるものを実際の音声1本にする**。'
    + '1タスクにつき1回で、write_deliverable の代わりになる（両方は呼ばない）。'
    + '**台本を書いて終わりにしない** — 頼まれたものが「音声」なら、必ずこれで出す。',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字の名詞。「紹介ナレーション」のように' },
      script: {
        type: 'string',
        description:
          '**読み上げる言葉そのもの**（日本語）。ト書き・見出し・箇条書きの印は入れない — '
          + 'そのまま声になるので、記号は読み上げられてしまう。'
          + '**声に出して自然な長さで切る**（1文は40字くらいまで）。'
          + '数字と英字は読み方が割れるので、読ませたい読みで書く（「3つ」「エルピー」）。',
      },
      note: {
        type: 'string',
        description:
          '社長への一言（日本語・1〜3行）。**どこで使う音声か**と、狙った雰囲気。',
      },
    },
    required: ['title', 'script', 'note'],
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

/**
 * **難しい仕事のあと、手順書を書き残す**（Hermes Agent の学習の輪。2026-08-26）。
 *
 * 学び（`note_learning`）は1行の申し送りで、**次の実行に必ず載る**。
 * スキルはそれより重く、**必要なときだけ読まれる**手順書 — だから量を書ける。
 * 「またやることになる仕事の、やり方」がスキルで、「次の自分への一言」が学び。
 *
 * **書いても、すぐには誰も読まない。** 統括AIが通してからです
 * （社長が選んだ形 → `supabase/migrations/0029_agent_skills.sql`）。
 */
const writeSkill: ToolDef = {
  name: 'write_skill',
  description:
    '**同じ形の仕事がまた来ると分かったときだけ**、そのやり方を手順書として書き残す（任意）。'
    + '毎回のちょっとした気づきは note_learning のほうです。'
    + '**書いたものは統括AIが読んで、通ったら次から会社の誰かが読みます** — '
    + 'あなたにしか分からない書き方をしない。'
    + 'すでに似た手順書を渡されているなら、新しく書かずに improve_skill で直してください。',
  input_schema: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: '英数字とハイフンだけ。例 competitor-compare.md' },
      name: { type: 'string', description: '日本語で6〜20文字。何のやり方か' },
      when: { type: 'string', description: '**いつ読むか**を1行。ここが合っていないと誰も読めない' },
      body: {
        type: 'string',
        description: '手順書の中身（markdown）。手順・気をつけること・出す形。'
          + '**この1回の結果を書かない** — 次に同じ形の仕事をする人が読んで動ける文にする',
      },
    },
    required: ['filename', 'name', 'when', 'body'],
  },
};

/**
 * **使ってみて足りなかったところを直す**（Hermes の「使いながら良くなる」）。
 * いま効いている本文は変えない — 直しが通るまで、その手順書は今のまま使われる。
 */
const improveSkill: ToolDef = {
  name: 'improve_skill',
  description:
    '渡された手順書を読んで**足りなかった・間違っていたところがあったときだけ**、直した全文を出す（任意）。'
    + '直すところが無ければ呼ばない。**いま効いている手順書は、統括AIが通すまで今のまま**です。',
  input_schema: {
    type: 'object',
    properties: {
      skill: { type: 'string', description: '渡された手順書の id（そのまま写す）' },
      why: { type: 'string', description: 'どこが足りなかったか。1行' },
      body: { type: 'string', description: '直した**全文**（差分ではない）' },
    },
    required: ['skill', 'why', 'body'],
  },
};

/**
 * **前の成果物・社長の決定と食い違うと気づいたとき**（2026-08-26）。
 *
 * 憲法には「矛盾に気づいたら、黙って上書きせずに、どこがどう食い違うかを書き残す」と
 * 書いてあるのに、**書き残す先がどこにも無かった**。社員は決められない
 * （事業判断は社長の仕事）ので、気づいたことをそのまま上げる。
 */
const flagConflict: ToolDef = {
  name: 'flag_conflict',
  description:
    '渡された成果物や社長の決定と、**いま分かったことが食い違う**と気づいたときだけ呼ぶ（任意）。'
    + '**自分で決めない**（どちらが正しいかは社長が決める）。'
    + '食い違っていないなら呼ばない。1タスクで多くても2件。',
  input_schema: {
    type: 'object',
    properties: {
      what: {
        type: 'string',
        description: '**何と何が、どう食い違うか**を1文で。'
          + '（例「調査の表では月額3,000円だが、社長は月額1,980円で決めている」）',
      },
    },
    required: ['what'],
  },
};

export const RUN_TOOLS: ToolDef[] = [logStep, writeDeliverable, drawWorkflow, askDecision, noteLearning, writeSkill, improveSkill, flagConflict, finish];
