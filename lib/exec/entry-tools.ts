import type { ToolDef } from '@/lib/ai';

/**
 * 入口（Case B / D）で統括AIに渡す道具。
 * Phase 5 と同じ思想 — **文章で返させない。** 画面に出すものは全部この形で受け取る。
 */

/* ══════════════ Case B — まだ決まっていない ══════════════ */

/**
 * 社長が言ったことを条件の構造に写す。
 * 自由文のまま貯めると、条件を1つ変えて候補を出し直せなくなる。
 */
export const setConditions: ToolDef = {
  name: 'set_conditions',
  description:
    '社長が言ったことを条件の構造に写す。**分かった項目だけ**書く（書かなかった項目は前のまま残る）。'
    + '推測で埋めない。',
  input_schema: {
    type: 'object',
    properties: {
      interests: { type: 'array', items: { type: 'string' },
        description: '興味のある分野・やってみたい業種・扱いたいもの。**これが分からないうちは候補を出さない**' },
      hours_per_week: { type: 'number', description: '週に使える時間' },
      budget_jpy: { type: 'number', description: '使えるお金（円）' },
      strengths: { type: 'array', items: { type: 'string' }, description: '得意なこと。短い語で' },
      avoid: { type: 'array', items: { type: 'string' }, description: 'やりたくないこと。短い語で' },
      deadline: { type: 'string', description: 'いつまでに。言っていなければ書かない' },
    },
  },
};

/** 候補3つ。1つだけ推す。**選ばなかった道も残す**ので、推さない2つには理由を書かせる */
export const proposeCandidates: ToolDef = {
  name: 'propose_candidates',
  description:
    '条件に合う事業の候補を**ちょうど3つ**出す。1つだけ recommended を立てる。'
    + '推す候補には why（推す理由）を3つ、推さない2つには not_chosen_why を必ず書く。'
    + 'fit は 0〜100 の3スコア — '
    + '**demand=欲しがっている人がいるか** / **solo=1人で回せるか** / speed=最初の1件までの近さ。'
    + '\n\n**社長はひとりです。人を雇いません。**'
    + 'だから **hours_per_week が社長の使える時間を超える候補は出さないでください**'
    + '（範囲を狭めて、時間の中に収まる形にする）。'
    + '\n**抽象に逃げない。** who（誰が買うか）と first_one（最初の1人をどこで見つけるか）が'
    + '書けない候補は、候補ではありません — '
    + '「個人」「中小企業」「困っている人」は書いたことになりません。'
    + '\n**あなたは Web を見ていません。** 需要は自分の記憶から言っているだけなので、'
    + '**unsure に「まだ確かめていないこと」を必ず書いてください**（そのうえで、'
    + '承認された Work の最初のフェーズで確かめます）。',
  input_schema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '候補の名前。**誰に何を**が分かる具体的なもの（「テンプレート制作」ではなく「飲食店むけのメニュー表テンプレート」）。10〜24文字' },
            summary: { type: 'string', description: 'なぜこの条件に合うか。1〜2文' },
            ending: { type: 'string', description: '**何ができたら完了か。** 1文で、見れば分かる状態を書く（「最初の1件が売れている」）。社長はこれを見て承認する' },
            why: { type: 'array', items: { type: 'string' }, description: '推す理由（recommended のとき3つ）' },
            who: {
              type: 'string',
              description: '**誰が買うのか。** 具体的に（「飲食店の店長」ではなく'
                + '「席が10〜20の個人店で、メニューを自分で作り直している店主」）。'
                + '**いま何にお金や時間を使っている人か**まで書く。20〜50文字',
            },
            first_one: {
              type: 'string',
              description: '**最初の1人を、どこでどうやって見つけるか。** 具体的な場所とやり方を1文。'
                + 'ここが書けない候補は始められません',
            },
            unsure: {
              type: 'string',
              description: '**まだ確かめていないこと。** あなたは Web を見ていないので、'
                + '需要は記憶から言っているだけです。何が確かめられていないかを1文で',
            },
            hours_per_week: {
              type: 'number',
              description: '**この事業を回すのに週に何時間要るか。** '
                + '社長の使える時間を超えないこと（超えるなら範囲を狭める）',
            },
            fit: {
              type: 'object',
              properties: {
                demand: { type: 'number', description: '欲しがっている人がいるか（すでにお金や時間を使っている人がいるほど高い）' },
                solo: { type: 'number', description: '1人で回せるか（人手・在庫・設備が要るほど低い）' },
                speed: { type: 'number', description: '最初の1件までの近さ' },
              },
              required: ['demand', 'solo', 'speed'],
            },
            recommended: { type: 'boolean' },
            not_chosen_why: { type: 'string', description: '推さない理由。1文' },
          },
          required: ['name', 'summary', 'ending', 'who', 'first_one', 'unsure', 'hours_per_week', 'fit', 'recommended'],
        },
      },
    },
    required: ['candidates'],
  },
};

/* ══════════════ Case D — すでに事業がある ══════════════ */

/** 事業が何かを1行で。読み取れないことは書かせない */
export const describeBusiness: ToolDef = {
  name: 'describe_business',
  description: '取り込んだものから、この事業が何かを言う。サイト名・商品名から名前を取る。読み取れないことは書かない。',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '事業の名前。2〜20文字' },
      stage: { type: 'string', description: '段階。1語（例: 立ち上げ期 / 成長期）' },
    },
    required: ['name'],
  },
};

/** 数字の帯。**測れていないことも出す**（それ自体が診断） */
export const reportFacts: ToolDef = {
  name: 'report_facts',
  description:
    '数字の帯を3〜4つ。取り込んだものから**読み取れた数字だけ**を書く。'
    + '読み取れなかった大事な数字は value を「—」にして missing=true で出す — 測れていないこと自体が診断。',
  input_schema: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '2〜6文字' },
            value: { type: 'string', description: '数字。読み取れなければ —' },
            note: { type: 'string', description: '補足。1行' },
            missing: { type: 'boolean', description: '測れていないなら true' },
          },
          required: ['label', 'value'],
        },
      },
    },
    required: ['facts'],
  },
};

/** 見つかったこと。**診断は必ず「次に何をするか（Work）」まで持つ** */
export const reportDiagnosis: ToolDef = {
  name: 'report_diagnosis',
  description:
    '見つかったことを**効きそうな順**に2〜4件。問題を並べて終わりにしない — '
    + '1件ごとに提案する Work（title / goal / weeks）まで必ず書く。'
    + '根拠（evidence）には取り込んだものの名前を挙げる。出典のない数字を事実として書かない。',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['重い', '中くらい', '軽い'] },
            title: { type: 'string', description: '8〜20文字' },
            why: { type: 'string', description: 'なぜそう言えるか。1文' },
            evidence: { type: 'array', items: { type: 'string' }, description: '根拠。取り込んだものの名前と中身' },
            work: {
              type: 'object',
              description: '提案する Work',
              properties: {
                title: { type: 'string', description: '4〜20文字' },
                goal: { type: 'string', description: '何ができたら終わりか。1文' },
                weeks: { type: 'number' },
              },
              required: ['title', 'goal', 'weeks'],
            },
          },
          required: ['severity', 'title', 'why', 'evidence', 'work'],
        },
      },
    },
    required: ['findings'],
  },
};
