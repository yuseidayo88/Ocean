import { AGENT_COLOR, type EmployeeColor } from '@/lib/dummy';
import { AppError } from '@/lib/errors';
import type { DraftWork, LiveDecision, LiveEmployee, LiveWork, RunStep, Store } from './types';

/**
 * メモリの保存先。**Supabase に出られない環境（デモ・この開発環境）用。**
 * プロセスが死ぬと消える。それでいい — 本物は Supabase のほう。
 *
 * **Supabase 版と同じ順序で同じことをする。** 片方だけで通る道を作らない
 * （デモで動いたものが本番で落ちる、が起きる）。
 *
 * 開発中の hot reload で作り直されないように、グローバルに置く。
 */
const g = globalThis as unknown as { __drafts?: Map<string, Row> };

type Row = DraftWork & { live?: LiveWork };
const bag = (g.__drafts ??= new Map<string, Row>());

let n = 0;

/** 提案した社員に色を配る。**定義 id からいつも同じ色になる**（開き直すたびに変わらない） */
const WHEEL: EmployeeColor[] = ['cyan', 'purple', 'indigo', 'green'];
export const colorFor = (definitionId: string, i: number): EmployeeColor =>
  WHEEL[(definitionId.length + i) % WHEEL.length];

/** 承認したあとの姿を、控えから組み立てる（Supabase 版の SELECT と同じ形） */
function live(d: DraftWork): LiveWork {
  return {
    id: d.id, title: d.title, goal: d.goal, status: 'active',
    phases: d.plan.phases.map((p, i) => ({
      id: `${d.id}-p${i + 1}`, seq: i + 1, name: p.name, goal: p.goal,
      state: i === 0 ? 'active' : 'planned',
    })),
    // 担当は**統括AIが言った名前で引き当てる**（Supabase 版と同じ規則）。
    // 合わなければ先頭の社員に落とす
    tasks: d.plan.firstPhaseTasks.map((t, i) => {
      const hire = d.hires.find((h) => h.displayName === t.ownerHint) ?? d.hires[0];
      return {
        id: `${d.id}-t${i + 1}`, phaseId: `${d.id}-p1`, title: t.title, intent: t.intent,
        state: 'queued', progress: 0,
        owner: hire?.displayName ?? t.ownerHint,
        ownerSlug: hire?.definitionId,
        ownerId: hire ? `${d.id}-e${d.hires.indexOf(hire) + 1}` : undefined,
      };
    }),
    dels: [],
    crew: d.hires.map((h, i) => ({
      id: `${d.id}-e${i + 1}`, name: h.displayName, color: AGENT_COLOR[colorFor(h.definitionId, i)],
    })),
    startedAt: new Date().toISOString(),
  };
}

