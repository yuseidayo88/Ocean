import type { ToolDef } from '@/lib/ai';

/**
 * チャットの統括AIが持つ道具（入口も相談も、ぜんぶここで起きる）。
 *
 * Phase 5 と違って、**チャットは文章が主役**。道具は返事に添える「カード」を作るためのもので、
 * 道具が1つも来ない往復（ただの返事）も正しい。
 */

/**
 * Work を作る提案。**社長に確認してから作る** —
 * 「作りますか？」を挟まずに立てると、会話しただけで Work が増える。
 */
export const proposeWork: ToolDef = {
  name: 'propose_work',
  description:
    '話がまとまって Work にできるとき、**作る前に**これで提案する。'
    + '3条件（終わりが言える / 単独で価値がある / 3ヶ月以内）がそろったときだけ。'
    + '雑談・質問・調べもので済む話には使わない。'
    + '**この会話でもう Work を作っているなら、二度と呼ばない。**',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '4〜20文字。社長の言葉をそのまま使う' },
      goal: { type: 'string', description: '何ができたら終わりか。1文' },
      weeks: { type: 'number', description: '見込みの週数' },
      why: { type: 'string', description: 'なぜ Work にできるか。1文。社長に見せる' },
    },
    required: ['title', 'goal', 'weeks', 'why'],
  },
};

/**
 * 社長が渡した材料を覚える（すでに事業がある人の入口）。
 * **中身を読めたものだけ content を書く** — URL は名前だけ覚える。
 */
export const rememberMaterial: ToolDef = {
  name: 'remember_material',
  description:
    '社長が事業の材料（サイトのURL・資料の中身・売上などの数字）を書いたら、これで覚える。'
    + 'URL は locator だけ書く（中身はまだ読めないので content は書かない）。'
    + '文章で書かれた数字や説明は content にそのまま入れる。',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['site', 'doc', 'sheet'], description: 'サイト / 資料 / 表' },
      locator: { type: 'string', description: 'URL、またはその材料の呼び名' },
      content: { type: 'string', description: '読み取れた中身。URL のときは書かない' },
    },
    required: ['kind', 'locator'],
  },
};
