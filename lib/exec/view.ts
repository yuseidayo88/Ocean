import type { EmployeeColor } from '@/lib/dummy';
import type { DraftWork } from '@/lib/store/types';

/**
 * 計画の承認の画面が読む形。**1つだけ。**
 * ダミー（Phase 4 の静止データ）でも、統括AIが立てた本物でも、ここに揃える。
 * 画面を2つ作らないため。
 */

export type PlanRow = {
  name: string; goal: string;
  /** 週の軸の上での位置 */
  w0: number; w1: number;
  who: string; weeks: string;
  /** まだ担当が決まっていないフェーズは点線 */
  soft?: boolean;
  /** 判断の関門。ここに ◆ が立つ */
  dec?: string;
};

export type PlanView = {
  title: string;
  /** 社長が書いた言葉。そのまま出す */
  goal: string;
  /** 統括AIの一言 */
  lead: string;
  weeks: number;
  rows: PlanRow[];
  hires: { name: string; color: EmployeeColor }[];
  /** 作るもの [名前, どのフェーズか] */
  makes: [string, string][];
  /** **本物のモデルが立てた計画か。** 決め打ちなら画面にそう出す */
  real: boolean;
  /** なぜこの順番か（右ペイン） */
  why: string[];
  /** 時間の使い方への一言。**統括AIが言っていないなら出さない** */
  timeNote?: string;
  /** 前提にしていること。同上 — 無いなら節ごと出さない */
  facts?: [string, string][];
  /** 見送った案。同上 */
  dropped?: string;
  /** 承認したらすぐ動きだすタスクの数。**直近のフェーズぶんだけ引いてある** */
  firstTasks: number;
  /** もう承認されたか。**押せる顔をさせない**ために画面が読む */
  approved?: boolean;
};

const COLORS: EmployeeColor[] = ['cyan', 'purple', 'indigo', 'green'];

/** 統括AIが立てた計画 → 画面の形 */
export function fromDraft(d: DraftWork): PlanView {
  let at = 0;
  const rows: PlanRow[] = d.plan.phases.map((p, i) => {
    const w0 = at; at += p.weeks;
    const gate = d.plan.gates.find((g) => g.afterPhase === p.name);
    // 担当が分かるのは、いま詳細を引いた最初のフェーズと、採用で名前が出たところだけ
    const owner = i === 0
      ? d.plan.firstPhaseTasks[0]?.ownerHint
      : d.hires.find((h) => h.forPhase === p.name)?.displayName;
    return {
      name: p.name, goal: p.goal, w0, w1: at,
      who: owner ?? '担当は未定', weeks: `${p.weeks}週`,
      soft: !owner, dec: gate?.question,
    };
  });
  return {
    title: d.title,
    goal: d.goal,
    lead: `${d.plan.phases.length}フェーズで進めます。まず「${d.plan.phases[0]?.name ?? ''}」から — ${d.plan.phases[0]?.goal ?? ''}。`,
    weeks: d.plan.weeks || at,
    rows,
    hires: d.hires.map((h, i) => ({ name: h.displayName, color: COLORS[i % COLORS.length] })),
    makes: d.plan.deliverables.map((m, i) => {
      // 成果物がどのフェーズのものかは、順番で割り当てる（統括AIには聞いていない）
      const per = Math.max(1, Math.ceil(d.plan.deliverables.length / Math.max(1, rows.length)));
      return [m, `フェーズ${Math.min(rows.length, Math.floor(i / per) + 1)}`] as [string, string];
    }),
    real: d.real,
    firstTasks: d.plan.firstPhaseTasks.length,
    approved: d.approved,
    why: [
      d.container.reason,
      `直近の「${rows[0]?.name ?? ''}」だけタスクまで引いています。先のフェーズは名前とねらいだけです。`,
      '前のフェーズの結果とあなたの判断で、あとから引き直せる形にしてあります。',
    ],
  };
}

/** Phase 4 のダミー。**中身は変えない**（承認済みの見た目のまま） */
export const DUMMY_VIEW: PlanView = {
  title: '日本語学習サービス',
  goal: '韓国人向けの日本語学習サービスを立ち上げたい',
  lead: '4フェーズで進めます。まず市場を確かめ、勝てる形が見えてから作りはじめます。',
  weeks: 10,
  rows: [
    { name: '調査', goal: '市場・競合・ターゲットを確かめる', w0: 0, w1: 3, who: '調査担当', weeks: '3週' },
    { name: '戦略', goal: '収益モデルと価格を決める', w0: 3, w1: 5, who: '戦略担当', weeks: '2週', dec: '価格の方向性' },
    { name: 'プロダクト', goal: 'MVPの要件を固めて作る', w0: 5, w1: 8, who: '企画担当', weeks: '3週', dec: 'MVPの線引き' },
    { name: 'ローンチ', goal: '初期ユーザーを集める', w0: 8, w1: 10, who: '担当は未定', weeks: '2週', soft: true },
  ],
  hires: [{ name: '調査担当', color: 'cyan' }, { name: '戦略担当', color: 'purple' }, { name: '企画担当', color: 'indigo' }],
  makes: [
    ['市場規模レポート', 'フェーズ1'], ['競合分析レポート', 'フェーズ1'], ['ペルソナ仮説', 'フェーズ1'],
    ['収益モデル比較', 'フェーズ2'], ['MVP要件定義', 'フェーズ3'], ['LPと申込フォーム', 'フェーズ3'],
  ],
  real: true,
  firstTasks: 3,
  timeNote: '作る前に確かめることに半分を使います。ここで外すと、あとの5週がまるごと無駄になります。',
  facts: [['韓国の日本語学習者', '約 12万人'], ['あなたが使える時間', '週 10時間'], ['初期の資金', '〜50万円'], ['出典', '3件 ›']],
  dropped: 'いきなりLPを作る — 誰に何を売るかが決まる前に作ると、ほぼ作り直しになります。フェーズ3に入れました。',
  why: [
    '確かめることに半分の時間を使います。作ってから間違いに気づくほうが高くつくからです。',
    '価格を決めるまでは作りません。作るものが変わるからです。',
    'ローンチの担当は、プロダクトの形が決まってから決めます。',
  ],
};
