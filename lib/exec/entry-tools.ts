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
    + 'fit は 0〜100 の3スコア — speed=立ち上がりの速さ / cost=初期費用の低さ / strength=強みとの相性。',
  input_schema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '候補の名前。10〜20文字' },
            summary: { type: 'string', description: 'なぜこの条件に合うか。1〜2文' },
            why: { type: 'array', items: { type: 'string' }, description: '推す理由（recommended のとき3つ）' },
            fit: {
              type: 'object',
              properties: {
                speed: { type: 'number' }, cost: { type: 'number' }, strength: { type: 'number' },
              },
              required: ['speed', 'cost', 'strength'],
            },
            recommended: { type: 'boolean' },
            not_chosen_why: { type: 'string', description: '推さない理由。1文' },
          },
          required: ['name', 'summary', 'fit', 'recommended'],
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
