import { createClient } from '@/lib/supabase/server';
import { AGENT_COLOR, type EmployeeColor } from '@/lib/view/model';
import { byName as rosterByName, crewFor } from '@/lib/roster';
import { previewFor } from '@/lib/deliver/format';
import { colorFor, sortCands } from './memory';
import { BUILTIN_SKILLS } from '@/lib/roster/skills';
import { AppError } from '@/lib/errors';
import { finishNote, finishSay, gateNote, type Finished } from '@/lib/exec/finish';
import type { McpServer } from '@/lib/mcp/types';
import { STALL_MS, type AgentPref, type ChatMsg, type ChatThread, type Discovery, type DraftWork, type LiveDecision, type LiveWork, type Note, type Profile, type RunStep, type SkillRow, type Store } from './types';

/**
 * 本番の保存先。行は全部 RLS（`account_id = private.current_account_id()`）で絞られる。
 * **account_id はここでは書かない** — 全表に同じ既定値を置いてある
 * （`supabase/migrations/0007_account_default.sql`）。23表あるので、
 * 書く方式にすると1か所の書き忘れが本番でだけ落ちる。
 *
 * **状態の進み方は `docs/design/04-state-machines.md` のとおり。**
 *   立てたとき: works=`plan_review` / フェーズ=`planned` / タスク=`queued`
 *   承認したとき: works=`active` / 最初のフェーズ=`active` / **タスクは queued のまま**
 *     （走らせるのは Phase 7。ここで `running` にすると偽の進捗になる）
 */

type DraftBody = Pick<DraftWork, 'container' | 'questions' | 'hires' | 'plan' | 'real'>;

/** 統括AIの出力そのもの。**業務データはフェーズ・タスク・質問の表のほうが真実** */
const body = (d: DraftBody): DraftBody =>
  ({ container: d.container, questions: d.questions, hires: d.hires, plan: d.plan, real: d.real });

const db = () => createClient();
type C = Awaited<ReturnType<typeof db>>;

/**
 * その Work の相談スレッド。**Work は会話を持たないが、行き先は持つ**（→ CLAUDE.md）。
 * 質問は `questions.thread_id` が NOT NULL なので、ここが無いと1問も置けない。
 */
async function threadFor(c: C, workId: string, title: string): Promise<string> {
  const { data } = await c
    .from('chat_threads').select('id').eq('work_id', workId).order('created_at').limit(1).maybeSingle();
  if (data) return data.id as string;
  const { data: t, error } = await c
    .from('chat_threads').insert({ work_id: workId, title }).select('id').single();
  if (error || !t) throw new AppError('unknown', error?.message ?? 'chat_threads insert failed');
  return t.id as string;
}

/** フェーズとタスクを引く（立てたときと、直したときの両方から呼ぶ） */
async function writePlan(c: C, workId: string, d: DraftBody) {
  const phases = d.plan.phases.map((p, i) => ({
    work_id: workId, seq: i + 1, name: p.name, goal: p.goal, status: 'planned',
  }));
  if (!phases.length) return;
  const { data: rows, error } = await c.from('phases').insert(phases).select('id, seq');
  if (error) throw new AppError('unknown', error.message);

  // タスクは**最初のフェーズぶんだけ**。先は前の結果を見てから引き直す
  const first = rows?.find((r) => r.seq === 1);
  if (!first || !d.plan.firstPhaseTasks.length) return;
  const { error: e2 } = await c.from('tasks').insert(d.plan.firstPhaseTasks.map((t, i) => ({
    work_id: workId, phase_id: first.id, seq: i + 1, title: t.title, intent: t.intent,
    status: 'queued', assignee_type: 'user', created_by: 'executive',
    // **統括AIが言った担当を捨てない。** 承認のとき、これを見て割り当てる
    owner_hint: t.ownerHint || null,
  })));
  if (e2) throw new AppError('unknown', e2.message);
}

/** 質問を台帳に残す。**答えはここに書く**（控えの jsonb ではなく、こちらが真実） */
async function writeQuestions(c: C, workId: string, threadId: string, d: DraftBody) {
  if (!d.questions.length) return;
  // **`seq` を書く。** 同じ insert 文で入るので created_at は全行同着になり、並びが決まらない
  const { error } = await c.from('questions').insert(d.questions.map((q, i) => ({
    work_id: workId, thread_id: threadId, seq: i + 1, body: q.body, why: q.why, options: q.options,
  })));
  if (error) throw new AppError('unknown', error.message);
}

type Crew = { id: string; definition_id: string; display_name: string; color_token: string };

