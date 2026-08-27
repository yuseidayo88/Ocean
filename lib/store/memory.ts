import { AGENT_COLOR, type EmployeeColor } from '@/lib/view/model';
import { byName as rosterByName, crewFor } from '@/lib/roster';
import { finishNote, finishSay, gateNote, paceSay, type Finished } from '@/lib/exec/finish';
import type { McpServer } from '@/lib/mcp/types';
import { previewFor } from '@/lib/deliver/format';
import { BUILTIN_SKILLS } from '@/lib/roster/skills';
import { AppError } from '@/lib/errors';
import type { Hire } from '@/lib/exec/types';
import { STALL_MS, type AgentPref, type ChatMsg, type ChatThread, type Discovery, type DraftWork, type LiveDecision, type LiveEmployee, type LiveWork, type Memo, type Note, type PendingSkill, type Profile, type RunStep, type SkillRow, type Store } from './types';

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
      // **社長が承認した担当**（次のフェーズを引く統括AIに渡すため）
      owner: p.owner || undefined,
      // **計画の ◆**（このフェーズの終わりに社長が決めること）。supabase 版と同じ引き方
      gate: d.plan.gates.find((g) => g.afterPhase === p.name)?.question,
      // 見込みと突き合わせるために、始まった時刻を持つ（supabase の `phases.started_at`）
      startedAt: i === 0 ? new Date().toISOString() : undefined,
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

/**
 * **承認前の Work の、形だけ**（2026-08-26）。
 *
 * supabase 版は控えを書いた時点でフェーズとタスクまで作るので、承認前の Work も
 * `listWorks` / `getWork` にふつうに出てくる。メモリ版は `live` を承認まで作らないので、
 * **双子が違うものを返していた** — レールの「Work」が `/start` に落ち、
 * Work の画面は 404 になっていた。
 *
 * 中身はまだ無いので、**無いまま返す**（題・ゴール・状態だけ）。
 * 画面はこれで「まだ始まっていません。計画を見る」の帯を出せる。
 */
const shell = (d: DraftWork): LiveWork => ({
  id: d.id, title: d.title, goal: d.goal, status: 'plan_review',
  phases: [], tasks: [], crew: [], dels: [],
});

