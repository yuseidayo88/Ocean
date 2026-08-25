import { AGENT_COLOR, type EmployeeColor } from '@/lib/view/model';
import { crewFor } from '@/lib/roster';
import { BUILTIN_SKILLS } from '@/lib/roster/skills';
import { AppError } from '@/lib/errors';
import type { Hire } from '@/lib/exec/types';
import { STALL_MS, type AgentPref, type ChatMsg, type ChatThread, type Discovery, type DraftWork, type LiveDecision, type LiveEmployee, type LiveWork, type Note, type Profile, type RunStep, type SkillRow, type Store } from './types';

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

/**
 * 承認したあとの姿を、控えから組み立てる（Supabase 版の SELECT と同じ形）。
 * `ids` は 定義 → 在籍の社員 id。**crew もタスクの担当も本物の在籍を指す**
 * （前は Work ごとの合成 id で、在籍（staff）と食い違っていた —
 *  学びが「書いた人」と「見る人」で別の id になる穴）。
 */
function live(d: DraftWork, ids: Map<string, string>): LiveWork {
  return {
    id: d.id, title: d.title, goal: d.goal, status: 'active',
    phases: d.plan.phases.map((p, i) => ({
      id: `${d.id}-p${i + 1}`, seq: i + 1, name: p.name, goal: p.goal,
      state: i === 0 ? 'active' : 'planned',
      weeks: p.weeks,
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
        ownerId: hire ? ids.get(hire.definitionId) : undefined,
      };
    }),
    dels: [],
    crew: d.hires.map((h, i) => ({
      id: ids.get(h.definitionId) ?? `${d.id}-e${i + 1}`,
      name: h.displayName, color: AGENT_COLOR[colorFor(h.definitionId, i)],
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
    /**
     * 採用する人を決める。**`hires` だけを見ない**（Supabase 版と同じ規則）—
     * 統括AIが空で返しても、タスクの担当名から採る（→ `lib/roster` の `crewFor`）。
     */
    const hires: Hire[] = crewFor(d.hires, d.plan.firstPhaseTasks.map((t) => t.ownerHint))
      .map((c) => {
        const src = d.hires.find((h) => h.displayName === c.displayName);
        return { ...c, why: src?.why ?? 'このフェーズのタスクの担当',
                 forPhase: src?.forPhase ?? (d.plan.phases[0]?.name ?? '') };
      });
    const withCrew = { ...d, hires };
    // 定義で引き当てて使い回す。通知は出さない
    const ids = new Map<string, string>();
    hires.forEach((h, i) => {
      let e = staff.find((x) => x.definitionId === h.definitionId && x.state !== 'retired');
      if (!e) {
        e = { id: `emp-${staff.length + 1}`, definitionId: h.definitionId, name: h.displayName,
              color: AGENT_COLOR[colorFor(h.definitionId, i)], state: 'idle',
              hiredAt: new Date().toISOString() };
        staff.push(e);
      }
      ids.set(h.definitionId, e.id);
    });
    bag.set(id, { ...withCrew, approved: true, live: live(withCrew, ids) });
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
    // supabase 側と同じ取り決め: queued を取れた者だけが走る
    if (task.state !== 'queued') throw new AppError('conflict', `task ${taskId} is not queued`);
    task.state = 'running';
    const runId = `run-${taskId}`;
    const fails = runs.get(runId)?.fails ?? 0; // 走り直しでも失敗の数は持ち越す
    runs.set(runId, { taskId, workId: live.id, steps: [], status: 'running', startedAt: new Date().toISOString(), fails });
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
    r.status = res.status;
    r.model = res.model;
    if (res.status === 'failed') r.fails = (r.fails ?? 0) + 1;
    const { task } = findTask(r.taskId);
    if (res.status === 'done') { task.state = 'done'; task.progress = 100; }
    else task.state = 'blocked';
  },

  async addDeliverable(d) {
    const { live } = findTask(d.taskId);
    live.dels ??= [];
    // 版の配線（supabase 版と同じ取り決め）: 同じ Work で同じタイトルなら新しい版。
    // メモリ版は旧版を持たない（見えるのは最新版だけ、という同じ見え方になる）
    const prevAt = live.dels.findIndex((x) => x.title === d.title);
    const version = prevAt >= 0 ? (live.dels[prevAt].version ?? 1) + 1 : 1;
    if (prevAt >= 0) live.dels.splice(prevAt, 1);
    live.dels.unshift({
      id: `del-${Date.now().toString(36)}-${d.taskId}`, title: d.title, kind: d.kind,
      state: '要確認', preview: d.body.replace(/^#.*\n/, '').slice(0, 90), body: d.body,
      by: live.tasks.find((t) => t.id === d.taskId)?.owner, when: 'たった今', taskId: d.taskId,
      version,
    });
  },

  async addNotification(n) { notes.push({ ...n, at: new Date().toISOString() }); },

  async getSteps(taskId) {
    return runs.get(`run-${taskId}`)?.steps ?? [];
  },

  async nextQueued(workId) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live || live.tasks.some((t) => t.state === 'running')) return null;
    // **止めた社員のタスクは起こさない**（supabase 版と同じ規則）
    const off = new Set([...prefs.values()].filter((p) => p.paused).map((p) => p.employeeId));
    /**
     * **担当のいないタスクは拾わない**（2026-08-25）。誰の頭も載らないまま走らせると、
     * モデルは成果物を書かずに終わり、タスクが blocked になるだけ — お金だけ減る。
     * 承認とフェーズ送りが必ず担当を埋めるので、ここは最後の砦。
     */
    const next = live.tasks.find((t) => t.state === 'queued' && t.ownerId && !off.has(t.ownerId));
    return next ? { taskId: next.id } : null;
  },

  async reclaimStalled(workId) {
    // supabase 側と同じ取り決め（メモリはサーバーごと消えるので、ほぼ形だけの双子）
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return false;
    const cutoff = Date.now() - STALL_MS;
    let freed = false;
    for (const task of live.tasks.filter((t) => t.state === 'running')) {
      const run = runs.get(`run-${task.id}`);
      if (run?.status === 'running') {
        if (new Date(run.startedAt ?? 0).getTime() >= cutoff) continue;
        run.status = 'failed';
        run.fails = (run.fails ?? 0) + 1;
        task.state = run.fails < 2 ? 'queued' : 'blocked';
      } else if (run?.status === 'done') {
        task.state = 'done'; task.progress = 100;
      } else if (run?.status === 'failed') {
        task.state = 'blocked';
      } else {
        task.state = 'queued';
      }
      if (task.state === 'blocked') {
        notes.push({ kind: 'エラー', body: `${task.title} — 実行が途中で途切れました。止めてあります` });
      }
      freed = true;
    }
    return freed;
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

  async addDecided(workId, d) {
    decisions.push({
      id: `dec-${decisions.length + 1}`, workId,
      question: d.question, why: d.why,
      options: d.options.map((o) => ({ label: o.label, description: o.description })),
      chosen: d.chosen, status: 'decided', when: new Date().toISOString(),
    });
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

  /** メモリ版は台帳を持たない。**残高があるふりをしない**（null = 上限なし） */
  async balanceCents() { return null; },
  async ledger() { return []; },
  /** デモ（メモリ）は通知の画面がダミーなので、書いても誰も読めない。正直に何もしない */
  /* ══════════════ ゼロ状態（画面はぜんぶここを読む）══════════════ */

  async listWorks() {
    return [...bag.values()].filter((d) => d.live).map((d) => d.live!);
  },

  async listNotes() {
    // 新しい順。id は配列の位置（配列は増えるだけなので安定）
    return notes.map((n, i): Note => ({
      id: `n-${i}`, kind: n.kind, body: n.body, at: n.at,
      read: notesRead.has(i), subjectType: n.subjectType, subjectId: n.subjectId,
    })).reverse();
  },

  async readNote(id) {
    const i = Number(id.replace('n-', ''));
    if (Number.isInteger(i)) notesRead.add(i);
  },

  async listThreads() { return [...threads].reverse(); },

  async getThread(id) {
    const thread = threads.find((t) => t.id === id);
    return thread ? { thread, messages: msgs.get(id) ?? [] } : null;
  },

  async addChat(threadId, role, body, title, card) {
    let id = threadId;
    if (!id || !threads.some((t) => t.id === id)) {
      id = `t-${threads.length + 1}`;
      threads.push({ id, title: (title ?? body).slice(0, 16), lastAt: new Date().toISOString() });
    }
    const list = msgs.get(id) ?? [];
    list.push({ role, body, at: new Date().toISOString(), card });
    msgs.set(id, list);
    const th = threads.find((t) => t.id === id);
    if (th) th.lastAt = new Date().toISOString();
    return id;
  },

  async threadForWork(workId) {
    const had = threads.find((t) => t.workId === workId);
    if (had) return had.id;
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    const id = `t-${threads.length + 1}`;
    threads.push({ id, title: (live?.title ?? 'Work の相談').slice(0, 16), workId,
                   lastAt: new Date().toISOString() });
    return id;
  },

  async linkThread(threadId, patch) {
    const th = threads.find((t) => t.id === threadId);
    if (!th) return false;
    // **workId は一度きり。** 1チャット=1Work は、ここが最後の砦
    if (patch.workId) {
      if (th.workId) return false;
      th.workId = patch.workId;
    }
    if (patch.discoveryId) th.discoveryId = patch.discoveryId;
    if (patch.profileId) th.profileId = patch.profileId;
    return true;
  },

  async listSkills() {
    // 1枚も無ければ標準スキルを播く（元々の機能。どの会社にも最初からある）
    if (skills.length === 0) {
      for (const b of BUILTIN_SKILLS) {
        skills.push({ id: `sk-${skills.length + 1}`, name: b.name, filename: b.filename,
                      on: true, scope: 'company', used: 0, source: 'builtin', body: b.body });
      }
    }
    return [...skills];
  },

  async setSkill(id, on) {
    const sk = skills.find((x) => x.id === id);
    if (sk) sk.on = on;
  },

  async addSkill(x) {
    skills.push({ id: `sk-${skills.length + 1}`, name: x.name, filename: x.filename,
                  on: true, scope: 'company', used: 0, source: 'user', body: x.body });
  },

  async removeSkill(id) {
    const i = skills.findIndex((x) => x.id === id && x.source === 'user');
    if (i >= 0) skills.splice(i, 1);
  },

  async bumpSkillUse(ids) {
    for (const sk of skills) if (ids.includes(sk.id)) sk.used += 1;
  },

  /* ══════════════ 学び ══════════════ */

  /* ══════════════ モデルと深さ ══════════════ */

  async listPrefs() {
    return [...prefs.values()].map((p) => ({ ...p }));
  },

  async prefOf(employeeId) {
    const p = prefs.get(employeeId ?? EXEC_PREF);
    return p ? { ...p } : null;
  },

  async setPref(employeeId, patch) {
    const key = employeeId ?? EXEC_PREF;
    const cur = prefs.get(key) ?? { employeeId };
    // **渡した項目だけ書き換える**（モデルを選んでも深さが消えない）
    prefs.set(key, {
      employeeId,
      model: patch.model ?? cur.model,
      effort: patch.effort ?? cur.effort,
      paused: patch.paused ?? cur.paused,
    });
  },

  async learnings(employeeId) {
    return [...(learned.get(employeeId) ?? [])];
  },

  async addLearnings(employeeId, lines) {
    const cur = learned.get(employeeId) ?? [];
    // **同じ学びを二度書かない。** 社員は似た仕事で同じことに気づくので、
    // 放っておくと30行が同じ1行で埋まり、次の実行に渡せる中身が減る
    const add = lines.map((l) => l.trim()).filter((l) => l && !cur.includes(l));
    if (!add.length) return;
    learned.set(employeeId, [...cur, ...add].slice(-30)); // 上限30行。あふれたら古いものから
  },

  async setLearnings(employeeId, lines) {
    const next = lines.map((l) => l.trim()).filter(Boolean);
    if (next.length) learned.set(employeeId, next);
    else learned.delete(employeeId);
  },

  async companyName() { return 'あなたの会社'; },

  async recentSteps(limit) {
    const out: { at?: string; who: string; what: string }[] = [];
    for (const r of runs.values()) {
      const owner = (() => { try { return findTask(r.taskId).task.owner; } catch { return undefined; } })();
      for (const st of r.steps) {
        if (st.summary) out.push({ at: st.at, who: owner ?? 'AI社員', what: st.summary });
      }
    }
    out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    return out.slice(0, limit);
  },

  /**
   * 朝の報告（メモリ版）。通知の画面が本物になったので、こちらも本当に書く。
   * サーバーごと消える環境なので「その日」の重複止めはプロセス内の Set で足りる。
   */
  async morningBrief(day) {
    const today = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
    if (morningDays.has(today)) return false;

    const since = Date.now() - 24 * 3600 * 1000;
    const ran = [...runs.values()].filter((r) => r.status === 'done' &&
      new Date(r.startedAt ?? 0).getTime() >= since).length;
    const lives = [...bag.values()].map((d) => d.live).filter(Boolean) as LiveWork[];
    const del = lives.flatMap((w) => w.dels ?? []).filter((x) => x.state === '要確認').length;
    const open = decisions.filter((x) => x.status === 'open').length;
    const stop = lives.filter((w) => w.status === 'paused').length;
    if (ran + del + open + stop === 0) return false; // 動きが無かった朝は黙る

    const parts: string[] = [];
    if (ran) parts.push(`きのうから実行が ${ran}件 終わりました`);
    if (del) parts.push(`見てほしい成果物が ${del}件`);
    if (open) parts.push(`判断待ちが ${open}件`);
    if (stop) parts.push(`止まっている Work が ${stop}件`);
    morningDays.add(today);
    notes.push({
      kind: open ? '判断待ち' : del || ran ? '要確認' : 'エラー',
      body: `朝の報告 — ${parts.join('、')}`, at: new Date().toISOString(),
    });
    return true;
  },

  async pauseWork(workId, why) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (live) live.status = 'paused';
    notes.push({ kind: 'エラー', body: why });
  },

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
        // **定義も渡す**（supabase 版と同じ）。無いと社員の頭が載らず、素の返事になる
        ownerSlug: staff.find((x) => x.id === hire?.id)?.definitionId,
      });
    }
    return next.name;
  },

  async listDels() {
    // **新しい順**（types.ts の契約）。Supabase は created_at desc で返すので、双子も同じ順で返す
    return [...bag.values()]
      .flatMap((d) => (d.live?.dels ?? []).map((x) => ({ ...x, workId: d.live!.id, workTitle: d.live!.title })))
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  },

  async setDelStatus(delId, status) {
    for (const d of bag.values()) {
      const del = d.live?.dels?.find((x) => x.id === delId);
      if (del) {
        if (del.state !== '要確認') return false; // review のものだけ動く（二度押しは何もしない）
        del.state = status === 'approved' ? '承認済' : '差し戻し';
        return true;
      }
    }
    return false;
  },

  async addFixTask(workId, src, note) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return;
    const from = live.tasks.find((t) => t.id === src.taskId);
    const phaseId = from?.phaseId ?? live.phases.find((p) => p.state !== 'done')?.id ?? live.phases[0]?.id ?? '';
    /**
     * **担当のいない直しタスクを作らない。** 元のタスクが辿れないときは
     * 先頭の社員に落とす（承認・フェーズ送りと同じ規則）。
     * 前はここが空のまま生まれ、誰の頭も載らずに走っていた。
     */
    const crew0 = live.crew[0];
    const back = from ?? live.tasks.find((t) => t.ownerId);
    live.tasks.push({
      id: `${workId}-t${live.tasks.length + 1}`, phaseId,
      title: `${src.title} を直す`, intent: `社長の指摘: ${note}`,
      state: 'queued', progress: 0,
      owner: back?.owner ?? crew0?.name,
      ownerSlug: back?.ownerSlug ?? staff.find((x) => x.id === crew0?.id)?.definitionId,
      ownerId: back?.ownerId ?? crew0?.id,
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

  /* ══════════════ 入口（Case B / D）══════════════ */

  async createDiscovery() {
    const id = `ds-${Date.now().toString(36)}-${++n}`;
    disc.set(id, {
      id, status: 'collecting',
      conditions: { interests: [], strengths: [], avoid: [] },
      candidates: [], past: [], seq: 0, real: true,
    });
    return id;
  },

  async getDiscovery(id) {
    const d = disc.get(id);
    if (!d) return null;
    return {
      id: d.id, status: d.status, real: d.real,
      conditions: { ...d.conditions, interests: [...d.conditions.interests],
                    strengths: [...d.conditions.strengths], avoid: [...d.conditions.avoid] },
      candidates: sortCands(d.candidates).map((c) => ({ ...c })),
    };
  },

  async setConditions(id, c, real) {
    const d = disc.get(id);
    if (!d) return;
    d.conditions = c;
    d.real = real;
  },

  async setCandidates(id, cands) {
    const d = disc.get(id);
    if (!d) return;
    // 出し直しでも前の束は消さない（不変条件 9）。画面が読むのは最新の束だけ
    d.past.push(...d.candidates);
    d.candidates = cands.map((c) => ({ ...c, id: `${id}-c${++d.seq}` }));
    d.status = 'proposed';
  },

  async adoptCandidate(sessionId, candidateId, workId) {
    const d = disc.get(sessionId);
    if (!d) return;
    const c = d.candidates.find((x) => x.id === candidateId);
    if (c) c.adoptedWorkId = workId;
    d.status = 'adopted';
  },

  async createProfile(name) {
    const id = `bp-${Date.now().toString(36)}-${++n}`;
    profiles.set(id, { id, name, sources: [], seq: 0 });
    return id;
  },

  async getProfile(id) {
    const p = profiles.get(id);
    if (!p) return null;
    return {
      id: p.id, name: p.name, url: p.url, stage: p.stage,
      sources: p.sources.map((s) => ({ ...s })),
      diagnosis: p.diagnosis
        ? { facts: p.diagnosis.facts.map((f) => ({ ...f })),
            findings: p.diagnosis.findings.map((f) => ({ ...f, evidence: [...f.evidence], work: { ...f.work } })),
            real: p.diagnosis.real, at: p.diagnosis.at }
        : undefined,
    };
  },

  async addSource(profileId, s) {
    const p = profiles.get(profileId);
    if (!p) throw new AppError('not_found', `profile ${profileId} not found`, undefined, 'その取り込みは見つかりませんでした');
    const id = `${profileId}-s${++p.seq}`;
    p.sources.push({ id, kind: s.kind, locator: s.locator, summary: s.summary, status: s.status });
    return id;
  },

  async setProfileMeta(id, m) {
    const p = profiles.get(id);
    if (!p) return;
    if (m.name) p.name = m.name;
    if (m.stage) p.stage = m.stage;
  },

  async saveDiagnosis(profileId, d) {
    const p = profiles.get(profileId);
    if (!p) return;
    p.diagnosis = { facts: d.facts, findings: d.findings, real: d.real, at: new Date().toISOString() };
  },

  async linkFinding(profileId, index, workId) {
    const f = profiles.get(profileId)?.diagnosis?.findings[index];
    if (!f) return false;
    if (f.workId) return false; // もう立っている（二度目は立てない）
    f.workId = workId;
    return true;
  },
};

/** run と通知の置き場（メモリ版だけの裏方） */
const g2 = globalThis as unknown as {
  __runs?: Map<string, { taskId: string; workId: string; steps: RunStep[];
    status?: 'running' | 'done' | 'failed'; startedAt?: string; fails?: number; model?: string }>;
  __notes?: { kind: string; body: string; at?: string; subjectType?: string; subjectId?: string }[];
  __notesRead?: Set<number>;
  __threads?: ChatThread[];
  __msgs?: Map<string, ChatMsg[]>;
  __skills?: SkillRow[];
  __learned?: Map<string, string[]>;
  __prefs?: Map<string, AgentPref>;
  __morning?: Set<string>;
};
const runs = (g2.__runs ??= new Map());
const notes = (g2.__notes ??= []);
const notesRead = (g2.__notesRead ??= new Set<number>());
const threads = (g2.__threads ??= []);
const msgs = (g2.__msgs ??= new Map<string, ChatMsg[]>());
const skills = (g2.__skills ??= []);
const learned = (g2.__learned ??= new Map<string, string[]>());
/** 統括AI（employee_id が null）の置き場。Map の鍵に null は使えないので名前を1つ決める */
const EXEC_PREF = '__exec__';
const prefs = (g2.__prefs ??= new Map<string, AgentPref>());
const morningDays = (g2.__morning ??= new Set<string>());
const g3 = globalThis as unknown as { __decs?: LiveDecision[]; __staff?: LiveEmployee[] };
const decisions = (g3.__decs ??= []);
const staff = (g3.__staff ??= []);

/**
 * 入口（Case B / D）の置き場。
 * past — 出し直す前の候補の束。**候補は消さない**（不変条件 9）を双子でも守る。
 * 画面が読むのは最新の束（candidates）だけ、というのも Supabase 版と同じ。
 */
type DiscRow = Discovery & { past: Discovery['candidates']; seq: number };
type ProfRow = Profile & { seq: number };
const g4 = globalThis as unknown as { __disc?: Map<string, DiscRow>; __profiles?: Map<string, ProfRow> };
const disc = (g4.__disc ??= new Map<string, DiscRow>());
const profiles = (g4.__profiles ??= new Map<string, ProfRow>());

/** 候補の並びは双子で同じに — 推し → 相性の高い順 → 名前（挿入順に頼らない） */
export const sortCands = <T extends { recommended: boolean; fit: { strength: number }; name: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) =>
    Number(b.recommended) - Number(a.recommended)
    || b.fit.strength - a.fit.strength
    || a.name.localeCompare(b.name, 'ja'));

function findTask(taskId: string) {
  for (const d of bag.values()) {
    const task = d.live?.tasks.find((t) => t.id === taskId);
    if (task && d.live) return { live: d.live, task };
  }
  throw new Error(`task ${taskId} not found`);
}
