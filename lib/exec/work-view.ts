import type { LiveWork } from '@/lib/store/types';

/**
 * Work 画面が読む形。**1つだけ。**
 * 読むのは store の LiveWork だけ（ダミーは撤去した — ゼロ状態から本物が積み上がる）。
 * 計画の承認（`PlanView`）と同じ作法 — 似た画面を2つ作らないため。
 *
 * **無いものは無いと出す。** 承認した直後の Work には成果物も決定もまだ無い。
 * それを埋めるために数字を作らない（偽の進捗を出さない）。
 */

export type WorkPhase = {
  name: string; state: 'done' | 'now' | 'next';
  done: number; all: number;
  /** 日付は分かるときだけ。ダミーにはあるが、立てたばかりの Work にはまだ無い */
  from?: string; to?: string;
};

export type WorkTask = {
  id: string; title: string;
  /** 1始まりのフェーズ番号。0 は「どのフェーズか分からない」 */
  phase: number;
  owner: string; mine?: boolean;
  state: string; progress: number;
};

export type WorkCrew = { id?: string; name: string; color: string; dim?: boolean; tasks: number };

/** 成果物の1行。**ダミーも本物も同じ形**（by は名前で持つ。id 引きは器の外でしない） */
export type WorkDel = {
  /** 成果物の種類（`doc` / `diagram` …）。持ち出すときの拡張子が変わる */
  kind?: string;
  id: string; title: string; byName: string; when?: string; state: string;
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
  phaseIndex: number;
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
   * そのフェーズで、社長がまだ見ていない成果物の数。
   * **0 でないうちは会社が勝手に進まない**（→ `app/actions/run.ts` の `gate`）ので、
   * 帯もそう言う — 「成果物 N件 を見て」。
   */
  gateUnseen: number;
  /** まだ社長が見ていない成果物の数 */
  unseen: number;
  /** 社長が止めているか（止めているあいだ、会社はこの Work を拾わない） */
  paused: boolean;
  /** Work が終わったか */
  finished?: boolean;
  crew: WorkCrew[];
  /** 右ペインの「最新の状況」。**まだ何も起きていないなら、そう書く** */
  lead: string;
  /** 統括AIがいつ言ったか。まだ言っていないなら undefined */
  leadWhen?: string;
};

/** 状態の語は6つだけ（→ CLAUDE.md）。DB の値をそこに写す */
const WORD: Record<string, string> = {
  queued: '待機', running: '実行中', needs_decision: '判断待ち',
  blocked: '停止', done: '完了', cancelled: '取消',
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

  return {
    title: w.title, goal: w.goal,
    progress: w.tasks.length ? Math.round((w.tasks.filter((t) => t.state === 'done').length / w.tasks.length) * 100) : 0,
    phaseIndex: w.phases[nowIdx]?.seq ?? 1,
    phases: w.phases.map((p) => ({
      name: p.name,
      // `review`（全タスクが終わって社長待ち）も「いま」の側に置く。まだ済んでいない
      state: p.state === 'done' ? 'done' : (p.state === 'active' || p.state === 'review') ? 'now' : 'next',
      done: done(p.id), all: all(p.id),
      ...(span.get(p.id) ?? {}),
    })),
    tasks: w.tasks.filter((t) => t.state !== 'done' && t.state !== 'cancelled').map((t) => ({
      id: t.id, title: t.title, phase: seq.get(t.phaseId) ?? 0,
      owner: t.owner ?? '担当は未定', state: WORD[t.state] ?? t.state,
      progress: t.progress ?? 0,
    })),
    dels: (w.dels ?? []).map((d) => ({
      id: d.id, title: d.title, byName: d.by ?? 'AI社員', when: d.when, state: d.state,
      // **持ち出すとき、拡張子が変わる**（図は .json）ので kind も渡す
      kind: d.kind, preview: d.preview, body: d.body, taskId: d.taskId,
    })),
    decs: [],
    live: true,
    active: w.status === 'active' && w.tasks.some((t) => t.state === 'queued' || t.state === 'running'),
    phaseGate: review?.name,
    gateUnseen: review
      ? (w.dels ?? []).filter((d) => d.state === '要確認'
          && !!d.taskId && w.tasks.find((t) => t.id === d.taskId)?.phaseId === review.id).length
      : 0,
    finished: w.status === 'done',
    /** 終わったときに出す事実（**「すべて揃っています」と言い切らない**） */
    unseen: (w.dels ?? []).filter((d) => d.state === '要確認').length,
    paused: w.status === 'paused',
    crew: w.crew.map((c) => ({
      id: c.id, name: c.name, color: c.color,
      tasks: w.tasks.filter((t) => t.owner === c.name && t.state !== 'done').length,
    })),
    lead: lead(w, nowIdx),
  };
}

/** 右ペインの「最新の状況」。**起きていることだけを言う** */
function lead(w: LiveWork, nowIdx: number): string {
  const phase = w.phases[nowIdx]?.name ?? '';
  const running = w.tasks.find((t) => t.state === 'running');
  const deciding = w.tasks.find((t) => t.state === 'needs_decision');
  const blocked = w.tasks.find((t) => t.state === 'blocked');
  if (w.status !== 'active') return 'まだ始まっていません。';
  if (deciding) return `「${deciding.title}」で判断を待っています。決まれば続きが動きます。`;
  if (blocked) return `「${blocked.title}」が止まっています。通知から見てください。`;
  if (running) return `「${phase}」を進めています。いまは ${running.owner ?? 'AI社員'} が「${running.title}」の途中です。`;
  if (w.tasks.some((t) => t.state === 'queued')) return `「${phase}」のタスクが並んでいます。画面を開いているあいだ、順に動きます。`;
  if (w.tasks.length && w.tasks.every((t) => t.state === 'done' || t.state === 'cancelled'))
    return `「${phase}」のタスクが終わりました。成果物を見てください。`;
  return `「${phase}」を進めています。`;
}
