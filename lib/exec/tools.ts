import type { ToolDef } from '@/lib/ai';

/**
 * 統括AIに渡す道具（Phase 5 のぶん）。
 *
 * **文章で返させない。** 画面に出すものは全部この形で受け取る。
 * 自由文で返させると、パースに失敗したときに「なんとなく動いていない」になる。
 */

/** 入れ物の判定（→ docs/design/06-work-and-scope.md） */
export const decideContainer: ToolDef = {
  name: 'decide_container',
  description:
    '依頼をどの入れ物に入れるかを決める。3つ全部そろえば Work（終わりが言える / 単独で価値がある / 3ヶ月以内）。'
    + '単独で価値が出ないなら、進行中の Work のフェーズかタスクにする。'
    + '終わりが言えないなら ask_end を使う。',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['work', 'phase', 'task'], description: 'どの入れ物か' },
      title: { type: 'string', description: '4〜20文字。社長の言葉をそのまま使う' },
      goal: { type: 'string', description: '何ができたら終わりか。1文' },
      weeks: { type: 'number', description: '見込みの週数' },
      into_work_id: { type: 'string', description: 'phase / task のとき、入れる先の Work' },
      /** 3条件の内訳。**なぜそう決めたかを画面に出す**ので、丸めさせない */
      ends: { type: 'boolean', description: '終わりが言えるか' },
      alone: { type: 'boolean', description: '単独で価値があるか' },
      short: { type: 'boolean', description: '3ヶ月以内か' },
      reason: { type: 'string', description: '1文。社長に見せる' },
    },
    required: ['verdict', 'title', 'goal', 'weeks', 'ends', 'alone', 'short', 'reason'],
  },
};

/**
 * 終わりが言えないとき。入れ物に入れる前に聞く。
 *
 * **最後の手段。** 「伸ばしたい」「良くしたい」のように終点そのものが無い依頼だけ。
 * ゴール文に「終わり:」が書いてあるとき、候補や診断から来たときは**使わない** —
 * そこは決まっている。聞き返すと、社長には「選んだのにまた聞かれた」に見える。
 */
export const askEnd: ToolDef = {
  name: 'ask_end',
  description:
    '**終点そのものが言えない依頼のときだけ**（「売上を伸ばしたい」など）、何ができたら終わりかを先に聞く。'
    + 'ゴールに「終わり:」が書いてあるなら呼ばない。自分で決められるなら呼ばずに decide_container へ進む。',
  input_schema: {
    type: 'object',
    properties: {
      body: { type: 'string', description: '聞くこと。1文' },
      options: {
        type: 'array',
        description: '3つまで。選べる形にする',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            description: { type: 'string', description: '1行。これが無いと選べない' },
          },
          required: ['label', 'description'],
        },
      },
    },
    required: ['body', 'options'],
  },
};

/**
 * 確認の質問。**入力欄の上の板に出る**（会話には流さない）。
 * 1度に出すのは1〜4問（板は1問ずつ出る）。**回数の上限は無い** —
 * 決まらないと進めないことが残っているなら、また聞いてよい。理由のない質問は出さない。
 */
export const ask: ToolDef = {
  name: 'ask',
  description:
    '計画を立てる前に、これが決まらないと進めないことを聞く。1度に1〜4問。'
    + '**回数は決まっていない** — まだ分からないことが残っているなら、また聞いてよい。'
    + '選択肢には必ず1行の説明を付ける（「¥1,980」だけでは選べない）。'
    + '推奨があれば1つだけ recommended を立てる。最後は自由入力になるので用意しなくてよい。',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            body: { type: 'string', description: '聞くこと。1文' },
            why: { type: 'string', description: 'なぜ聞くか。1文。理由のない質問は出さない' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: '見出し。短く' },
                  description: { type: 'string', description: '1行の説明' },
                  recommended: { type: 'boolean' },
                },
                required: ['label', 'description'],
              },
            },
          },
          required: ['body', 'why', 'options'],
        },
      },
    },
    required: ['questions'],
  },
};

/** 社員の推薦。**採るかどうかは社長が決める** */
export const proposeHires: ToolDef = {
  name: 'propose_hires',
  description:
    'この Work に要るAI社員を挙げる。**名簿にある7人からだけ選ぶ。**'
    + 'すでに在籍している人で足りるなら空でよいが、**最初のフェーズのタスクの担当は'
    + '在籍していなければ必ずここに挙げる**（担当のいないタスクは誰も実行できない）。'
    + '「念のため」で増やさない。フェーズのどこで要るかを必ず書く。',
  input_schema: {
    type: 'object',
    properties: {
      hires: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            definition_id: { type: 'string', description: '名簿の definition_id。ここに無い ID を作らない' },
            display_name: { type: 'string', description: '名簿の「◯◯担当」。ここに無い名前を作らない' },
            why: { type: 'string', description: 'なぜ要るか。1文' },
            for_phase: { type: 'string', description: 'どのフェーズで要るか' },
          },
          required: ['definition_id', 'display_name', 'why', 'for_phase'],
        },
      },
    },
    required: ['hires'],
  },
};

/**
 * 計画。**最後まで引くが、詳細タスクは直近のフェーズだけ。**
 * 先のフェーズを最初から固定すると、前のフェーズの結果で引き直せなくなる。
 */
export const draftPlan: ToolDef = {
  name: 'draft_plan',
  description:
    'ロードマップを引く。フェーズは最後まで並べるが、**タスクは最初のフェーズぶんだけ**書く。'
    + '判断の関門（gates）は、それが決まらないと先へ進めない場所に置く。'
    + '**数は決めない** — 要るなら要るだけ、無いなら0。'
    + '**置かなかったところは会社が自分で進む**ので、「一応」で増やさない。',
  input_schema: {
    type: 'object',
    properties: {
      weeks: { type: 'number', description: '全体の見込み週数' },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '2〜6文字' },
            goal: { type: 'string', description: 'このフェーズで何ができたら次へ行けるか。1文' },
            weeks: { type: 'number' },
          },
          required: ['name', 'goal', 'weeks'],
        },
      },
      gates: {
        type: 'array',
        description: '社長でないと決められないところ。**数は決まっていない**（0でもよい）',
        items: {
          type: 'object',
          properties: {
            after_phase: { type: 'string', description: 'どのフェーズの中／あとか' },
            question: { type: 'string', description: '何を決めてもらうか。短く' },
          },
          required: ['after_phase', 'question'],
        },
      },
      first_phase_tasks: {
        type: 'array',
        description: '**最初のフェーズのタスクだけ。** 先のフェーズは書かない',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            intent: { type: 'string', description: '社員に渡す依頼文。画面には出さない' },
            owner_hint: { type: 'string', description: '名簿の「◯◯担当」。ここに無い名前を作らない' },
          },
          required: ['title', 'intent', 'owner_hint'],
        },
      },
      deliverables: {
        type: 'array',
        description: '承認すると作られるもの。**どのフェーズで出来るかも書く**（推測させない）',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '成果物の名前' },
            phase: { type: 'string', description: 'どのフェーズで出来るか。上の phases の name と同じ字' },
          },
          required: ['name', 'phase'],
        },
      },
    },
    required: ['weeks', 'phases', 'gates', 'first_phase_tasks', 'deliverables'],
  },
};

export const PHASE5_TOOLS: ToolDef[] = [decideContainer, askEnd, ask, proposeHires, draftPlan];
