import { createClient } from '@/lib/supabase/server';
import { AGENT_COLOR, type EmployeeColor } from '@/lib/dummy';
import { colorFor } from './memory';
import { AppError } from '@/lib/errors';
import { STALL_MS, type DraftWork, type LiveDecision, type LiveWork, type RunStep, type Store } from './types';

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
      error: r.error ?? null,
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
      await c.from('notifications').insert({ kind: '要確認', subject_type: 'work', subject_id: workId, body: 'Work が終わりました' });
      return null;
    }
    await c.from('phases').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', next.id);
    await c.from('works').update({ current_phase_id: next.id }).eq('id', workId);

    if (nextTasks.length) {
      // 担当は名前で引き当てる（承認のときと同じ規則）
      const { data: em } = await c.from('employees')
        .select('id, display_name').neq('status', 'retired');
      const byName = new Map((em ?? []).map((e) => [e.display_name as string, e.id as string]));
      const { data: seqRow } = await c.from('tasks').select('seq').eq('work_id', workId)
        .order('seq', { ascending: false }).limit(1).maybeSingle();
      let seq = (seqRow?.seq ?? 0);
      const { error } = await c.from('tasks').insert(nextTasks.map((t) => {
        const who = t.ownerHint ? byName.get(t.ownerHint) : undefined;
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

  async closePhaseIfDone(workId) {
    const c = await db();
    const { data: ph } = await c.from('phases')
      .select('id, name, status').eq('work_id', workId).eq('status', 'active');
    let closed = false;
    for (const p of ph ?? []) {
      const { data: mine } = await c.from('tasks').select('status').eq('phase_id', p.id);
      if (mine?.length && mine.every((t) => t.status === 'done' || t.status === 'cancelled')) {
        // active のものだけ畳む。ポンプが2か所から来ても、通知は畳めた側の1通だけ
        const { data: flipped } = await c.from('phases')
          .update({ status: 'review' }).eq('id', p.id).eq('status', 'active').select('id');
        if (flipped?.length) {
          await c.from('notifications').insert({
            kind: '判断待ち', subject_type: 'phase', subject_id: p.id,
            body: `フェーズ「${p.name}」が終わりました。見て、次に進めてください`,
          });
          closed = true;
        }
      }
    }
    return closed;
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