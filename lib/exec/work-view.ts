import type { LiveDecision, LiveWork } from '@/lib/store/types';
import { TASK_WORD } from '@/lib/view/model';
import { workPct } from '@/lib/live/progress';

/**
 * Work 画面が読む形。**1つだけ。**
 * 読むのは store の LiveWork だけ（ダミーは撤去した — ゼロ状態から本物が積み上がる）。
 * 計画の承認（`PlanView`）と同じ作法 — 似た画面を2つ作らないため。
 *
 * **無いものは無いと出す。** 承認した直後の Work には成果物も決定もまだ無い。
 * それを埋めるために数字を作らない（偽の進捗を出さない）。
 */

export type WorkPhase = {
  name: string;
  /**
   * `wait` ＝ 全タスクが終わって**社長の番**（DB の `review`）。
   * 前は `now` に混ぜていたので、**終わっているフェーズが「いま」の顔**をしていた
   * （進捗のバーも灰色のまま — 1/1 なのに空に見えた）。
   */
  state: 'done' | 'now' | 'wait' | 'next';
  done: number; all: number;
  /**
   * **社長が承認した、このフェーズのねらいと担当**（2026-08-27）。
   * 計画の画面はこの2つを並べて見せ、社長はそれを読んで承認する。
   * それなのに承認した瞬間、**Work 画面はどちらも捨てていた** —
   * 残るのは名前と本数だけで、「誰が何のためにやっているか」がどこにも無かった。
   */
  goal?: string; owner?: string;
  /** 計画の ◆（このフェーズの終わりに社長が決めること）。無ければ会社が自分で進む */
  gate?: string;
  /** 日付は分かるときだけ。週数の無い計画には書かない */
  from?: string; to?: string;
};

export type WorkTask = {
  id: string; title: string;
  /** 1始まりのフェーズ番号。0 は「どのフェーズか分からない」 */
  phase: number;
  owner: string;
  state: string; progress: number;
  /**
   * 済んだもの（完了・取消）。**沈めて、いちばん下に置く**。
   *
   * 前はここで**捨てていた**ので、節が「いま動いているもの」になり、
   * **走っているものが1つも無い時間はまるごと空**だった（実測で、
   * フェーズが閉じて社長を待っているあいだ、ずっと「まだありません。」）。
   * AI社員が何をしたかは、この Work の記録そのものなので、消さない。
   */
  past?: boolean;
};

export type WorkCrew = { id?: string; name: string; color: string; dim?: boolean; tasks: number };

/** 成果物の1行。**ダミーも本物も同じ形**（by は名前で持つ。id 引きは器の外でしない） */
export type WorkDel = {
  /** 成果物の種類（`doc` / `diagram` …）。持ち出すときの拡張子が変わる */
  kind?: string;
  id: string; title: string; byName: string; when?: string; state: string;
  /**
   * 版（v2〜だけ出す）。**差し戻しをするのはこの画面**なので、
   * 「いま見ているのは直した版だ」がここに出ないのはおかしい
   * （成果物の一覧には前から出ていた）。
   */
  version?: number;
  /** 実際の書き出し（本物）。ダミーは図形のサムネイルで代用 */
  preview?: string;
  /** 本文（markdown）。右ペインで開く */
  body?: string;
  /**
   * 出したタスク。**差し戻しの直しタスクを、同じ担当に積むために要る。**
   * 前はここで落としていたので、直しタスクが「担当は未定」で生まれ、
   * 誰の頭も載らないまま走っていた（→ `addFixTask`）。
   */
  taskId?: string;
};