export const supabaseStore: Store = {
  kind: 'supabase',

  async createDraft(d) {
    const c = await db();
    const { data: work, error } = await c
      .from('works')
      .insert({ title: d.title, goal: d.goal, status: 'plan_review', plan_draft: body(d) as never })
      .select('id')
      .single();
    if (error || !work) throw new AppError('unknown', error?.message ?? 'works insert failed');

    const id = work.id as string;
    await writePlan(c, id, d);
    await writeQuestions(c, id, await threadFor(c, id, d.title), d);
    return id;
  },

  async getDraft(id) {
    const c = await db();
    const { data: w } = await c
      .from('works').select('id, title, goal, status, plan_draft, created_at').eq('id', id).maybeSingle();
    if (!w?.plan_draft) return null;

    const d = w.plan_draft as unknown as DraftBody;
    /**
     * 答えは台帳のほうが真実。控えの質問に **seq（＝聞いた順）で** 重ねる。
     * 前は本文で引いていた — 同じ文の質問が2つあると混線するし、
     * `answer(id, index)` は seq で書くので、読む側も同じ物差しで揃える。
     */
    const { data: qs } = await c
      .from('questions').select('seq, answer').eq('work_id', id).order('seq');
    const bySeq = new Map((qs ?? []).map((q) => [q.seq as number, (q.answer ?? undefined) as string | undefined]));

    return {
      id: w.id as string, title: w.title as string, goal: w.goal as string,
      container: d.container, hires: d.hires, plan: d.plan, real: d.real,
      questions: d.questions.map((q, i) => ({ ...q, answer: bySeq.get(i + 1) ?? q.answer })),
      approved: w.status !== 'plan_review',
      createdAt: w.created_at as string,
    };
  },

  async listDrafts() {
    const c = await db();
    const { data } = await c
      .from('works').select('id').eq('status', 'plan_review').order('created_at', { ascending: false });
    const out: DraftWork[] = [];
    for (const r of data ?? []) {
      const d = await supabaseStore.getDraft(r.id as string);
      if (d) out.push(d);
    }
    return out;
  },

  /** `index` は 0 始まり。**`seq` で引く**（created_at は同着なので順番が決まらない） */
  async answer(id, index, answer) {
    const c = await db();
    const now = answer ? new Date().toISOString() : null;
    const { error } = await c.from('questions')
      .update({ answer: answer || null, answered_at: now })
      .eq('work_id', id).eq('seq', index + 1);
    if (error) throw new AppError('unknown', error.message);
  },

  /**
   * 承認して動かす。**ここで初めて状態が進む。**
   * 途中で落ちても中途半端にならないよう、works は**最後に**進める
   * （works が `active` なのにフェーズが `planned`、を作らない）。
   */
  async approve(id) {
    const c = await db();
    const { data: w } = await c
      .from('works').select('id, status, plan_draft').eq('id', id).maybeSingle();
    if (!w) throw new AppError('not_found', `work ${id} not found`, undefined, 'その計画は見つかりませんでした');
    if (w.status !== 'plan_review') return;      // 二度押しは何もしない

    const d = w.plan_draft as unknown as DraftBody | null;

    // ① 提案した社員を採用する（employees に `proposed` は無い。採用＝ここで1行できる）。
    //    **同じ定義の社員を2人にしない** — Work ごとに採用すると 調査担当 が何人もできる
    /**
     * **`hires` だけを見ない**（2026-08-25）。統括AIが空で返しても、
     * タスクの担当名から採る。名簿に無い名前は落とす（→ `lib/roster` の `crewFor`）。
     * 本番の最初の Work がこれで「誰も採用されないまま承認された」。
     */
    const hires = crewFor(d?.hires ?? [], (d?.plan.firstPhaseTasks ?? []).map((t) => t.ownerHint));
    let crew: Crew[] = [];
    if (hires.length) {
      const { data: had } = await c
        .from('employees').select('id, definition_id, display_name, color_token')
        .in('definition_id', hires.map((h) => h.definitionId)).neq('status', 'retired');
      const byDef = new Map((had ?? []).map((e) => [e.definition_id as string, e as Crew]));

      const fresh = hires
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => !byDef.has(h.definitionId));
      if (fresh.length) {
        const { data: rows, error } = await c.from('employees').insert(fresh.map(({ h, i }) => ({
          definition_id: h.definitionId, definition_version: 1, display_name: h.displayName,
          color_token: colorFor(h.definitionId, i) satisfies EmployeeColor, status: 'idle',
        }))).select('id, definition_id, display_name, color_token');
        if (error) throw new AppError('unknown', error.message);
        for (const e of rows ?? []) byDef.set(e.definition_id as string, e as Crew);
      }
      crew = hires.map((h) => byDef.get(h.definitionId)).filter(Boolean) as Crew[];
    }

    // ② 最初のフェーズを動かす
    const { data: first } = await c
      .from('phases').select('id').eq('work_id', id).eq('seq', 1).maybeSingle();
    if (first) {
      const { error } = await c.from('phases')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', first.id);
      if (error) throw new AppError('unknown', error.message);

      /**
       * ③ そのフェーズのタスクに担当を割り当てる。**状態は queued のまま。**
       *
       * **統括AIが言った担当（`owner_hint`）で引き当てる。**
       * 前は全部 `crew[0]` に寄せていたので、計画画面が「調査担当」と言ったタスクが
       * 実際には別の社員に付いていた（画面とデータベースが食い違う）。
       * 名前が合わないものだけ、先頭の社員に落とす。
       */
      if (crew.length) {
        const byName = new Map(crew.map((e) => [e.display_name, e.id]));
        const { data: rows } = await c.from('tasks')
          .select('id, owner_hint').eq('phase_id', first.id).eq('status', 'queued');
        for (const t of rows ?? []) {
          const who = byName.get((t.owner_hint ?? '') as string) ?? crew[0].id;
          const { error: e2 } = await c.from('tasks')
            .update({ assignee_type: 'employee', assignee_employee_id: who })
            .eq('id', t.id);
          if (e2) throw new AppError('unknown', e2.message);
        }
      }
    }

    // ④ 最後に Work 自身
    const { error } = await c.from('works').update({
      status: 'active', started_at: new Date().toISOString(), current_phase_id: first?.id ?? null,
    }).eq('id', id);
    if (error) throw new AppError('unknown', error.message);

    // 台帳（`audit_events`）はここでは書かない。**引き金が書く**
    // （`authenticated` に insert が無い。0008_works_audit.sql）
  },

  /** 計画を引き直す。**前のフェーズとタスクは消して入れ替える**（版を持つのは成果物だけ） */
  async revise(id, next) {
    const c = await db();
    const { data: w } = await c.from('works').select('status').eq('id', id).maybeSingle();
    if (!w) throw new AppError('not_found', `work ${id} not found`, undefined, 'その計画は見つかりませんでした');
    if (w.status !== 'plan_review') throw new AppError('unknown', `work ${id} is ${w.status}`, undefined, 'もう承認された計画は直せません');

    await c.from('tasks').delete().eq('work_id', id);
    await c.from('phases').delete().eq('work_id', id);
    await c.from('questions').delete().eq('work_id', id);

    const { error } = await c.from('works')
      .update({ title: next.title, goal: next.goal, plan_draft: body(next) as never })
      .eq('id', id);
    if (error) throw new AppError('unknown', error.message);

    await writePlan(c, id, next);
    // スレッドは残す（相談の行き先は計画を引き直しても変わらない）
    await writeQuestions(c, id, await threadFor(c, id, next.title), next);
  },

  async getWork(id) {
    const c = await db();
    const { data: w } = await c
      .from('works').select('id, title, goal, status, started_at, plan_draft').eq('id', id).maybeSingle();
    if (!w) return null;

    const [{ data: ph }, { data: tk }, { data: dl }] = await Promise.all([
      c.from('phases').select('id, seq, name, goal, status').eq('work_id', id).order('seq'),
      c.from('tasks').select('id, phase_id, seq, title, intent, status, progress, assignee_employee_id, owner_hint').eq('work_id', id).order('seq'),
      c.from('deliverables').select('id, task_id, title, kind, status, version, preview, body, produced_by_employee_id, created_at')
        .eq('work_id', id).neq('status', 'superseded').order('created_at', { ascending: false }),
    ]);

    /**
     * この Work の AI社員 = **採用した社員** ＋ タスクに割り当てられている社員。
     * employees は会社のもので Work に紐づかないので、採用したぶんは控えの hires から引く
     * （タスクの割り当てだけで数えると、まだ仕事の無い社員が消える）。
     */
    const hires = (w.plan_draft as unknown as DraftBody | null)?.hires ?? [];
    const assigned = [...new Set((tk ?? []).map((t) => t.assignee_employee_id).filter(Boolean))] as string[];
    const sel = 'id, display_name, color_token, definition_id';
    const [byDef, byIds] = await Promise.all([
      hires.length
        ? c.from('employees').select(sel).in('definition_id', hires.map((h) => h.definitionId)).neq('status', 'retired')
        : Promise.resolve({ data: [] as Crew[] }),
      assigned.length
        ? c.from('employees').select(sel).in('id', assigned)
        : Promise.resolve({ data: [] as Crew[] }),
    ]);
    const em = new Map<string, Crew>();
    for (const e of [...(byDef.data ?? []), ...(byIds.data ?? [])]) em.set(e.id as string, e as Crew);

    return {
      id: w.id as string, title: w.title as string, goal: w.goal as string,
      status: w.status as LiveWork['status'],
      phases: (ph ?? []).map((p) => ({
        id: p.id as string, seq: p.seq as number, name: p.name as string,
        goal: (p.goal ?? '') as string, state: p.status as LiveWork['phases'][number]['state'],
        weeks: (w.plan_draft as unknown as DraftBody | null)?.plan?.phases?.[(p.seq as number) - 1]?.weeks,
      })),
      tasks: (tk ?? []).map((t) => ({
        id: t.id as string, phaseId: t.phase_id as string, title: t.title as string,
        intent: (t.intent ?? '') as string, state: t.status as string,
        progress: (t.progress ?? 0) as number,
        owner: t.assignee_employee_id
          ? em.get(t.assignee_employee_id)?.display_name
          : ((t.owner_hint ?? undefined) as string | undefined),
        ownerSlug: t.assignee_employee_id
          ? (em.get(t.assignee_employee_id)?.definition_id as string | undefined)
          : undefined,
        ownerId: (t.assignee_employee_id ?? undefined) as string | undefined,
      })),
      dels: (dl ?? []).map((d) => ({
        id: d.id as string, title: d.title as string, kind: d.kind as string,
        state: d.status === 'review' ? '要確認' : d.status === 'approved' ? '承認済' : String(d.status),
        preview: (d.preview ?? undefined) as string | undefined,
        body: (d.body ?? undefined) as string | undefined,
        by: d.produced_by_employee_id ? em.get(d.produced_by_employee_id as string)?.display_name : undefined,
        taskId: (d.task_id ?? undefined) as string | undefined,
        version: (d.version ?? 1) as number,
      })),
      crew: [...em.values()].map((e) => ({
        id: e.id, name: e.display_name,
        color: AGENT_COLOR[e.color_token as EmployeeColor] ?? '#5C6BC0',
      })),
      startedAt: (w.started_at ?? undefined) as string | undefined,
    };
  },

  /* ══════════════ 実行（Phase 7）══════════════
   * 進捗はここでは書かない。**run_steps → 引き金 → tasks.progress**（0012）。
   * service role も持たない — 全部 authenticated ＋ RLS の中で済む。
   */

  async startRun(taskId) {
    const c = await db();
    // **取り合いはこの1文で決める。** queued → running に置き換えられた者だけが走る。
    // 「running が居ないか見てから走る」だけだと、タブが2つ開いていると両方すり抜けて
    // 同じタスクが二度走る（成果物も記帳も二重になる）
    const { data: t } = await c.from('tasks')
      .update({ status: 'running' })
      .eq('id', taskId).eq('status', 'queued')
      .select('id, assignee_employee_id').maybeSingle();
    if (!t) throw new AppError('conflict', `task ${taskId} is not queued`);

    const { data: run, error } = await c.from('runs')
      .insert({ task_id: taskId, employee_id: t.assignee_employee_id, status: 'running', tier: 'standard', started_at: new Date().toISOString() })
      .select('id').single();
    if (error || !run) {
      // 取ったのに走れない — 取りっぱなしにしない
      await c.from('tasks').update({ status: 'queued' }).eq('id', taskId).eq('status', 'running');
      throw new AppError('unknown', error?.message ?? 'runs insert failed');
    }

    if (t.assignee_employee_id) {
      await c.from('employees').update({ status: 'running' }).eq('id', t.assignee_employee_id);
    }
    return run.id as string;
  },

  async addStep(runId, step) {
    const c = await db();
    const { error } = await c.from('run_steps').insert({
      run_id: runId, seq: step.seq, kind: step.kind,
      tool_name: step.tool ?? null, summary: step.summary ?? null, progress: step.progress ?? null,
    });
    if (error) throw new AppError('unknown', error.message);
  },

  async finishRun(runId, r) {
    const c = await db();
    const { data: run } = await c.from('runs').select('task_id, employee_id').eq('id', runId).maybeSingle();
    const { error } = await c.from('runs').update({
      status: r.status, ended_at: new Date().toISOString(),
      tokens_in: r.tokensIn, tokens_out: r.tokensOut, cost_cents: r.costCents,
      error: r.error ?? null, model: r.model ?? null,
    }).eq('id', runId);
    if (error) throw new AppError('unknown', error.message);

    if (run) {
      // 失敗は blocked（→ 04-state-machines。再試行の組み立ては統括AIの仕事）
      await c.from('tasks').update({ status: r.status === 'done' ? 'done' : 'blocked' }).eq('id', run.task_id);
      if (run.employee_id) await c.from('employees').update({ status: 'idle' }).eq('id', run.employee_id);
    }
  },

  async addDeliverable(d) {
    const c = await db();
    // 一覧に出す書き出しは**形ごとに違うところ**から取る（→ `lib/deliver/format.ts`）。
    // 図は主線、表は見出しの行、ページは題 — JSON や `|---|` をそのまま出さない
    const preview = previewFor(d.kind, d.body);

    /**
     * 版の配線。**同じ Work で同じタイトル**なら同じ lineage の新しい版にする
     * （直しの成果物が v2 になる）。前の版は superseded — 一覧からは隠れ、
     * 器（lineage_id / version / superseded）は 0001 のスキーマが最初から持っていた。
     */
    const { data: prev } = await c.from('deliverables')
      .select('id, lineage_id, version').eq('work_id', d.workId).eq('title', d.title)
      .neq('status', 'superseded')
      .order('version', { ascending: false }).limit(1).maybeSingle();

    const { data: row, error } = await c.from('deliverables').insert({
      work_id: d.workId, task_id: d.taskId, title: d.title, kind: d.kind,
      status: 'review', preview, body: d.body, produced_by_employee_id: d.employeeId ?? null,
      ...(prev ? { lineage_id: prev.lineage_id, version: (prev.version as number) + 1 } : {}),
    }).select('id').single();
    if (error || !row) throw new AppError('unknown', error?.message ?? 'deliverables insert failed');
    if (prev) {
      await c.from('deliverables').update({ status: 'superseded' })
        .eq('lineage_id', prev.lineage_id).neq('id', row.id);
    }
  },

  async addNotification(n) {
    const c = await db();
    const { error } = await c.from('notifications').insert({
      kind: n.kind, body: n.body,
      subject_type: n.subjectType ?? null, subject_id: n.subjectId ?? null,
    });
    if (error) throw new AppError('unknown', error.message);
  },

  async getSteps(taskId) {
    const c = await db();
    const { data: run } = await c.from('runs')
      .select('id').eq('task_id', taskId).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (!run) return [];
    const { data } = await c.from('run_steps')
      .select('seq, kind, tool_name, summary, progress, created_at').eq('run_id', run.id).order('seq');
    return (data ?? []).map((s): RunStep => ({
      seq: s.seq as number, kind: s.kind as RunStep['kind'],
      tool: (s.tool_name ?? undefined) as string | undefined,
      summary: (s.summary ?? undefined) as string | undefined,
      progress: (s.progress ?? undefined) as number | undefined,
      at: s.created_at as string,
    }));
  },

  async nextQueued(workId) {
    const c = await db();
    const { data: tk } = await c.from('tasks')
      .select('id, status, seq, assignee_employee_id')
      .eq('work_id', workId).in('status', ['queued', 'running']).order('seq');
    if (!tk?.length || tk.some((t) => t.status === 'running')) return null;
    /**
     * **止めた社員のタスクは起こさない。** ふだんは0行しか返らない
     * （設定は1人1行しかない小さな表）。
     * 止めた人のぶんだけ飛ばして、次の人のタスクは動かす。
     */
    const { data: off } = await c.from('agent_prefs').select('employee_id').eq('paused', true);
    const stopped = new Set((off ?? []).map((e) => e.employee_id as string));
    /**
     * **担当のいないタスクは拾わない**（2026-08-25）。誰の頭も載らないまま走らせると、
     * モデルは成果物を書かずに終わり、タスクが blocked になるだけ — お金だけ減る
     * （本番の最初の Work が実際にそうなった）。承認とフェーズ送りが必ず担当を埋めるので、
     * ここは最後の砦。
     */
    const next = tk.find((t) => t.assignee_employee_id && !stopped.has(t.assignee_employee_id as string));
    return next ? { taskId: next.id as string } : null;
  },

  async reclaimStalled(workId) {
    const c = await db();
    const { data: stuck } = await c.from('tasks')
      .select('id, title, assignee_employee_id').eq('work_id', workId).eq('status', 'running');
    if (!stuck?.length) return false;

    const cutoff = new Date(Date.now() - STALL_MS).toISOString();
    let freed = false;
    for (const t of stuck) {
      const { data: run } = await c.from('runs')
        .select('id, status, started_at').eq('task_id', t.id)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      let next: 'queued' | 'blocked' | 'done';
      if (run?.status === 'running') {
        if ((run.started_at as string) >= cutoff) continue; // まだ生きている（maxDuration は 300秒）
        // 失効。回収も取り合いになるので、閉じられた者だけが続きをやる
        const { data: won } = await c.from('runs')
          .update({ status: 'failed', ended_at: new Date().toISOString(),
                    error: '途中で途切れました（サーバーが入れ替わった可能性）' })
          .eq('id', run.id).eq('status', 'running').select('id');
        if (!won?.length) continue;
        const { count } = await c.from('runs')
          .select('id', { count: 'exact', head: true }).eq('task_id', t.id).eq('status', 'failed');
        next = (count ?? 1) < 2 ? 'queued' : 'blocked'; // もう一度だけ走る。二度目は止める
      } else if (run?.status === 'done') {
        next = 'done'; // finishRun の途中で落ちた形。結果をタスクに写し終える
      } else if (run?.status === 'failed') {
        next = 'blocked';
      } else {
        next = 'queued'; // 実行の1行すら無い（走り出す前に落ちた）。そのまま積み直す
      }

      const { data: back } = await c.from('tasks')
        .update({ status: next }).eq('id', t.id).eq('status', 'running').select('id');
      if (!back?.length) continue;
      if (next === 'blocked') {
        await c.from('notifications').insert({
          kind: 'エラー', subject_type: 'task', subject_id: t.id,
          body: `${t.title} — 実行が途中で途切れました。止めてあります`,
        });
      }
      if (t.assignee_employee_id) {
        await c.from('employees').update({ status: 'idle' }).eq('id', t.assignee_employee_id);
      }
      freed = true;
    }
    return freed;
  },

  async markDecision(taskId, d) {
    const c = await db();
    const { data: t } = await c.from('tasks').select('id, work_id, title').eq('id', taskId).maybeSingle();
    if (!t) throw new AppError('not_found', `task ${taskId} not found`);
    await c.from('tasks').update({ status: 'needs_decision' }).eq('id', taskId);
    const { error } = await c.from('decisions').insert({
      work_id: t.work_id, task_id: taskId, question: d.question,
      options: d.options as never, status: 'open', rationale: d.why || null,
    });
    if (error) throw new AppError('unknown', error.message);
    await c.from('notifications').insert({
      kind: '判断待ち', subject_type: 'task', subject_id: taskId, body: d.question,
    });
  },

  async listDels() {
    const c = await db();
    const { data } = await c.from('deliverables')
      .select('id, work_id, task_id, title, kind, status, version, preview, body, produced_by_employee_id, created_at, works(title)')
      .neq('status', 'superseded')
      .order('created_at', { ascending: false }).limit(60);
    const ids = [...new Set((data ?? []).map((d) => d.produced_by_employee_id).filter(Boolean))] as string[];
    const { data: em } = ids.length
      ? await c.from('employees').select('id, display_name').in('id', ids)
      : { data: [] as { id: string; display_name: string }[] };
    const name = new Map((em ?? []).map((e) => [e.id, e.display_name]));
    return (data ?? []).map((d) => ({
      id: d.id as string, title: d.title as string, kind: d.kind as string,
      state: d.status === 'review' ? '要確認' : d.status === 'approved' ? '承認済'
        : d.status === 'rejected' ? '差し戻し' : String(d.status),
      preview: (d.preview ?? undefined) as string | undefined,
      body: (d.body ?? undefined) as string | undefined,
      by: d.produced_by_employee_id ? name.get(d.produced_by_employee_id as string) : undefined,
      taskId: (d.task_id ?? undefined) as string | undefined,
      workId: d.work_id as string,
      workTitle: ((d.works as { title?: string } | null)?.title ?? '') as string,
      version: (d.version ?? 1) as number,
      at: d.created_at as string,
    }));
  },

  async setDelStatus(delId, status) {
    const c = await db();
    // review のものだけ動かす。二度押し・同時押しの2回目は「動かなかった」が返る
    const { data, error } = await c.from('deliverables')
      .update({ status }).eq('id', delId).eq('status', 'review').select('id');
    if (error) throw new AppError('unknown', error.message);
    return (data?.length ?? 0) > 0;
  },

  async addFixTask(workId, src, note) {
    const c = await db();
    const { data: from } = src.taskId
      ? await c.from('tasks').select('phase_id, seq, assignee_type, assignee_employee_id, owner_hint').eq('id', src.taskId).maybeSingle()
      : { data: null };
    const { data: seqRow } = await c.from('tasks').select('seq').eq('work_id', workId)
      .order('seq', { ascending: false }).limit(1).maybeSingle();
    /**
     * **担当のいない直しタスクを作らない。** 元のタスクが辿れないときは、
     * この Work で動いている誰かに落とす（承認・フェーズ送りと同じ規則）。
     * 前はここが null のまま生まれ、誰の頭も載らないまま走っていた。
     */
    let who = from?.assignee_employee_id as string | null | undefined;
    let hint = from?.owner_hint as string | null | undefined;
    if (!who) {
      const { data: any1 } = await c.from('tasks')
        .select('assignee_employee_id, owner_hint').eq('work_id', workId)
        .not('assignee_employee_id', 'is', null).limit(1).maybeSingle();
      who = any1?.assignee_employee_id as string | undefined;
      hint = hint ?? (any1?.owner_hint as string | undefined);
    }
    const { error } = await c.from('tasks').insert({
      work_id: workId, phase_id: from?.phase_id ?? null, seq: (seqRow?.seq ?? 0) + 1,
      title: `${src.title} を直す`, intent: `社長の指摘: ${note}`,
      status: 'queued', created_by: 'user',
      assignee_type: who ? 'employee' : 'user',
      assignee_employee_id: who ?? null,
      owner_hint: hint ?? null,
    });
    if (error) throw new AppError('unknown', error.message);
    // フェーズが review まで来ていたら、直しのぶん戻す
    if (from?.phase_id) {
      await c.from('phases').update({ status: 'active' }).eq('id', from.phase_id).eq('status', 'review');
    }
  },

  async addDecided(workId, d) {
    const c = await db();
    // 追記のみ（0013 で DELETE は revoke 済み）。status=decided なので chosen は必ず入る
    const { error } = await c.from('decisions').insert({
      work_id: workId, question: d.question, rationale: d.why ?? null,
      options: d.options, chosen_option_key: d.chosen,
      status: 'decided', decided_at: new Date().toISOString(),
    });
    if (error) throw new AppError('unknown', error.message);
  },

  async getDecision(taskId) {
    const c = await db();
    const { data } = await c.from('decisions')
      .select('id, work_id, task_id, question, rationale, options, chosen_option_key, status')
      .eq('task_id', taskId).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data ? toDecision(data) : null;
  },

  async answerDecision(decisionId, chosen) {
    const c = await db();
    const { data: d } = await c.from('decisions')
      .select('id, task_id, status').eq('id', decisionId).maybeSingle();
    if (!d || d.status !== 'open') return;
    const { data: won, error } = await c.from('decisions')
      .update({ status: 'decided', chosen_option_key: chosen, decided_at: new Date().toISOString() })
      .eq('id', decisionId).eq('status', 'open').select('id');
    if (error) throw new AppError('unknown', error.message);
    if (!won?.length) return; // 同時に決めた — 先に決まったほうが正
    if (d.task_id) {
      await c.from('tasks').update({ status: 'queued' }).eq('id', d.task_id).eq('status', 'needs_decision');
    }
  },

  async listDecisions(workId) {
    const c = await db();
    let q = c.from('decisions')
      .select('id, work_id, task_id, question, rationale, options, chosen_option_key, status, decided_at')
      .order('created_at', { ascending: false }).limit(50);
    if (workId) q = q.eq('work_id', workId);
    const { data } = await q;
    return (data ?? []).map(toDecision);
  },

  async addDecisionRefs(runId, decisionIds) {
    if (!decisionIds.length) return;
    const c = await db();
    // 同じ組は入れ直さない（主キー衝突は握りつぶす — 読んだ事実は変わらない）
    await c.from('decision_refs').upsert(
      decisionIds.map((decision_id) => ({ decision_id, run_id: runId })),
      { onConflict: 'decision_id,run_id', ignoreDuplicates: true },
    );
  },

  async advancePhase(workId, nextTasks) {
    const c = await db();
    const { data: ph } = await c.from('phases')
      .select('id, seq, name, status').eq('work_id', workId).order('seq');
    const at = ph?.find((p) => p.status === 'review');
    if (!at) return null;
    // review のものだけ閉じられる。承認を二度押しても、次のタスクは1回だけ積まれる
    const { data: won } = await c.from('phases')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', at.id).eq('status', 'review').select('id');
    if (!won?.length) return null;

    const next = ph?.find((p) => p.status === 'planned');
    if (!next) {
      await c.from('works').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', workId);
      /**
       * **終わりこそ、いちばん言うべきところ**（2026-08-25）。
       * 前は「Work が終わりました」の1行だけで、何ができたのかも入っていなかった。
       * 通知には事実を、会話にはその Work を始めたスレッドへ統括AIの報告を置く。
       * 言葉は `lib/exec/finish.ts` の1か所（双子が同じ文を書く）。
       */
      const { data: w } = await c.from('works').select('title').eq('id', workId).maybeSingle();
      const { data: ds } = await c.from('deliverables')
        .select('title, status').eq('work_id', workId).neq('status', 'superseded')
        .order('created_at', { ascending: false });
      const { data: dec } = await c.from('decisions')
        .select('question, chosen').eq('work_id', workId).eq('status', 'decided');
      const f: Finished = {
        title: (w?.title as string) ?? 'Work',
        dels: (ds ?? []).map((d) => d.title as string),
        unseen: (ds ?? []).filter((d) => d.status === 'review').length,
        decisions: (dec ?? []).map((d) => ({
          question: d.question as string, chosen: (d.chosen ?? '') as string,
        })).filter((d) => d.chosen),
      };
      await c.from('notifications').insert({
        kind: '要確認', subject_type: 'work', subject_id: workId, body: finishNote(f),
      });
      // 会話は倒れても終わりを止めない（報告は義務だが、状態のほうが先）
      await (async () => {
        const th = await threadFor(c, workId, f.title.slice(0, 16));
        await c.from('chat_messages')
          .insert({ thread_id: th, role: 'executive', body: finishSay(f), refs: [] });
        await c.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', th);
      })().catch(() => {});
      return null;
    }
    await c.from('phases').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', next.id);
    await c.from('works').update({ current_phase_id: next.id }).eq('id', workId);

    if (nextTasks.length) {
      /**
       * **要る人がいなければ、ここで採用する**（2026-08-25）。
       *
       * 計画のときに提案されるのは、たいてい**最初のフェーズの担当だけ**。
       * フェーズ3で「企画担当」と書かれても、その人は会社に居ないので、
       * 前は**先頭の社員に落ちて**いた — 実際、通しで走らせると
       * MVPの要件も LPの構成も申込の流れも**全部 調査担当**が書いていた。
       * 画面には担当名が出るので、社長には見分けがつかない。
       *
       * 名簿にある名前なら採る（`hireEmployee` は定義ごとに1人なので、
       * 二度呼んでも増えない）。名簿に無い名前は採らない — 居ない人は作らない。
       */
      for (const name of new Set(nextTasks.map((t) => t.ownerHint).filter(Boolean) as string[])) {
        const def = rosterByName(name);
        if (def) await supabaseStore.hireEmployee(def.slug, def.name).catch(() => {});
      }
      // 担当は名前で引き当てる（承認のときと同じ規則）
      const { data: em } = await c.from('employees')
        .select('id, display_name').neq('status', 'retired');
      const byName = new Map((em ?? []).map((e) => [e.display_name as string, e.id as string]));
      const { data: seqRow } = await c.from('tasks').select('seq').eq('work_id', workId)
        .order('seq', { ascending: false }).limit(1).maybeSingle();
      let seq = (seqRow?.seq ?? 0);
      /**
       * **担当のいないタスクを作らない**（2026-08-25）。名前が合わなければ
       * 先頭の社員に落とす（承認のときと同じ規則）。前はここだけ null のままで、
       * フェーズ2以降に「誰も実行できないタスク」ができる道が残っていた。
       */
      const fallback = (em ?? [])[0]?.id as string | undefined;
      const { error } = await c.from('tasks').insert(nextTasks.map((t) => {
        const who = (t.ownerHint ? byName.get(t.ownerHint) : undefined) ?? fallback;
        return {
          work_id: workId, phase_id: next.id, seq: ++seq, title: t.title, intent: t.intent,
          status: 'queued', created_by: 'executive',
          assignee_type: who ? 'employee' : 'user', assignee_employee_id: who ?? null,
          owner_hint: t.ownerHint ?? null,
        };
      }));
      if (error) throw new AppError('unknown', error.message);
    }
    return next.name as string;
  },

  async hireEmployee(definitionId, displayName) {
    const c = await db();
    const { data: had } = await c.from('employees')
      .select('id').eq('definition_id', definitionId).neq('status', 'retired').limit(1).maybeSingle();
    if (had) return had.id as string;
    const { data: row, error } = await c.from('employees').insert({
      definition_id: definitionId, definition_version: 1, display_name: displayName,
      color_token: colorFor(definitionId, 0) satisfies EmployeeColor, status: 'idle',
    }).select('id').single();
    if (error?.code === '23505') {
      // 同時に採用した（0015 の一意 index が2人目を止めた）。先に入ったほうを返す
      const { data: again } = await c.from('employees')
        .select('id').eq('definition_id', definitionId).neq('status', 'retired').limit(1).maybeSingle();
      if (again) return again.id as string;
    }
    if (error || !row) throw new AppError('unknown', error?.message ?? 'employees insert failed');
    await c.from('notifications').insert({ kind: '要確認', body: `${displayName} を採用しました`, subject_type: 'employee', subject_id: row.id });
    return row.id as string;
  },

  async listEmployees() {
    const c = await db();
    const { data } = await c.from('employees')
      .select('id, definition_id, display_name, color_token, status, hired_at')
      .neq('status', 'retired').order('hired_at');
    return (data ?? []).map((e) => ({
      id: e.id as string, definitionId: e.definition_id as string, name: e.display_name as string,
      color: AGENT_COLOR[e.color_token as EmployeeColor] ?? '#5C6BC0',
      state: e.status as 'idle' | 'running' | 'paused' | 'retired',
      hiredAt: (e.hired_at ?? undefined) as string | undefined,
    }));
  },

  async balanceCents() {
    const c = await db();
    const { data: me } = await c.from('users').select('account_id').limit(1).maybeSingle();
    if (!me) return 0;
    const { data, error } = await c.rpc('account_balance_cents', { a: me.account_id });
    if (error) throw new AppError('unknown', error.message);
    return (data ?? 0) as number;
  },

  async ledger() {
    const c = await db();
    const { data } = await c.from('token_ledger')
      .select('delta_cents, reason, created_at').order('created_at', { ascending: false }).limit(60);
    return (data ?? []).map((r) => ({
      deltaCents: r.delta_cents as number, reason: r.reason as string, when: r.created_at as string,
    }));
  },

  /* ══════════════ ゼロ状態（画面はぜんぶここを読む）══════════════ */

  async listWorks() {
    const c = await db();
    const { data } = await c.from('works')
      .select('id').neq('status', 'archived').order('created_at');
    // Work は片手で数えられる想定なので、詳細は getWork を使い回す（形を二重に持たない）
    const out: LiveWork[] = [];
    for (const w of data ?? []) {
      const one = await supabaseStore.getWork(w.id as string);
      if (one) out.push(one);
    }
    return out;
  },

  async listNotes() {
    const c = await db();
    const { data } = await c.from('notifications')
      .select('id, kind, body, subject_type, subject_id, read_at, created_at')
      .order('created_at', { ascending: false }).limit(100);
    return (data ?? []).map((n): Note => ({
      id: n.id as string, kind: n.kind as string, body: n.body as string,
      at: n.created_at as string, read: n.read_at != null,
      subjectType: (n.subject_type ?? undefined) as string | undefined,
      subjectId: (n.subject_id ?? undefined) as string | undefined,
    }));
  },

  async readNote(id) {
    const c = await db();
    await c.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('id', id).is('read_at', null);
  },

  async listThreads() {
    const c = await db();
    const { data } = await c.from('chat_threads')
      .select('id, title, work_id, last_message_at')
      .order('last_message_at', { ascending: false }).limit(50);
    return (data ?? []).map((t): ChatThread => ({
      id: t.id as string, title: t.title as string,
      workId: (t.work_id ?? undefined) as string | undefined,
      lastAt: t.last_message_at as string,
    }));
  },

  async getThread(id) {
    const c = await db();
    // **2本を同時に投げる。** 順に待つと、遠いDBでは往復が2回ぶん積み上がる
    const [{ data: t }, { data: m }] = await Promise.all([
      c.from('chat_threads')
        .select('id, title, work_id, discovery_id, profile_id, last_message_at').eq('id', id).maybeSingle(),
      c.from('chat_messages')
        .select('role, body, refs, created_at').eq('thread_id', id).order('created_at'),
    ]);
    if (!t) return null;
    return {
      thread: {
        id: t.id as string, title: t.title as string,
        workId: (t.work_id ?? undefined) as string | undefined,
        discoveryId: (t.discovery_id ?? undefined) as string | undefined,
        profileId: (t.profile_id ?? undefined) as string | undefined,
        lastAt: t.last_message_at as string,
      },
      messages: (m ?? []).map((x): ChatMsg => ({
        role: x.role as ChatMsg['role'], body: x.body as string, at: x.created_at as string,
        // 既定値の [] はカードではない。**kind を持つ object のときだけ**カードとして返す
        card: (x.refs && !Array.isArray(x.refs) && typeof x.refs === 'object' && 'kind' in (x.refs as object)
          ? x.refs : undefined) as ChatMsg['card'],
      })),
    };
  },

  async addChat(threadId, role, body, title, card) {
    const c = await db();
    let id = threadId;
    if (!id) {
      const { data: row, error } = await c.from('chat_threads')
        .insert({ title: (title ?? body).slice(0, 16) }).select('id').single();
      if (error || !row) throw new AppError('unknown', error?.message ?? 'thread insert failed');
      id = row.id as string;
    }
    /**
     * カードは refs に置く（0002 から空いている jsonb。カードは id しか持たないので軽い）。
     * **列は `not null default '[]'`** — null を明示して挿すと 23502 で**全発言が落ちる**
     * （supabase-js は undefined のキーは落とすが、null は残す）。無いときは [] を入れる。
     */
    const { error } = await c.from('chat_messages')
      .insert({ thread_id: id, role, body, refs: card ?? [] });
    if (error) throw new AppError('unknown', error.message);
    await c.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', id);
    return id;
  },

  async threadForWork(workId) {
    const c = await db();
    const { data: w } = await c.from('works').select('title').eq('id', workId).maybeSingle();
    return threadFor(c, workId, ((w?.title as string) ?? 'Work の相談').slice(0, 16));
  },

  async linkThread(threadId, patch) {
    const c = await db();
    if (patch.workId) {
      /**
       * **workId は一度きり**（1チャット=1Work）。`is('work_id', null)` を付けた
       * 1本の update で決める — 読んでから書くと、二度押しで2本目が立つ
       */
      const { data } = await c.from('chat_threads')
        .update({ work_id: patch.workId }).eq('id', threadId).is('work_id', null).select('id');
      if (!data?.length) return false;
    }
    const rest: Record<string, string> = {};
    if (patch.discoveryId) rest.discovery_id = patch.discoveryId;
    if (patch.profileId) rest.profile_id = patch.profileId;
    if (Object.keys(rest).length) {
      const { error } = await c.from('chat_threads').update(rest).eq('id', threadId);
      if (error) throw new AppError('unknown', error.message);
    }
    return true;
  },

  async listSkills() {
    const c = await db();
    const sel = 'id, name, filename, enabled, employee_id, used_count, source, body';
    let { data } = await c.from('agent_skills').select(sel).order('created_at');
    // 1枚も無ければ標準スキルを播く（元々の機能）。同時に開いた2つのタブは
    // 0017 の一意 index が2度目を止める → 弾かれたら読み直すだけ
    if (!data?.length) {
      await c.from('agent_skills').insert(BUILTIN_SKILLS.map((b) => ({
        name: b.name, filename: b.filename, description: b.description, body: b.body,
        source: 'builtin', enabled: true,
      })));
      ({ data } = await c.from('agent_skills').select(sel).order('created_at'));
    }
    return (data ?? []).map((x): SkillRow => ({
      id: x.id as string, name: x.name as string, filename: x.filename as string,
      on: x.enabled as boolean,
      scope: x.employee_id ? 'employee' : 'company',
      used: (x.used_count ?? 0) as number,
      source: (x.source ?? 'user') as SkillRow['source'],
      body: (x.body ?? undefined) as string | undefined,
    }));
  },

  async setSkill(id, on) {
    const c = await db();
    await c.from('agent_skills').update({ enabled: on }).eq('id', id);
  },

  async addSkill(x) {
    const c = await db();
    const { error } = await c.from('agent_skills')
      .insert({ name: x.name, filename: x.filename, body: x.body, source: 'user' });
    if (error) throw new AppError('unknown', error.message);
  },

  async removeSkill(id) {
    const c = await db();
    await c.from('agent_skills').delete().eq('id', id).eq('source', 'user');
  },

  async bumpSkillUse(ids) {
    const c = await db();
    for (const id of ids) {
      const { data } = await c.from('agent_skills').select('used_count').eq('id', id).maybeSingle();
      if (data) await c.from('agent_skills').update({ used_count: (data.used_count ?? 0) + 1 }).eq('id', id);
    }
  },

  /* ══════════════ モデルと深さ ══════════════ */

  async listPrefs() {
    const c = await db();
    const { data } = await c.from('agent_prefs').select('employee_id, model, effort, paused');
    return (data ?? []).map((x): AgentPref => ({
      employeeId: (x.employee_id ?? null) as string | null,
      model: (x.model ?? undefined) as string | undefined,
      effort: (x.effort ?? undefined) as AgentPref['effort'],
      paused: !!x.paused,
    }));
  },

  async prefOf(employeeId) {
    const c = await db();
    // **統括AI は employee_id が null。** `.eq(null)` は当たらないので `.is` で引く
    const q = c.from('agent_prefs').select('employee_id, model, effort, paused');
    const { data } = await (employeeId ? q.eq('employee_id', employeeId) : q.is('employee_id', null))
      .maybeSingle();
    if (!data) return null;
    return {
      employeeId: (data.employee_id ?? null) as string | null,
      model: (data.model ?? undefined) as string | undefined,
      effort: (data.effort ?? undefined) as AgentPref['effort'],
      paused: !!data.paused,
    };
  },

  async setPref(employeeId, patch) {
    const c = await db();
    const sel = c.from('agent_prefs').select('id');
    const { data: row } = await (employeeId ? sel.eq('employee_id', employeeId) : sel.is('employee_id', null))
      .maybeSingle();
    // **渡した項目だけ書き換える**（モデルを選んでも深さが消えない）
    const patchRow = {
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.effort !== undefined ? { effort: patch.effort } : {}),
      ...(patch.paused !== undefined ? { paused: patch.paused } : {}),
      updated_at: new Date().toISOString(),
    };
    if (row) {
      const { error } = await c.from('agent_prefs').update(patchRow).eq('id', row.id);
      if (error) throw new AppError('unknown', error.message);
      return;
    }
    const { error } = await c.from('agent_prefs').insert({ employee_id: employeeId, ...patchRow });
    // 同時に2つのタブから触っても1行（0024 の一意 index）。弾かれたら書き直す
    if (error?.code === '23505') { await supabaseStore.setPref(employeeId, patch); return; }
    if (error) throw new AppError('unknown', error.message);
  },

  /* ══════════════ 学び ══════════════ */

  async learnings(employeeId) {
    const c = await db();
    const { data } = await c.from('agent_skills')
      .select('body').eq('employee_id', employeeId).eq('source', 'learned').maybeSingle();
    return ((data?.body as string | undefined) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  },

  async addLearnings(employeeId, lines) {
    const raw = lines.map((l) => l.trim()).filter(Boolean);
    if (!raw.length) return;
    const c = await db();
    const cur = await supabaseStore.learnings(employeeId);
    // **同じ学びを二度書かない**（メモリ版と同じ規則）。似た仕事で同じことに気づくので、
    // 放っておくと30行が同じ1行で埋まる
    const add = raw.filter((l) => !cur.includes(l));
    if (!add.length) return;
    const next = [...cur, ...add].slice(-30); // 上限30行。あふれたら古いものから
    const { data: row } = await c.from('agent_skills')
      .select('id').eq('employee_id', employeeId).eq('source', 'learned').maybeSingle();
    if (row) {
      await c.from('agent_skills').update({ body: next.join('\n') }).eq('id', row.id);
    } else {
      // 同時に2つの実行が閉じても、0017 の一意 index が2枚目を止める
      const { error } = await c.from('agent_skills').insert({
        employee_id: employeeId, name: '学び', filename: 'learnings.md',
        description: '仕事のなかで書き溜めたメモ。次の実行の依頼文に載る',
        body: next.join('\n'), source: 'learned', enabled: true,
      });
      if (error && error.code !== '23505') throw new AppError('unknown', error.message);
      if (error?.code === '23505') await supabaseStore.addLearnings(employeeId, add);
    }
  },

  async setLearnings(employeeId, lines) {
    const c = await db();
    const next = lines.map((l) => l.trim()).filter(Boolean);
    const { data: row } = await c.from('agent_skills')
      .select('id').eq('employee_id', employeeId).eq('source', 'learned').maybeSingle();
    if (!row) return;
    if (next.length) await c.from('agent_skills').update({ body: next.join('\n') }).eq('id', row.id);
    else await c.from('agent_skills').delete().eq('id', row.id).eq('source', 'learned');
  },

  async companyName() {
    const c = await db();
    const { data } = await c.from('accounts').select('name').limit(1).maybeSingle();
    return (data?.name as string | undefined) ?? 'あなたの会社';
  },

  async recentSteps(limit) {
    const c = await db();
    const { data } = await c.from('run_steps')
      .select('summary, created_at, runs(employee_id)')
      .not('summary', 'is', null)
      .order('created_at', { ascending: false }).limit(limit);
    const ids = [...new Set((data ?? [])
      .map((x) => (x.runs as { employee_id?: string } | null)?.employee_id).filter(Boolean))] as string[];
    const { data: em } = ids.length
      ? await c.from('employees').select('id, display_name').in('id', ids)
      : { data: [] as { id: string; display_name: string }[] };
    const name = new Map((em ?? []).map((e) => [e.id, e.display_name]));
    return (data ?? []).map((x) => ({
      at: x.created_at as string,
      who: name.get((x.runs as { employee_id?: string } | null)?.employee_id ?? '') ?? 'AI社員',
      what: x.summary as string,
    }));
  },

  async morningBrief(day) {
    const c = await db();
    // 「その日」は**社長の朝**で数える（器が自分の日付を渡してくる）。
    // UTC で数えると、日本の朝9時まで「きのう」のままになる
    const today = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
    const key = `morning-${today}`;
    // きょうのぶんが既にあれば書かない
    const { data: had } = await c.from('notifications').select('id').eq('group_key', key).limit(1).maybeSingle();
    if (had) return false;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: doneRuns }, { data: dels }, { data: opens }, { data: paused }] = await Promise.all([
      c.from('runs').select('id').eq('status', 'done').gte('ended_at', since),
      c.from('deliverables').select('id').eq('status', 'review').gte('created_at', since),
      c.from('decisions').select('id').eq('status', 'open'),
      c.from('works').select('id').eq('status', 'paused'),
    ]);
    const ran = doneRuns?.length ?? 0, del = dels?.length ?? 0,
          open = opens?.length ?? 0, stop = paused?.length ?? 0;
    // **動きが無かった朝は黙る。** 空の報告は報告ではない
    if (ran + del + open + stop === 0) return false;

    const parts: string[] = [];
    if (ran) parts.push(`きのうから実行が ${ran}件 終わりました`);
    if (del) parts.push(`見てほしい成果物が ${del}件`);
    if (open) parts.push(`判断待ちが ${open}件`);
    if (stop) parts.push(`止まっている Work が ${stop}件`);
    const { error } = await c.from('notifications').insert({
      // いちばん強い用件で名乗る — 判断待ち（あなたが決める）＞ 要確認 ＞ エラー
      kind: open ? '判断待ち' : del || ran ? '要確認' : 'エラー',
      body: `朝の報告 — ${parts.join('、')}`, group_key: key,
    });
    // 同時に開いたタブが2つあっても、0015 の一意 index が2通目を止める
    if (error?.code === '23505') return false;
    if (error) throw new AppError('unknown', error.message);
    return true;
  },

  async pauseWork(workId, why) {
    const c = await db();
    await c.from('works').update({ status: 'paused' }).eq('id', workId);
    await c.from('notifications').insert({ kind: 'エラー', subject_type: 'work', subject_id: workId, body: why });
  },

  async setWorkPaused(workId, paused) {
    const c = await db();
    // **その状態のものだけ動かす**（二度押し・同時押しで行ったり来たりしない）
    const { data } = await c.from('works')
      .update({ status: paused ? 'paused' : 'active' })
      .eq('id', workId).eq('status', paused ? 'active' : 'paused').select('id');
    return !!data?.length;
  },

  async spentSinceCents(iso) {
    const c = await db();
    // consume は必ず負の1行（引き金 `run_ledger` → 0014）。**使ったぶんは正の数で返す**
    const { data } = await c.from('token_ledger')
      .select('delta_cents').eq('reason', 'consume').gte('created_at', iso);
    return (data ?? []).reduce((n, r) => n - (r.delta_cents as number), 0);
  },

  async noticeOnce(key, kind, body) {
    const c = await db();
    const { data: had } = await c.from('notifications')
      .select('id').eq('group_key', key).limit(1).maybeSingle();
    if (had) return false;
    // 同時に来たら 23505 で2通目が落ちる（0026 の一意 index）。落ちたほうは false
    const { error } = await c.from('notifications').insert({ kind, body, group_key: key });
    return !error;
  },

  async noticed(key) {
    const c = await db();
    const { data } = await c.from('notifications')
      .select('id').eq('group_key', key).limit(1).maybeSingle();
    return !!data;
  },

  async activeWorks() {
    const c = await db();
    const { data } = await c.from('works')
      .select('id').eq('status', 'active').order('created_at');
    return (data ?? []).map((w) => w.id as string);
  },

  async closePhaseIfDone(workId, gates = []) {
    const c = await db();
    const [{ data: ph }, { data: allTasks }, { data: unseen }] = await Promise.all([
      c.from('phases').select('id, name, status').eq('work_id', workId).in('status', ['active', 'review']),
      c.from('tasks').select('id, phase_id, status').eq('work_id', workId),
      // **まだ見ていない成果物**。差し戻し済（rejected）は直しタスクが積まれるので待たない
      c.from('deliverables').select('task_id').eq('work_id', workId).eq('status', 'review'),
    ]);
    /** そのフェーズに、社長がまだ見ていない成果物が何件あるか */
    const phaseOf = new Map((allTasks ?? []).map((t) => [t.id as string, t.phase_id as string]));
    const waiting = new Map<string, number>();
    for (const d of unseen ?? []) {
      const pid = d.task_id ? phaseOf.get(d.task_id as string) : undefined;
      if (pid) waiting.set(pid, (waiting.get(pid) ?? 0) + 1);
    }

    const closed: string[] = [];
    const review: { id: string; name: string }[] = [];
    for (const p of ph ?? []) {
      if (p.status === 'review') { review.push({ id: p.id as string, name: p.name as string }); continue; }
      const mine = (allTasks ?? []).filter((t) => t.phase_id === p.id);
      if (!mine.length || !mine.every((t) => t.status === 'done' || t.status === 'cancelled')) continue;
      // active のものだけ畳む。ポンプが2か所から来ても、通知は畳めた側の1通だけ
      const { data: flipped } = await c.from('phases')
        .update({ status: 'review' }).eq('id', p.id).eq('status', 'active').select('id');
      if (!flipped?.length) continue;
      review.push({ id: p.id as string, name: p.name as string });
      closed.push(p.name as string);
      await c.from('notifications').insert({
        ...gateNote(p.name as string, gates.includes(p.name as string), waiting.get(p.id as string) ?? 0),
        subject_type: 'phase', subject_id: p.id,
      });
    }

    /**
     * **待つものが残っているか**は、閉じた直後だけでなく毎回測り直す。
     * 社長が最後の1件を承認した瞬間に `ready` が立ち、ポンプが次のフェーズを引く。
     */
    const hold = review.some((p) => gates.includes(p.name) || (waiting.get(p.id) ?? 0) > 0);
    return { closed, hold, ready: review.length > 0 && !hold, at: review[0]?.name ?? null };
  },

  async planGates(workId) {
    const c = await db();
    const { data: w } = await c.from('works').select('plan_draft').eq('id', workId).maybeSingle();
    const d = w?.plan_draft as unknown as DraftBody | null;
    return (d?.plan?.gates ?? []).map((g) => g.afterPhase).filter(Boolean);
  },

  /* ══════════════ 入口（Case B / D）══════════════ */

  async createDiscovery() {
    const c = await db();
    const { data, error } = await c.from('discovery_sessions').insert({}).select('id').single();
    if (error || !data) throw new AppError('unknown', error?.message ?? 'discovery_sessions insert failed');
    return data.id as string;
  },

  async getDiscovery(id) {
    const c = await db();
    const { data: s } = await c.from('discovery_sessions')
      .select('id, status, constraints, is_real').eq('id', id).maybeSingle();
    if (!s) return null;
    const { data: rows } = await c.from('discovery_candidates')
      .select('id, name, summary, ending, fit, why, recommended, not_chosen_why, adopted_work_id, created_at')
      .eq('session_id', id).order('created_at', { ascending: false }).limit(30);
    // **最新の束だけ。** 1回の提案は1文で入るので created_at が同着 — 先頭と同じ時刻の行が今の束
    const latest = rows?.length ? rows.filter((r) => r.created_at === rows[0].created_at) : [];
    const raw = (s.constraints ?? {}) as Record<string, unknown>;
    const fitOf = (f: unknown, k: string) =>
      Math.max(0, Math.min(100, Number((f as Record<string, unknown>)?.[k] ?? 0) || 0));
    return {
      id: s.id as string,
      status: s.status as Discovery['status'],
      real: !!s.is_real,
      conditions: {
        interests: Array.isArray(raw.interests) ? raw.interests.map(String) : [],
        hoursPerWeek: raw.hours_per_week == null ? null : Number(raw.hours_per_week),
        budgetJpy: raw.budget_jpy == null ? null : Number(raw.budget_jpy),
        strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
        avoid: Array.isArray(raw.avoid) ? raw.avoid.map(String) : [],
        deadline: raw.deadline == null ? null : String(raw.deadline),
      },
      candidates: sortCands(latest.map((r) => ({
        id: r.id as string, name: r.name as string, summary: r.summary as string,
        ending: (r.ending ?? '') as string,
        why: Array.isArray(r.why) ? r.why.map(String) : [],
        fit: { speed: fitOf(r.fit, 'speed'), cost: fitOf(r.fit, 'cost'), strength: fitOf(r.fit, 'strength') },
        recommended: !!r.recommended,
        notChosenWhy: (r.not_chosen_why ?? undefined) as string | undefined,
        adoptedWorkId: (r.adopted_work_id ?? undefined) as string | undefined,
      }))),
    };
  },

  async setConditions(id, x, real) {
    const c = await db();
    const { error } = await c.from('discovery_sessions').update({
      constraints: {
        interests: x.interests,
        hours_per_week: x.hoursPerWeek ?? null,
        budget_jpy: x.budgetJpy ?? null,
        strengths: x.strengths, avoid: x.avoid,
        deadline: x.deadline ?? null,
      },
      is_real: real,
    }).eq('id', id);
    if (error) throw new AppError('unknown', error.message);
  },

  async setCandidates(id, cands) {
    const c = await db();
    // 1文で入れる（束の created_at が同着になる — getDiscovery が「最新の束」を切り出す鍵）。
    // **前の束は消さない**（不変条件 9。delete は DB 側でも revoke 済み）
    const { error } = await c.from('discovery_candidates').insert(cands.map((x) => ({
      session_id: id, name: x.name, summary: x.summary, ending: x.ending, why: x.why,
      fit: x.fit, recommended: x.recommended, not_chosen_why: x.notChosenWhy ?? null,
    })));
    if (error) throw new AppError('unknown', error.message);
    const { error: e2 } = await c.from('discovery_sessions').update({ status: 'proposed' }).eq('id', id);
    if (e2) throw new AppError('unknown', e2.message);
  },

  async adoptCandidate(sessionId, candidateId, workId) {
    const c = await db();
    const { error } = await c.from('discovery_candidates')
      .update({ adopted_work_id: workId }).eq('id', candidateId).eq('session_id', sessionId);
    if (error) throw new AppError('unknown', error.message);
    const { error: e2 } = await c.from('discovery_sessions').update({ status: 'adopted' }).eq('id', sessionId);
    if (e2) throw new AppError('unknown', e2.message);
  },

  async createProfile(name) {
    const c = await db();
    const { data, error } = await c.from('business_profiles').insert({ name }).select('id').single();
    if (error || !data) throw new AppError('unknown', error?.message ?? 'business_profiles insert failed');
    return data.id as string;
  },

  async getProfile(id) {
    const c = await db();
    const { data: p } = await c.from('business_profiles')
      .select('id, name, url, stage').eq('id', id).maybeSingle();
    if (!p) return null;
    const { data: src } = await c.from('imported_sources')
      .select('id, kind, locator, status, summary')
      .eq('business_profile_id', id).order('created_at', { ascending: true });
    const { data: dg } = await c.from('diagnoses')
      .select('facts, findings, is_real, created_at')
      .eq('business_profile_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return {
      id: p.id as string, name: p.name as string,
      url: (p.url ?? undefined) as string | undefined,
      stage: (p.stage ?? undefined) as string | undefined,
      sources: (src ?? []).map((s) => ({
        id: s.id as string,
        kind: s.kind as Profile['sources'][number]['kind'],
        locator: s.locator as string,
        status: s.status as Profile['sources'][number]['status'],
        summary: (s.summary ?? undefined) as string | undefined,
      })),
      diagnosis: dg ? {
        facts: (dg.facts ?? []) as NonNullable<Profile['diagnosis']>['facts'],
        findings: (dg.findings ?? []) as NonNullable<Profile['diagnosis']>['findings'],
        real: !!dg.is_real,
        at: dg.created_at as string,
      } : undefined,
    };
  },

  async addSource(profileId, s) {
    const c = await db();
    const { data, error } = await c.from('imported_sources').insert({
      business_profile_id: profileId, kind: s.kind, locator: s.locator,
      status: s.status, summary: s.summary ?? null,
    }).select('id').single();
    if (error || !data) throw new AppError('unknown', error?.message ?? 'imported_sources insert failed');
    return data.id as string;
  },

  async setProfileMeta(id, m) {
    const c = await db();
    const patch: Record<string, string> = {};
    if (m.name) patch.name = m.name;
    if (m.stage) patch.stage = m.stage;
    if (!Object.keys(patch).length) return;
    const { error } = await c.from('business_profiles').update(patch).eq('id', id);
    if (error) throw new AppError('unknown', error.message);
  },

  async saveDiagnosis(profileId, d) {
    const c = await db();
    const { error } = await c.from('diagnoses').insert({
      business_profile_id: profileId, facts: d.facts, findings: d.findings, is_real: d.real,
    });
    if (error) throw new AppError('unknown', error.message);
  },

  async linkFinding(profileId, index, workId) {
    const c = await db();
    // 最新の診断（画面が読んでいるもの）の findings に書き戻す
    const { data } = await c.from('diagnoses')
      .select('id, findings').eq('business_profile_id', profileId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!data) return false;
    const findings = (data.findings ?? []) as NonNullable<Profile['diagnosis']>['findings'];
    const f = findings[index];
    if (!f) return false;
    if (f.workId) return false; // もう立っている（二度目は立てない）
    findings[index] = { ...f, workId };
    const { error } = await c.from('diagnoses').update({ findings }).eq('id', data.id);
    if (error) throw new AppError('unknown', error.message);
    return true;
  },

  /* ══════════════ つないだ道具（MCP・Phase 12）══════════════ */

  async listMcpServers() {
    const c = await db();
    // **`token` は引かない。** 鍵を読むのは `mcpSecret` 1か所だけ（0028 の注）
    const { data } = await c.from('mcp_servers')
      .select('id, name, url, write_ok, enabled, checked_at, tool_count, last_error, token')
      .order('created_at');
    return (data ?? []).map((x): McpServer => ({
      id: x.id as string, name: x.name as string, url: x.url as string,
      hasToken: !!x.token,
      write: x.write_ok as boolean, on: x.enabled as boolean,
      checkedAt: (x.checked_at ?? undefined) as string | undefined,
      toolCount: (x.tool_count ?? undefined) as number | undefined,
      lastError: (x.last_error ?? undefined) as string | undefined,
    }));
  },

  async addMcpServer(x) {
    const c = await db();
    // **同じ行き先は二度つながない**（0028 の一意 index）。
    // 出しなおしたときは名前と鍵を上書きして、確かめ直しの印を消す
    const { data, error } = await c.from('mcp_servers')
      .upsert({ name: x.name, url: x.url, token: x.token ?? null,
                checked_at: null, tool_count: null, last_error: null },
              { onConflict: 'account_id,url' })
      .select('id').single();
    if (error || !data) throw new AppError('unknown', error?.message ?? 'mcp_servers upsert failed');
    return data.id as string;
  },

  async setMcpServer(id, patch) {
    const c = await db();
    const row: Record<string, unknown> = {};
    if (patch.on !== undefined) row.enabled = patch.on;
    if (patch.write !== undefined) row.write_ok = patch.write;
    if (patch.name !== undefined) row.name = patch.name;
    if (!Object.keys(row).length) return;
    const { error } = await c.from('mcp_servers').update(row).eq('id', id);
    if (error) throw new AppError('unknown', error.message);
  },

  async removeMcpServer(id) {
    const c = await db();
    const { error } = await c.from('mcp_servers').delete().eq('id', id);
    if (error) throw new AppError('unknown', error.message);
  },

  async noteMcpCheck(id, r) {
    const c = await db();
    await c.from('mcp_servers').update({
      checked_at: new Date().toISOString(),
      tool_count: r.error ? null : (r.tools ?? 0),
      last_error: r.error ?? null,
    }).eq('id', id);
  },

  async mcpSecret(id) {
    const c = await db();
    const { data } = await c.from('mcp_servers').select('token').eq('id', id).maybeSingle();
    return (data?.token ?? undefined) as string | undefined;
  },
};


/** DB の行 → 画面の形（決定） */
function toDecision(d: Record<string, unknown>): LiveDecision {
  return {
    id: d.id as string, workId: d.work_id as string,
    taskId: (d.task_id ?? undefined) as string | undefined,
    question: d.question as string,
    why: (d.rationale ?? undefined) as string | undefined,
    options: (d.options ?? []) as LiveDecision['options'],
    chosen: (d.chosen_option_key ?? undefined) as string | undefined,
    status: d.status as LiveDecision['status'],
  };
}