export const memoryStore: Store = {
  kind: 'memory',

  async createDraft(d) {
    const id = `w-${Date.now().toString(36)}-${++n}`;
    bag.set(id, { ...d, id, createdAt: new Date().toISOString() });
    return id;
  },
  async getDraft(id) { return bag.get(id) ?? null; },
  async listDrafts() { return [...bag.values()].reverse(); },
  async answer(id, index, answer) {
    const d = bag.get(id);
    if (!d?.questions[index]) return;
    d.questions[index] = { ...d.questions[index], answer: answer || undefined };
  },

  async approve(id) {
    const d = bag.get(id);
    if (!d) throw new AppError('not_found', `work ${id} not found`, undefined, 'その計画は見つかりませんでした');
    if (d.approved) return;                      // 二度押しは何もしない
    bag.set(id, { ...d, approved: true, live: live(d) });
  },

  async revise(id, next) {
    const d = bag.get(id);
    if (!d) throw new AppError('not_found', `work ${id} not found`, undefined, 'その計画は見つかりませんでした');
    if (d.approved) throw new AppError('unknown', `work ${id} already approved`, undefined, 'もう承認された計画は直せません');
    bag.set(id, { ...next, id, createdAt: d.createdAt });
  },

  async getWork(id) { return bag.get(id)?.live ?? null; },

  /* ══════════════ 実行（Phase 7）══════════════
   * Supabase 版と同じ順序で同じことをする。進捗も「歩みから写す」を守る
   * （live の中を直接いじるのはここだけ。画面は getWork で読み直す）。
   */

  async startRun(taskId) {
    const { live, task } = findTask(taskId);
    task.state = 'running';
    const runId = `run-${taskId}`;
    runs.set(runId, { taskId, workId: live.id, steps: [] });
    return runId;
  },

  async addStep(runId, step) {
    const r = runs.get(runId);
    if (!r) return;
    r.steps.push({ ...step, at: new Date().toISOString() });
    if (step.progress != null) {
      const { task } = findTask(r.taskId);
      if (task.state === 'running') task.progress = step.progress;
    }
  },

  async finishRun(runId, res) {
    const r = runs.get(runId);
    if (!r) return;
    const { task } = findTask(r.taskId);
    if (res.status === 'done') { task.state = 'done'; task.progress = 100; }
    else task.state = 'blocked';
  },

  async addDeliverable(d) {
    const { live } = findTask(d.taskId);
    (live.dels ??= []).unshift({
      id: `del-${live.dels.length + 1}-${d.taskId}`, title: d.title, kind: d.kind,
      state: '要確認', preview: d.body.replace(/^#.*\n/, '').slice(0, 90), body: d.body,
      by: live.tasks.find((t) => t.id === d.taskId)?.owner, when: 'たった今', taskId: d.taskId,
    });
  },

  async addNotification(n) { notes.push(n); },

  async getSteps(taskId) {
    return runs.get(`run-${taskId}`)?.steps ?? [];
  },

  async nextQueued(workId) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live || live.tasks.some((t) => t.state === 'running')) return null;
    const next = live.tasks.find((t) => t.state === 'queued');
    return next ? { taskId: next.id } : null;
  },

  async markDecision(taskId, d) {
    const { live, task } = findTask(taskId);
    task.state = 'needs_decision';
    decisions.push({
      id: `dec-${decisions.length + 1}`, workId: live.id, taskId,
      question: d.question, why: d.why,
      options: (d.options as LiveDecision['options']) ?? [], status: 'open',
    });
    notes.push({ kind: '判断待ち', body: d.question });
  },

  async getDecision(taskId) {
    return decisions.find((d) => d.taskId === taskId && d.status === 'open') ?? null;
  },

  async answerDecision(decisionId, chosen) {
    const d = decisions.find((x) => x.id === decisionId);
    if (!d || d.status !== 'open') return;
    d.status = 'decided'; d.chosen = chosen; d.when = 'たった今';
    if (d.taskId) {
      const { task } = findTask(d.taskId);
      if (task.state === 'needs_decision') task.state = 'queued';
    }
  },

  async listDecisions(workId) {
    return decisions.filter((d) => !workId || d.workId === workId).slice().reverse();
  },

  async addDecisionRefs() { /* メモリ版は台帳を持たない（本物は decision_refs） */ },

  async hireEmployee(definitionId, displayName) {
    const had = staff.find((e) => e.definitionId === definitionId && e.state !== 'retired');
    if (had) return had.id;
    const e: LiveEmployee = {
      id: `emp-${staff.length + 1}`, definitionId, name: displayName,
      color: AGENT_COLOR[colorFor(definitionId, staff.length)], state: 'idle',
      hiredAt: new Date().toISOString(),
    };
    staff.push(e);
    notes.push({ kind: '要確認', body: `${displayName} を採用しました` });
    return e.id;
  },

  async listEmployees() { return [...staff]; },

  async advancePhase(workId, nextTasks) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return null;
    const at = live.phases.find((p) => p.state === 'review');
    if (!at) return null;
    at.state = 'done';
    const next = live.phases.find((p) => p.state === 'planned');
    if (!next) { live.status = 'done'; notes.push({ kind: '要確認', body: `${live.title} が終わりました` }); return null; }
    next.state = 'active';
    const crew0 = live.crew[0];
    for (const t of nextTasks) {
      const hire = live.crew.find((c) => c.name === t.ownerHint) ?? crew0;
      live.tasks.push({
        id: `${workId}-t${live.tasks.length + 1}`, phaseId: next.id,
        title: t.title, intent: t.intent, state: 'queued', progress: 0,
        owner: hire?.name ?? t.ownerHint, ownerId: hire?.id,
      });
    }
    return next.name;
  },

  async listDels() {
    return [...bag.values()].flatMap((d) =>
      (d.live?.dels ?? []).map((x) => ({ ...x, workId: d.live!.id, workTitle: d.live!.title })));
  },

  async setDelStatus(delId, status) {
    for (const d of bag.values()) {
      const del = d.live?.dels?.find((x) => x.id === delId);
      if (del) { del.state = status === 'approved' ? '承認済' : '差し戻し'; return; }
    }
  },

  async addFixTask(workId, src, note) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return;
    const from = live.tasks.find((t) => t.id === src.taskId);
    const phaseId = from?.phaseId ?? live.phases.find((p) => p.state !== 'done')?.id ?? live.phases[0]?.id ?? '';
    live.tasks.push({
      id: `${workId}-t${live.tasks.length + 1}`, phaseId,
      title: `${src.title} を直す`, intent: `社長の指摘: ${note}`,
      state: 'queued', progress: 0,
      owner: from?.owner, ownerSlug: from?.ownerSlug, ownerId: from?.ownerId,
    });
    // フェーズが review まで来ていたら、直しのぶん戻す
    const ph = live.phases.find((p) => p.id === phaseId);
    if (ph && ph.state === 'review') ph.state = 'active';
  },

  async closePhaseIfDone(workId) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return false;
    let closed = false;
    for (const ph of live.phases) {
      if (ph.state !== 'active') continue;
      const mine = live.tasks.filter((t) => t.phaseId === ph.id);
      if (mine.length && mine.every((t) => t.state === 'done' || t.state === 'cancelled')) {
        ph.state = 'review';
        notes.push({ kind: '判断待ち', body: `フェーズ「${ph.name}」が終わりました。見て、次に進めてください` });
        closed = true;
      }
    }
    return closed;
  },
};

/** run と通知の置き場（メモリ版だけの裏方） */
const g2 = globalThis as unknown as {
  __runs?: Map<string, { taskId: string; workId: string; steps: RunStep[] }>;
  __notes?: { kind: string; body: string }[];
};
const runs = (g2.__runs ??= new Map());
const notes = (g2.__notes ??= []);
const g3 = globalThis as unknown as { __decs?: LiveDecision[]; __staff?: LiveEmployee[] };
const decisions = (g3.__decs ??= []);
const staff = (g3.__staff ??= []);

function findTask(taskId: string) {
  for (const d of bag.values()) {
    const task = d.live?.tasks.find((t) => t.id === taskId);
    if (task && d.live) return { live: d.live, task };
  }
  throw new Error(`task ${taskId} not found`);
}