export type WorkView = {
  title: string; goal: string;
  progress: number;
  /** 遅れている日数。順調なら undefined */
  late?: number;
  /** あなたが決めること。無ければ undefined */
  gate?: string;
  /** 残り。分からないときは出さない */
  rest?: string; endDate?: string;
  phases: WorkPhase[];
  tasks: WorkTask[];
  dels: WorkDel[];
  decs: [string, string][];
  /** 本物か。本物なら画面がポーリングして、タスクの行が右ペインを開く */
  live?: boolean;
  /** まだ走るものがあるか（ポンプを回すかの判定） */
  active?: boolean;
  /** 承認待ちのフェーズ名（review）。あれば画面の上に行動の帯を出す */
  phaseGate?: string;
  /**
   * **いま社長に聞いている ◆**（フェーズの関門。2026-08-26）。
   * 計画に「あなたが決めるのは ◆ の N か所」と書いた、その質問。
   * これがあるあいだは「次のフェーズへ進める」を出さない —
   * **決めるのが先**で、決まればポンプが自分で次を引く。
   */
  gateAsk?: LiveDecision;
  /**
   * そのフェーズで、社長がまだ見ていない成果物の数。
   * **0 でないうちは会社が勝手に進まない**（→ `app/actions/run.ts` の `gate`）ので、
   * 帯もそう言う — 「成果物 N件 を見て」。
   */
  gateUnseen: number;
  /** まだ社長が見ていない成果物の数 */
  unseen: number;
  /** まだ承認していない（計画の画面へ戻す帯を出す） */
  unapproved?: boolean;
  /** 社長が止めているか（止めているあいだ、会社はこの Work を拾わない） */
  paused: boolean;
  /** Work が終わったか */
  finished?: boolean;
  crew: WorkCrew[];
  /** 右ペインの「最新の状況」。**まだ何も起きていないなら、そう書く** */
  lead: string;
};

/**
 * 承認して動きだした本物 → 画面の形。
 * 進捗は run_steps から導出された `tasks.progress` をそのまま写す（→ 0012）。
 */
