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
    /**
     * **フェーズの担当は計画が持っている**（2026-08-26）。
     * 前は最初のフェーズだけで、あとは「担当は未定」と出ていた —
     * それは表示ではなく中身の問題で、実際にあとのフェーズの人は採用されていなかった。
     * 担当を持たない古い控えのときだけ、これまでどおり拾う。
     */
    const owner = p.owner
      || (i === 0 ? d.plan.firstPhaseTasks[0]?.ownerHint
        : d.hires.find((h) => h.forPhase === p.name)?.displayName);
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
    /**
     * **統括AIが言ったフェーズだけを出す**（2026-08-25）。
     * 前は順番から割り当てていて、誰も言っていないことを承認の画面に書いていた。
     * 書いていないもの・名簿に無いフェーズ名は**空にする** — でっち上げない。
     */
    makes: d.plan.deliverables.map((m) => {
      const at = m.phase ? rows.findIndex((r) => r.name === m.phase) : -1;
      return [m.name, at >= 0 ? `フェーズ${at + 1}` : ''] as [string, string];
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
    /**
     * **なぜこの順番か。** 統括AIが書いたものをそのまま出す（2026-08-26）。
     *
     * 前はここが**どの Work でも同じ3行**の決まり文句だった
     * （「直近のフェーズだけタスクを引いています」— それは仕組みの説明で、
     * 画面がもう言っている）。社長は**根拠がゼロのロードマップを承認していた**。
     *
     * **入れ物の判定の理由（`container.reason`）は出さない**（2026-08-26 に外した）。
     * 「終わりが言えて、単独で価値があり、3ヶ月に収まるので Work にします」は
     * **仕組みの説明**で、見出しの「なぜこの順番か」に答えていない。
     * そもそも社長には「これは Work ですか？」と聞かないと決めてある —
     * 入れ物の判定は会社の側の話で、承認の材料ではない。
     */
    why: (d.plan.why ?? []).filter(Boolean),
    // 下の3つは**統括AIが言っていないなら節ごと出さない**（画面が空節を描かない）
    timeNote: d.plan.timeNote,
    facts: (d.plan.assumes ?? []).map((a) => [a.label, a.value] as [string, string]),
    dropped: d.plan.dropped,
  };
}

