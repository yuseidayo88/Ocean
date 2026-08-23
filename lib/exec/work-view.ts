import {
  AGENT_COLOR, DELIVERABLES, TASKS, WORK_DECISIONS, employee,
  type Deliverable, type Work,
} from '@/lib/dummy';
import type { LiveWork } from '@/lib/store/types';

/**
 * Work 画面が読む形。**1つだけ。**
 * ダミー（Phase 4 の静止データ）でも、承認して動きだした本物でも、ここに揃える。
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
  dels: Deliverable[];
  decs: [string, string][];
  crew: WorkCrew[];
  /** 右ペインの「最新の状況」。**まだ何も起きていないなら、そう書く** */
  lead: string;
  /** 統括AIがいつ言ったか。まだ言っていないなら undefined */
  leadWhen?: string;
};

/** Phase 4 のダミー → 画面の形。**見た目は変えない** */
export function fromDummy(w: Work): WorkView {
  const late = typeof w.health === 'object' ? w.health.late : undefined;
  const now = w.phases.find((p) => p.state === 'now');
  return {
    title: w.title, goal: w.goal, progress: w.progress, phaseIndex: w.phaseIndex, late,
    gate: w.gate?.label, rest: `${w.restDays}日`, endDate: w.endDate,
    phases: w.phases.map((p) => ({
      name: p.name, state: p.state, done: p.done, all: p.all, from: p.from, to: p.to,
    })),
    tasks: TASKS.filter((t) => t.workId === w.id && t.state !== '完了').slice(0, 4).map((t) => ({
      id: t.id, title: t.title,
      phase: w.phases.findIndex((p) => p.name === t.phase) + 1,
      owner: t.owner === 'me' ? 'あなた' : employee(t.owner).name, mine: t.owner === 'me',
      state: t.state, progress: t.progress,
    })),
    dels: DELIVERABLES.filter((d) => d.workId === w.id).slice(0, 4),
    decs: WORK_DECISIONS[w.id] ?? [],
    crew: w.crew.map((c) => ({
      id: c.id, name: employee(c.id).name, color: AGENT_COLOR[employee(c.id).color], dim: c.dim,
      tasks: TASKS.filter((t) => t.workId === w.id && t.owner === c.id && t.state !== '完了').length,
    })),
    lead: w.gate
      ? `${now?.name ?? ''}フェーズは後半です。${w.gate.label}だけ、判断を待っています。`
      : `${now?.name ?? ''}フェーズを進めています。`,
    leadWhen: '2時間前',
  };
}

/** 状態の語は6つだけ（→ CLAUDE.md）。DB の値をそこに写す */
const WORD: Record<string, string> = {
  queued: '待機', running: '実行中', needs_decision: '判断待ち',
  blocked: '停止', done: '完了', cancelled: '取消',
};

/**
 * 承認して動きだした本物 → 画面の形。
 * **進捗は 0 のまま。** タスクはまだ `queued` で、走らせるのは Phase 7。
 * ここで見せかけの数字を入れると、画面とバックエンドがずれる。
 */
export function fromLive(w: LiveWork): WorkView {
  const done = (id: string) => w.tasks.filter((t) => t.phaseId === id && t.state === 'done').length;
  const all = (id: string) => w.tasks.filter((t) => t.phaseId === id).length;
  const nowIdx = Math.max(0, w.phases.findIndex((p) => p.state === 'active'));
  const seq = new Map(w.phases.map((p) => [p.id, p.seq]));

  return {
    title: w.title, goal: w.goal,
    progress: w.tasks.length ? Math.round((w.tasks.filter((t) => t.state === 'done').length / w.tasks.length) * 100) : 0,
    phaseIndex: w.phases[nowIdx]?.seq ?? 1,
    phases: w.phases.map((p) => ({
      name: p.name,
      state: p.state === 'done' ? 'done' : p.state === 'active' ? 'now' : 'next',
      done: done(p.id), all: all(p.id),
    })),
    tasks: w.tasks.filter((t) => t.state !== 'done' && t.state !== 'cancelled').map((t) => ({
      id: t.id, title: t.title, phase: seq.get(t.phaseId) ?? 0,
      owner: t.owner ?? '担当は未定', state: WORD[t.state] ?? t.state, progress: 0,
    })),
    dels: [],
    decs: [],
    crew: w.crew.map((c) => ({
      id: c.id, name: c.name, color: c.color,
      tasks: w.tasks.filter((t) => t.owner === c.name && t.state !== 'done').length,
    })),
    // **まだ何も起きていない。** そう書く
    lead: w.status === 'active'
      ? `「${w.phases[nowIdx]?.name ?? ''}」を始めました。タスクは並んでいますが、AI社員はまだ動いていません（実行は Phase 7）。`
      : 'まだ始まっていません。',
  };
}