export const memoryStore: Store = {
  kind: 'memory',

  async createDraft(d) {
    const id = `w-${Date.now().toString(36)}-${++n}`;
    bag.set(id, { ...d, id, createdAt: new Date().toISOString() });
    return id;
  },
  async getDraft(id) { return bag.get(id) ?? null; },
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
     * 統括AIが空で返しても、タスクの担当名と**フェーズの担当**から採る
     * （→ `lib/roster` の `crewFor`）。社長の「まず必要な社員全員採用して」は、
     * `hires` が空で返った計画でも守られないといけない。
     */
    const hires: Hire[] = crewFor(d.hires, [
      ...d.plan.firstPhaseTasks.map((t) => t.ownerHint),
      ...d.plan.phases.map((ph) => ph.owner),
    ])
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

  async getWork(id) {
    const row = bag.get(id);
    // **承認前でも 404 にしない**（supabase 版はフェーズを先に作るので画面が出る）。
    // 出るのは題とゴールと状態だけ — Work の画面が「計画を見る」の帯を出せればいい
    if (row && !row.live) return shell(row);
    const live = row?.live ?? null;
    if (!live) return null;
    // **決めたことも一緒に返す**（supabase 版と同じ約束）。右ペインの節が空のままだった
    return {
      ...live,
      decs: decisions.filter((d) => d.workId === id && d.status === 'decided' && d.chosen)
        .slice().reverse().slice(0, 6)
        .map((d) => ({ question: d.question, chosen: d.chosen!, when: d.when })),
      // **いま聞いている ◆**（フェーズの関門。タスクに紐づかないもの）
      openDec: decisions.find((d) => d.workId === id && d.status === 'open' && !d.taskId),
    };
  },

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
    r.error = res.error;
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
    const id = `del-${Date.now().toString(36)}-${d.taskId}`;
    live.dels.unshift({
      id, title: d.title, kind: d.kind,
      state: '要確認',
      // 書き出しは形ごとに違うところから（supabase 版と同じ規則）
      preview: previewFor(d.kind, d.body), body: d.body,
      by: live.tasks.find((t) => t.id === d.taskId)?.owner, when: new Date().toISOString(), taskId: d.taskId,
      version,
      /**
       * **画像はここに持つ**（2026-08-27）。本番は Supabase Storage に置いて
       * 署名つきURLを作るが、デモは器の中しか無いので data URI をそのまま持つ。
       * **画面はどちらかを知らなくていい** — `src` に入っていればそのまま `<img>` に渡す。
       */
      src: d.image ? `data:${d.image.mime};base64,${d.image.base64}` : undefined,
    });
    return id;
  },

  async addNotification(n) { notes.push({ ...n, at: new Date().toISOString() }); },

  async getSteps(taskId) {
    return runs.get(`run-${taskId}`)?.steps ?? [];
  },

  /**
   * **止まったタスクから戻る**（→ `lib/store/types.ts` の同じ名前）。
   * 双子なので supabase 版とまったく同じ取り決め — 動くのは止まっているものだけ。
   */
  async retryTask(taskId) {
    const { task } = findTask(taskId);
    if (task.state !== 'blocked' && task.state !== 'failed') return false;
    task.state = 'queued';
    // 進捗には触れない（supabase 版と同じ — あちらは引き金しか書けない）
    // **社長が押した走り直しは、数え直しから**（`reclaimStalled` の「二度目は止める」に引っかからない）
    const r = runs.get(`run-${taskId}`);
    if (r) { r.fails = 0; r.error = undefined; }
    return true;
  },

  async skipTask(taskId) {
    const { task } = findTask(taskId);
    if (task.state !== 'blocked' && task.state !== 'failed') return false;
    task.state = 'cancelled';
    return true;
  },

  async taskWhy(taskId) {
    return runs.get(`run-${taskId}`)?.error ?? '';
  },

  async nextQueued(workId) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return [];
    // **いま走っている人は飛ばす**（supabase 版と同じ規則）。同じ社員に2本やらせない
    const busy = new Set(live.tasks.filter((t) => t.state === 'running').map((t) => t.ownerId));
    // **止めた社員のタスクは起こさない**（supabase 版と同じ規則）
    const off = new Set([...prefs.values()].filter((p) => p.paused).map((p) => p.employeeId));
    /**
     * **担当のいないタスクは拾わない**（2026-08-25）。誰の頭も載らないまま走らせると、
     * モデルは成果物を書かずに終わり、タスクが blocked になるだけ — お金だけ減る。
     * 承認とフェーズ送りが必ず担当を埋めるので、ここは最後の砦。
     */
    // **束の中でも1人1本**（supabase 版と同じ規則）
    const taken = new Set(busy);
    const out: { taskId: string }[] = [];
    for (const t of live.tasks) {
      if (t.state !== 'queued' || !t.ownerId) continue;
      if (off.has(t.ownerId) || taken.has(t.ownerId)) continue;
      taken.add(t.ownerId);
      out.push({ taskId: t.id });
    }
    return out;
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

  /**
   * **計画の ◆ を、本物の判断にする**（supabase 版と同じ規則）。
   * タスクには紐づかない（フェーズの関門なので Work のもの）。
   */
  async addGateDecision(workId, d) {
    if (decisions.some((x) => x.workId === workId && x.status === 'open')) return false;
    decisions.push({
      id: `dec-${decisions.length + 1}`, workId,
      question: d.question, why: d.why,
      options: d.options, status: 'open',
    });
    notes.push({ kind: '判断待ち', body: d.question });
    return true;
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
    d.status = 'decided'; d.chosen = chosen; d.when = new Date().toISOString();
    if (d.taskId) {
      const { task } = findTask(d.taskId);
      if (task.state === 'needs_decision') task.state = 'queued';
    }
  },

  async listDecisions(workId) {
    // Work の名前を添える（supabase 版と同じ約束）。台帳は会社ぜんぶを1本に並べる
    // **承認前の Work にも題はある**（live はまだ無いので draft の側から取る）
    const title = new Map([...bag.entries()].map(([k, d]) => [k, d.live?.title ?? d.title ?? '']));
    return decisions.filter((d) => !workId || d.workId === workId).slice().reverse()
      .map((d) => ({ ...d, workTitle: title.get(d.workId) || undefined }));
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
  async setWorkPaused(workId, paused) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live || live.status !== (paused ? 'active' : 'paused')) return false;
    live.status = paused ? 'paused' : 'active';
    return true;
  },

  /** 台帳が無いので数えようがない。**0 と言わない**（使っていない、ではなく、数えていない） */
  async spentSinceCents() { return null; },

  async noticeOnce(key, kind, body) {
    if (onceKeys.has(key)) return false;
    onceKeys.add(key);
    notes.push({ kind, body });
    return true;
  },

  async noticed(key) { return onceKeys.has(key); },

  async activeWorks() {
    return [...bag.values()].filter((d) => d.live?.status === 'active').map((d) => d.live!.id);
  },
  /** デモ（メモリ）は通知の画面がダミーなので、書いても誰も読めない。正直に何もしない */
  /* ══════════════ ゼロ状態（画面はぜんぶここを読む）══════════════ */

  async listWorks() {
    /**
     * **承認前の Work も返す**（2026-08-26。supabase 版と同じ）。
     *
     * あちらは `works` を status で絞らずに返すので、`plan_review` の Work も並ぶ。
     * こちらは `live` があるものだけ返していたので、**双子が違うものを返していた** —
     * レールの「Work」を押すと、計画を立てた直後なのに `/start` に落ちていた。
     *
     * 承認前はフェーズもタスクもまだ無いので、**計画の控えから形だけ作る**
     * （画面が読むのは題とゴールと状態だけ。無いものは無いまま）。
     */
    return [...bag.values()].map((d) => d.live ?? shell(d));
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
                      on: true, scope: 'company', used: 0, source: 'builtin',
                      status: 'active', desc: b.description, body: b.body });
      }
    }
    return [...skills];
  },

  async setSkill(id, on) {
    const sk = skills.find((x) => x.id === id);
    if (!sk) return;
    sk.on = on;
    // 社長が有効にしたら、落ちていたものも会社のものになる（supabase 版と同じ規則）
    if (on && sk.status === 'rejected') { sk.status = 'active'; sk.note = undefined; }
  },

  async addSkill(x) {
    skills.push({ id: `sk-${skills.length + 1}`, name: x.name, filename: x.filename,
                  on: true, scope: 'company', used: 0, source: 'user', status: 'active', body: x.body });
  },

  async removeSkill(id) {
    // supabase 版と同じ規則 — 標準スキルは切れるが消せない。社員が書いたものは消せる
    const i = skills.findIndex((x) => x.id === id && (x.source === 'user' || x.source === 'agent'));
    if (i >= 0) skills.splice(i, 1);
  },

  async editSkill(id, body) {
    // 直せる範囲は消せる範囲と同じ（supabase 版と同じ規則）
    const sk = skills.find((x) => x.id === id && (x.source === 'user' || x.source === 'agent'));
    if (!sk) return false;
    sk.body = body;
    return true;
  },

  async bumpSkillUse(ids) {
    for (const sk of skills) if (ids.includes(sk.id)) sk.used += 1;
  },

  /* ══════════════ 社長のこと（supabase 版と同じ規則）══════════════ */

  async founderNotes() {
    return [...(learned.get(FOUNDER) ?? [])];
  },

  async addFounderNotes(lines) {
    const cur = learned.get(FOUNDER) ?? [];
    const add = lines.map((l) => l.trim()).filter((l) => l && !cur.includes(l));
    if (!add.length) return;
    learned.set(FOUNDER, [...cur, ...add].slice(-20));
  },

  async setFounderNotes(lines) {
    const next = lines.map((l) => l.trim()).filter(Boolean);
    if (next.length) learned.set(FOUNDER, next);
    else learned.delete(FOUNDER);
  },

  /* ══════════════ 思い出す（supabase 版と同じ規則。探す先も同じ3つ）══════════════ */

  async recall(terms, limit = 3) {
    if (!terms.length) return [];
    const hit = (s2: string) => terms.some((t) => s2.includes(t));
    const out: Memo[] = [];
    const dels = [...bag.values()]
      .flatMap((d) => d.live?.dels ?? [])
      .filter((d) => d.state !== '差し戻し' && hit(`${d.title} ${d.body ?? ''}`))
      .slice(0, limit);
    for (const d of dels) out.push({ kind: '成果物', title: d.title, snippet: (d.body ?? '').slice(0, 1200) });
    for (const d of decisions.filter((x) => x.status === 'decided' && hit(x.question)).slice(0, limit)) {
      out.push({ kind: '決めたこと', title: d.question, snippet: d.chosen ?? '' });
    }
    for (const [, list] of msgs) {
      for (const m of list) {
        if (m.role !== 'user' || !hit(m.body)) continue;
        out.push({ kind: '会話', title: '社長の言葉', snippet: m.body.slice(0, 400) });
      }
    }
    return out.slice(0, limit * 2);
  },

  /* ══════════════ 社員が自分でスキルを書く（Hermes の輪。supabase 版と同じ規則）══════════════ */

  async writeSkill(x) {
    // 同じ filename がもうあるなら書かない（0017 の一意 index と同じ）
    if (skills.some((k) => k.filename === x.filename && (k.employeeId ?? null) === x.employeeId)) return null;
    const id = `sk-${skills.length + 1}`;
    skills.push({
      id, name: x.name, filename: x.filename, desc: x.desc, body: x.body,
      on: true, scope: x.employeeId ? 'employee' : 'company', employeeId: x.employeeId,
      used: 0, source: 'agent', status: 'draft', author: x.authorId ?? null, revision: 0,
    });
    return id;
  },

  async proposeSkillEdit(id, body, why, authorId) {
    const sk = skills.find((x) => x.id === id);
    if (!sk) return;
    edits.set(id, { body, why });
    sk.pending = true;
    if (authorId) sk.author = authorId;
  },

  async pendingSkills() {
    const out: PendingSkill[] = [];
    for (const sk of skills) {
      const who = staff.find((e) => e.id === sk.author)?.name;
      if (sk.status === 'draft') {
        out.push({ id: sk.id, name: sk.name, desc: sk.desc, kind: 'new', body: sk.body ?? '', authorName: who });
        continue;
      }
      const e = edits.get(sk.id);
      if (e) out.push({ id: sk.id, name: sk.name, desc: sk.desc, kind: 'edit', body: e.body, live: sk.body, why: e.why, authorName: who });
    }
    return out;
  },

  async reviewSkill(id, ok, note) {
    const sk = skills.find((x) => x.id === id);
    if (!sk) return;
    if (sk.status === 'draft') {
      sk.status = ok ? 'active' : 'rejected';
      sk.note = ok ? undefined : (note || undefined);
      return;
    }
    // 直しは、落としても行に印を残さない（supabase 版と同じ規則）
    const e = edits.get(id);
    edits.delete(id);
    sk.pending = false;
    if (ok && e) { sk.body = e.body; sk.revision = (sk.revision ?? 0) + 1; }
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
      web: patch.web ?? cur.web,
      images: patch.images ?? cur.images,
      imageModel: patch.imageModel ?? cur.imageModel,
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

  /* ── ルール（学びからの昇格先。supabase 版と同じ規則）── */

  async rules(employeeId) { return [...(ruled.get(employeeId) ?? [])]; },

  async setRules(employeeId, lines) {
    const next = lines.map((l) => l.trim()).filter(Boolean);
    if (next.length) ruled.set(employeeId, next);
    else ruled.delete(employeeId);
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
    // 止まったタスク（supabase 版と同じ規則。1つ残るとフェーズは閉じない）
    const dead = lives.flatMap((w) => w.tasks)
      .filter((t) => t.state === 'blocked' || t.state === 'failed').length;
    if (ran + del + open + stop + dead === 0) return false; // 動きが無かった朝は黙る

    const parts: string[] = [];
    if (ran) parts.push(`きのうから実行が ${ran}件 終わりました`);
    if (dead) parts.push(`止まっているタスクが ${dead}件`);
    if (del) parts.push(`見てほしい成果物が ${del}件`);
    if (open) parts.push(`判断待ちが ${open}件`);
    if (stop) parts.push(`止まっている Work が ${stop}件`);
    morningDays.add(today);
    notes.push({
      kind: dead ? 'エラー' : open ? '判断待ち' : del || ran ? '要確認' : 'エラー',
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
    if (!next) {
      // **終わりこそ、いちばん言うべきところ**（supabase 版と同じ文・同じ場所）
      live.status = 'done';
      // メモリ版は旧版を持たない（最新版しか配列に無い）ので、そのまま数える
      const shown = live.dels ?? [];
      const f: Finished = {
        title: live.title,
        dels: shown.map((d) => d.title),
        unseen: shown.filter((d) => d.state === '要確認').length,
        decisions: decisions
          .filter((d) => d.workId === workId && d.status === 'decided' && d.chosen)
          .map((d) => ({ question: d.question, chosen: d.chosen! })),
      };
      notes.push({ kind: '要確認', body: finishNote(f) });
      const th = await memoryStore.threadForWork(workId).catch(() => null);
      if (th) await memoryStore.addChat(th, 'executive', finishSay(f)).catch(() => {});
      return null;
    }
    next.state = 'active';
    next.startedAt = new Date().toISOString();
    /**
     * **要る人がいなければ、ここで採用する**（supabase 版と同じ規則）。
     * 計画で提案されるのは最初のフェーズの担当だけなので、
     * 前はフェーズ3以降のタスクが**全部 先頭の社員**に落ちていた。
     */
    for (const name of new Set(nextTasks.map((t) => t.ownerHint).filter(Boolean) as string[])) {
      if (live.crew.some((c) => c.name === name)) continue;
      const def = rosterByName(name);
      if (!def) continue;
      const id = await memoryStore.hireEmployee(def.slug, def.name);
      const em = staff.find((x) => x.id === id);
      if (em) live.crew.push({ id: em.id, name: em.name, color: em.color });
    }
    const crew0 = live.crew[0];
    for (const t of nextTasks) {
      const hire = live.crew.find((c) => c.name === t.ownerHint) ?? crew0;
      const id = `${workId}-t${live.tasks.length + 1}`;
      live.tasks.push({
        id, phaseId: next.id,
        title: t.title, intent: t.intent, state: 'queued', progress: 0,
        owner: hire?.name ?? t.ownerHint, ownerId: hire?.id,
        // **定義も渡す**（supabase 版と同じ）。無いと社員の頭が載らず、素の返事になる
        ownerSlug: staff.find((x) => x.id === hire?.id)?.definitionId,
      });
      /**
       * **統括AIが「社長にしか決められない」と言ったタスクは、そこで待つ**
       * （supabase 版と同じ規則）。ほかのタスクは queued のまま動き出す。
       */
      if (t.ask) await memoryStore.markDecision(id, t.ask).catch(() => {});
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

  async closePhaseIfDone(workId, gates = []) {
    const live = [...bag.values()].find((d) => d.live?.id === workId)?.live;
    if (!live) return { closed: [], hold: false, ready: false, at: null };
    /** そのフェーズに、社長がまだ見ていない成果物が何件あるか（supabase 版と同じ数え方） */
    const phaseOf = new Map(live.tasks.map((t) => [t.id, t.phaseId]));
    const waiting = new Map<string, number>();
    for (const d of live.dels ?? []) {
      if (d.state !== '要確認') continue;
      const pid = d.taskId ? phaseOf.get(d.taskId) : undefined;
      if (pid) waiting.set(pid, (waiting.get(pid) ?? 0) + 1);
    }

    const closed: string[] = [];
    for (const ph of live.phases) {
      if (ph.state !== 'active') continue;
      const mine = live.tasks.filter((t) => t.phaseId === ph.id);
      if (!mine.length || !mine.every((t) => t.state === 'done' || t.state === 'cancelled')) continue;
      ph.state = 'review';
      closed.push(ph.name);
      // 見込みと実際を、閉じたその場で突き合わせる（supabase 版と同じ規則）
      const pace = paceSay(ph.weeks, ph.startedAt, new Date().toISOString());
      notes.push(gateNote(ph.name, gates.includes(ph.name), waiting.get(ph.id) ?? 0, pace));
    }

    const review = live.phases.filter((p) => p.state === 'review');
    const hold = review.some((p) => gates.includes(p.name) || (waiting.get(p.id) ?? 0) > 0);
    return { closed, hold, ready: review.length > 0 && !hold, at: review[0]?.name ?? null };
  },

  async planGates(workId) {
    const d = [...bag.values()].find((x) => x.live?.id === workId || x.id === workId);
    return (d?.plan?.gates ?? [])
      .filter((g) => g.afterPhase)
      .map((g) => ({ afterPhase: g.afterPhase, question: g.question || g.afterPhase }));
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

  /* ══════════════ つないだ道具（MCP・Phase 12）══════════════
   * Supabase 版と同じ順序で同じことをする。**同じ行き先は二度つながない**も同じ。
   */

  async listMcpServers() {
    return [...mcps.values()].map(({ token, ...rest }) => ({ ...rest, hasToken: !!token }));
  },

  async addMcpServer(x) {
    const had = [...mcps.values()].find((m) => m.url === x.url);
    if (had) {
      Object.assign(had, { name: x.name, token: x.token,
                           checkedAt: undefined, toolCount: undefined, lastError: undefined });
      return had.id;
    }
    const id = `mcp-${Date.now().toString(36)}-${++n}`;
    mcps.set(id, { id, name: x.name, url: x.url, token: x.token, write: false, on: true });
    return id;
  },

  async setMcpServer(id, patch) {
    const m = mcps.get(id);
    if (!m) return;
    if (patch.on !== undefined) m.on = patch.on;
    if (patch.write !== undefined) m.write = patch.write;
    if (patch.name !== undefined) m.name = patch.name;
  },

  async removeMcpServer(id) { mcps.delete(id); },

  async noteMcpCheck(id, r) {
    const m = mcps.get(id);
    if (!m) return;
    m.checkedAt = new Date().toISOString();
    m.toolCount = r.error ? undefined : (r.tools ?? 0);
    m.lastError = r.error;
  },

  async mcpSecret(id) { return mcps.get(id)?.token; },
};

/** run と通知の置き場（メモリ版だけの裏方） */
const g2 = globalThis as unknown as {
  __runs?: Map<string, { taskId: string; workId: string; steps: RunStep[];
    status?: 'running' | 'done' | 'failed'; startedAt?: string; fails?: number; model?: string;
    /** 止まった理由（`taskWhy` が読む。supabase 版の `runs.error` と同じもの） */
    error?: string }>;
  __notes?: { kind: string; body: string; at?: string; subjectType?: string; subjectId?: string }[];
  __notesRead?: Set<number>;
  __onceKeys?: Set<string>;
  __threads?: ChatThread[];
  __msgs?: Map<string, ChatMsg[]>;
  __skills?: SkillRow[];
  /** 直しの提案（supabase の `draft_body` / `draft_note` にあたる） */
  __skillEdits?: Map<string, { body: string; why: string }>;
  __learned?: Map<string, string[]>;
  /** 昇格したルール（`agent_skills` の `source='rule'` にあたる） */
  __ruled?: Map<string, string[]>;
  __prefs?: Map<string, AgentPref>;
  __morning?: Set<string>;
};
const runs = (g2.__runs ??= new Map());
const notes = (g2.__notes ??= []);
const notesRead = (g2.__notesRead ??= new Set<number>());
/** 「その鍵で1通だけ」の印（朝の報告・1日の上限）。DB 側は notifications.group_key が持つ */
const onceKeys = (g2.__onceKeys ??= new Set<string>());
const threads = (g2.__threads ??= []);
const msgs = (g2.__msgs ??= new Map<string, ChatMsg[]>());
const skills = (g2.__skills ??= []);
const edits = (g2.__skillEdits ??= new Map<string, { body: string; why: string }>());
const learned = (g2.__learned ??= new Map<string, string[]>());
const ruled = (g2.__ruled ??= new Map<string, string[]>());
/** 統括AI（employee_id が null）の置き場。Map の鍵に null は使えないので名前を1つ決める */
const EXEC_PREF = '__exec__';
/** 社長のことの置き場（DB 側は `agent_skills` の `employee_id` が null の1枚） */
const FOUNDER = '__founder__';
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
/** つないだ道具（MCP）。**鍵はここにだけ持つ** — 画面に返す型には入れない */
type McpRow = Omit<McpServer, 'hasToken'> & { token?: string };
const g5 = globalThis as unknown as { __mcps?: Map<string, McpRow> };
const mcps = (g5.__mcps ??= new Map<string, McpRow>());

const g4 = globalThis as unknown as { __disc?: Map<string, DiscRow>; __profiles?: Map<string, ProfRow> };
const disc = (g4.__disc ??= new Map<string, DiscRow>());
const profiles = (g4.__profiles ??= new Map<string, ProfRow>());

/** 候補の並びは双子で同じに — 推し → **需要の高い順** → 名前（挿入順に頼らない） */
export const sortCands = <T extends { recommended: boolean; fit: { demand: number }; name: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) =>
    Number(b.recommended) - Number(a.recommended)
    // **需要の高い順**（2026-08-26。前は「得意との相性」で並べていた）
    || b.fit.demand - a.fit.demand
    || a.name.localeCompare(b.name, 'ja'));

function findTask(taskId: string) {
  for (const d of bag.values()) {
    const task = d.live?.tasks.find((t) => t.id === taskId);
    if (task && d.live) return { live: d.live, task };
  }
  throw new Error(`task ${taskId} not found`);
}
