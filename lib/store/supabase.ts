import { createClient } from '@/lib/supabase/server';
import { AGENT_COLOR, type EmployeeColor } from '@/lib/dummy';
import { colorFor } from './memory';
import { AppError } from '@/lib/errors';
import type { DraftWork, LiveWork, RunStep, Store } from './types';

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
    const hires = d?.hires ?? [];
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
      c.from('deliverables').select('id, task_id, title, kind, status, preview, body, produced_by_employee_id, created_at')
        .eq('work_id', id).order('created_at', { ascending: false }),
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
    const { data: t } = await c.from('tasks')
      .select('id, assignee_employee_id').eq('id', taskId).maybeSingle();
    if (!t) throw new AppError('not_found', `task ${taskId} not found`);

    const { data: run, error } = await c.from('runs')
      .insert({ task_id: taskId, employee_id: t.assignee_employee_id, status: 'running', tier: 'standard', started_at: new Date().toISOString() })
      .select('id').single();
    if (error || !run) throw new AppError('unknown', error?.message ?? 'runs insert failed');

    await c.from('tasks').update({ status: 'running' }).eq('id', taskId);
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
      error: r.error ?? null,
    }).eq('id', runId);
    if (error) throw new AppError('unknown', error.message);

    if (run) {
      // 失敗は blocked（→ 04-state-machines。再試行の组み立ては統括AIの仕事）
      await c.from('tasks').update({ status: r.status === 'done' ? 'done' : 'blocked' }).eq('id', run.task_id);
      if (run.employee_id) await c.from('employees').update({ status: 'idle' }).eq('id', run.employee_id);
    }
  },

  async addDeliverable(d) {
    const c = await db();
    // preview は本文の書き出し（見出し行を飛ばして90文字）
    const preview = d.body.replace(/^#.*\n/, '').replace(/[#*|>`-]/g, '').trim().slice(0, 90);
    const { error } = await c.from('deliverables').insert({
      work_id: d.workId, task_id: d.taskId, title: d.title, kind: d.kind,
      status: 'review', preview, body: d.body, produced_by_employee_id: d.employeeId ?? null,
    });
    if (error) throw new AppError('unknown', error.message);
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
      .select('id, status, seq').eq('work_id', workId).in('status', ['queued', 'running']).order('seq');
    if (!tk?.length || tk.some((t) => t.status === 'running')) return null;
    return { taskId: tk[0].id as string };
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
      .select('id, work_id, task_id, title, kind, status, preview, body, produced_by_employee_id, created_at, works(title)')
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
    }));
  },

  async setDelStatus(delId, status) {
    const c = await db();
    const { error } = await c.from('deliverables').update({ status }).eq('id', delId);
    if (error) throw new AppError('unknown', error.message);
  },

  async addFixTask(workId, src, note) {
    const c = await db();
    const { data: from } = src.taskId
      ? await c.from('tasks').select('phase_id, seq, assignee_type, assignee_employee_id, owner_hint').eq('id', src.taskId).maybeSingle()
      : { data: null };
    const { data: seqRow } = await c.from('tasks').select('seq').eq('work_id', workId)
      .order('seq', { ascending: false }).limit(1).maybeSingle();
    const { error } = await c.from('tasks').insert({
      work_id: workId, phase_id: from?.phase_id ?? null, seq: (seqRow?.seq ?? 0) + 1,
      title: `${src.title} を直す`, intent: `社長の指摘: ${note}`,
      status: 'queued', created_by: 'user',
      assignee_type: from?.assignee_type ?? 'user',
      assignee_employee_id: from?.assignee_employee_id ?? null,
      owner_hint: from?.owner_hint ?? null,
    });
    if (error) throw new AppError('unknown', error.message);
    // フェーズが review まで来ていたら、直しのぶん戻す
    if (from?.phase_id) {
      await c.from('phases').update({ status: 'active' }).eq('id', from.phase_id).eq('status', 'review');
    }
  },

  async closePhaseIfDone(workId) {
    const c = await db();
    const { data: ph } = await c.from('phases')
      .select('id, name, status').eq('work_id', workId).eq('status', 'active');
    let closed = false;
    for (const p of ph ?? []) {
      const { data: mine } = await c.from('tasks').select('status').eq('phase_id', p.id);
      if (mine?.length && mine.every((t) => t.status === 'done' || t.status === 'cancelled')) {
        await c.from('phases').update({ status: 'review' }).eq('id', p.id);
        await c.from('notifications').insert({
          kind: '判断待ち', subject_type: 'phase', subject_id: p.id,
          body: `フェーズ「${p.name}」が終わりました。見て、次に進めてください`,
        });
        closed = true;
      }
    }
    return closed;
  },
};