export function fromLive(w: LiveWork): WorkView {
  const done = (id: string) => w.tasks.filter((t) => t.phaseId === id && t.state === 'done').length;
  const all = (id: string) => w.tasks.filter((t) => t.phaseId === id).length;
  /**
   * いまどのフェーズか。**終わった Work は最後のフェーズまで来ている**（2026-08-25）。
   * 前は active を探すだけだったので、全フェーズが done の Work で −1 → 0 に落ち、
   * 画面が「フェーズ 1 / 4」と出していた（100% なのに1番目、という食い違い）。
   */
  const activeIdx = w.phases.findIndex((p) => p.state === 'active' || p.state === 'review');
  const nowIdx = activeIdx >= 0 ? activeIdx : Math.max(0, w.phases.length - 1);
  const seq = new Map(w.phases.map((p) => [p.id, p.seq]));
  const review = w.phases.find((p) => p.state === 'review');

  /**
   * フェーズの日付（2026-08-26）。**会社ぜんぶのカレンダー（ホームの進捗）は畳んだ**ので、
   * 日付を持つのはここだけになった。出どころは**社長が承認した計画の週数**で、
   * 週数の無い計画には**書かない**（でっち上げない）。
   */
  const DAY = 24 * 3600 * 1000;
  const md = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const weeks = w.phases.reduce((a, p) => a + (p.weeks ?? 0), 0);
  const begin = w.startedAt ? new Date(w.startedAt).getTime() : 0;
  const dated = weeks > 0 && begin > 0;
  let at = begin;
  const span = new Map<string, { from: string; to: string }>();
  for (const p of w.phases) {
    const to = at + (p.weeks ?? 0) * 7 * DAY;
    if (dated) span.set(p.id, { from: md(at), to: md(to) });
    at = to;
  }

  /**
   * **「残り」を本当に埋める**（2026-08-26）。
   *
   * `rest` / `endDate` / `late` は型にあるだけで**誰も埋めていなかった** —
   * Work 画面のいちばん上の帯に「残り —」が、どの Work でも永久に出ていた。
   * 出どころはフェーズの行がすでに使っている**承認したときの見込み**（週数 ＋ 開始日）で、
   * それ以外に基準は無い（→ `paceSay` と同じ考え方）。
   * **週数の無い計画には言わない**（無いものは無いと出す）。
   */
  const endMs = dated ? at : 0;
  const over = endMs ? Math.ceil((Date.now() - endMs) / DAY) : 0;
  const ended = w.status === 'done';
  // 終わった Work に「あと N日」は言わない（進捗 100% がもう言っている）
  // **`endMs &&` で書かない** — 週数の無い計画では 0（数）が残り、画面の
  // `w.late !== undefined` が真になって「遅れ」の赤が点く
  const late = !ended && endMs > 0 && over > 0 ? over : undefined;
  const rest = ended || !endMs ? undefined
    : late ? `遅れ ${late}日`                                  // 語彙は 順調 / 遅れ N日 の2つだけ
    : `${Math.max(0, Math.ceil((endMs - Date.now()) / DAY))}日`;

  return {
    late, rest,
    endDate: !ended && endMs ? `${md(endMs)} まで` : undefined,
    title: w.title, goal: w.goal,
    /**
     * **進捗はフェーズで数える**（2026-08-27）。
     *
     * 前は「済んだタスク ÷ ぜんぶのタスク」だった。ところが**タスクは直近の
     * フェーズぶんしか引かれていない**（先を固定しない設計）ので、
     * 4フェーズの Work でフェーズ1が終わると**進捗 100%**。
     * 実測でも「進捗 100% / フェーズ 1 / 2」が並んで出ていた —
     * 隣り合う2つの数字が違うことを言っている画面は、どちらも信じられない。
     *
     * フェーズは計画のときに全部決まっているので、**分母は最初から本物**。
     * 済んだフェーズ（`review` ＝ 終わって社長待ちも含む）を 1、
     * いま動いているフェーズはその中のタスクの割合で数える。
     */
    progress: workPct(w),
    phases: w.phases.map((p) => ({
      name: p.name,
      // `review` は**終わって社長の番**。「いま」に混ぜると、済んだものが動いて見える
      state: p.state === 'done' ? 'done' : p.state === 'review' ? 'wait' : p.state === 'active' ? 'now' : 'next',
      done: done(p.id), all: all(p.id),
      goal: p.goal || undefined, owner: p.owner, gate: p.gate,
      ...(span.get(p.id) ?? {}),
    })),
    /**
     * **済んだタスクも出す**（2026-08-27。`past` で沈める）。
     * 走っているものが1つも無い時間は珍しくない（社長を待っているあいだは必ずそう）ので、
     * 捨てると節がまるごと空になる。並べ替えは画面がやる — 動いているものが先。
     */
    tasks: w.tasks.map((t) => ({
      id: t.id, title: t.title, phase: seq.get(t.phaseId) ?? 0,
      owner: t.owner ?? '担当は未定', state: TASK_WORD[t.state] ?? t.state,
      progress: t.progress ?? 0,
      past: t.state === 'done' || t.state === 'cancelled',
    })),
    dels: (w.dels ?? []).map((d) => ({
      id: d.id, title: d.title, byName: d.by ?? 'AI社員', when: d.when, state: d.state,
      version: d.version,
      // **持ち出すとき、拡張子が変わる**（図は .json）ので kind も渡す
      kind: d.kind, preview: d.preview, body: d.body, taskId: d.taskId,
    })),
    /**
     * **決めたことは、この Work のもの**（2026-08-26）。
     * 前はここが `[]` に決め打ちされていて、右ペインの節が
     * **どの Work でも永久に「まだありません」**と出ていた。
     */
    decs: (w.decs ?? []).map((d): [string, string] => [d.when ?? '', `${d.question} → ${d.chosen}`]),
    live: true,
    active: w.status === 'active' && w.tasks.some((t) => t.state === 'queued' || t.state === 'running'),
    phaseGate: review?.name,
    /**
     * **「判断待ち」の列を本物にする**（2026-08-27）。
     * `gate` は型にあるだけで**誰も埋めていなかった**ので、この列は
     * どの Work でも永久に「—」だった（帯の5つのうち1つが、ずっと死んでいた）。
     * 待たせているのは2つ — フェーズの関門（◆）と、実行中に詰まったタスク。
     */
    gate: w.openDec?.question
      ?? w.tasks.find((t) => t.state === 'needs_decision')?.title,
    gateAsk: w.openDec,
    gateUnseen: review
      ? (w.dels ?? []).filter((d) => d.state === '要確認'
          && !!d.taskId && w.tasks.find((t) => t.id === d.taskId)?.phaseId === review.id).length
      : 0,
    finished: w.status === 'done',
    /**
     * **まだ承認していない**（2026-08-26）。承認前の Work も `listWorks` に出るので、
     * レールの「Work」や ⌘K からここへ来られる。それなのに画面には
     * 「まだ始まっていません。」としか出ておらず、**計画へ戻る道が無かった** —
     * 承認しないと何も始まらないのに、その承認がどこにあるか言っていない。
     */
    unapproved: w.status === 'plan_review',
    /** 終わったときに出す事実（**「すべて揃っています」と言い切らない**） */
    unseen: (w.dels ?? []).filter((d) => d.state === '要確認').length,
    paused: w.status === 'paused',
    crew: w.crew.map((c) => {
      const tasks = w.tasks.filter((t) => t.owner === c.name && t.state !== 'done').length;
      /**
       * **手が空いている人は「待機」**（2026-08-26）。`dim` は型にあるだけで
       * **誰も立てていなかった**ので、右ペインには「0タスク」が7人ぶん並んでいた。
       * 状態の語は6つだけ — 0 を数字で言わず、待機と言う。
       */
      return { id: c.id, name: c.name, color: c.color, tasks, dim: tasks === 0 };
    }),
    lead: lead(w, nowIdx),
  };
}

