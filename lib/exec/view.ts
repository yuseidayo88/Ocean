import type { EmployeeColor } from '@/lib/view/model';
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
  /**
   * 統括AIが聞いていること。**答えられる形で画面に出す。**
   * 前はここまで来ていなかった（DB には書かれ、読み戻され、ここで落ちていた）ので、
   * 「質問は説明つきの選択肢リストで出す」が本番の道に載っていなかった。
   */
  asks: PlanAsk[];
};

export type PlanAsk = {
  body: string; why: string;
  options: { label: string; note: string; recommended?: boolean }[];
  /** 答えたもの。まだなら undefined */
  answer?: string;
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
    asks: d.questions.map((q) => ({
      body: q.body, why: q.why, answer: q.answer,
      options: (q.options ?? []).map((o) => ({
        label: o.label, note: o.description ?? '', recommended: o.recommended,
      })),
    })),
    why: [
      d.container.reason,
      `直近の「${rows[0]?.name ?? ''}」だけタスクまで引いています。先のフェーズは名前とねらいだけです。`,
      '前のフェーズの結果とあなたの判断で、あとから引き直せる形にしてあります。',
    ],
  };
}