/** 右ペインの「最新の状況」。**起きていることだけを言う** */
function lead(w: LiveWork, nowIdx: number): string {
  const phase = w.phases[nowIdx]?.name ?? '';
  const running = w.tasks.find((t) => t.state === 'running');
  const deciding = w.tasks.find((t) => t.state === 'needs_decision');
  const blocked = w.tasks.find((t) => t.state === 'blocked');
  /**
   * **終わった Work / 止めた Work を「まだ始まっていません」と言わない**（2026-08-27）。
   * この1行は右ペインの奥にあったので誰も見ていなかったが、
   * 中央の、題のすぐ下に出したので、間違いがそのまま画面の顔になる。
   */
  if (w.status === 'done') {
    const n = (w.dels ?? []).length;
    return `この Work は終わりました。${n ? `成果物 ${n}件 が残っています。` : ''}`;
  }
  if (w.status === 'paused') return 'あなたが止めています。動かすと、続きから進みます。';
  if (w.status !== 'active') return 'まだ始まっていません。';
  if (deciding) return `「${deciding.title}」で判断を待っています。決まれば続きが動きます。`;
  // **行き先のある1行にする**（2026-08-26）。前は「通知から見てください」と言っていたが、
  // 通知にも行動は無かった。いまは開けば、もう一度やるか飛ばすかを選べる
  if (blocked) return `「${blocked.title}」が止まっています。開いて、もう一度やるか飛ばすかを決めてください。`;
  if (running) return `「${phase}」を進めています。いまは ${running.owner ?? 'AI社員'} が「${running.title}」の途中です。`;
  if (w.tasks.some((t) => t.state === 'queued')) return `「${phase}」のタスクが並んでいます。画面を開いているあいだ、順に動きます。`;
  if (w.tasks.length && w.tasks.every((t) => t.state === 'done' || t.state === 'cancelled'))
    return `「${phase}」のタスクが終わりました。成果物を見てください。`;
  return `「${phase}」を進めています。`;
}
