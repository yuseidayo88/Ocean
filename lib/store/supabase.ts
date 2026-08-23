import { createClient } from '@/lib/supabase/server';
import { AGENT_COLOR, type EmployeeColor } from '@/lib/dummy';
import { colorFor } from './memory';
import type { DraftWork, LiveWork, Store } from './types';

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
  if (error || !t) throw new Error(error?.message ?? 'スレッドを作れませんでした');
  return t.id as string;
}

/** フェーズとタスクを引く（立てたときと、直したときの両方から呼ぶ） */
async function writePlan(c: C, workId: string, d: DraftBody) {
  const phases = d.plan.phases.map((p, i) => ({
    work_id: workId, seq: i + 1, name: p.name, goal: p.goal, status: 'planned',
  }));
  if (!phases.length) return;
  const { data: rows, error } = await c.from('phases').insert(phases).select('id, seq');
  if (error) throw new Error(error.message);

  // タスクは**最初のフェーズぶんだけ**。先は前の結果を見てから引き直す
  const first = rows?.find((r) => r.seq === 1);
  if (!first || !d.plan.firstPhaseTasks.length) return;
  const { error: e2 } = await c.from('tasks').insert(d.plan.firstPhaseTasks.map((t) => ({
    work_id: workId, phase_id: first.id, title: t.title, intent: t.intent,
    status: 'queued', assignee_type: 'user', created_by: 'executive',
  })));
  if (e2) throw new Error(e2.message);
}

/** 質問を台帳に残す。**答えはここに書く**（控えの jsonb ではなく、こちらが真実） */
async function writeQuestions(c: C, workId: string, threadId: string, d: DraftBody) {
  if (!d.questions.length) return;
  const { error } = await c.from('questions').insert(d.questions.map((q) => ({
    work_id: workId, thread_id: threadId, body: q.body, why: q.why, options: q.options,
  })));
  if (error) throw new Error(error.message);
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
    if (error || !work) throw new Error(error?.message ?? 'works の作成に失敗しました');

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
    // 答えは台帳のほうが真実。控えの質問に重ねる（並びは作った順＝聞いた順）
    const { data: qs } = await c
      .from('questions').select('body, answer').eq('work_id', id).order('created_at');
    const byBody = new Map((qs ?? []).map((q) => [q.body, q.answer ?? undefined]));

    return {
      id: w.id as string, title: w.title as string, goal: w.goal as string,
      container: d.container, hires: d.hires, plan: d.plan, real: d.real,
      questions: d.questions.map((q) => ({ ...q, answer: byBody.get(q.body) ?? q.answer })),
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

  async answer(id, index, answer) {
    const c = await db();
    const { data: qs } = await c
      .from('questions').select('id').eq('work_id', id).order('created_at');
    const row = qs?.[index];
    if (!row) return;
    await c.from('questions')
      .update({ answer, answered_at: new Date().toISOString() })
      .eq('id', row.id);
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
    if (!w) throw new Error('その計画は見つかりませんでした');
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
        if (error) throw new Error(error.message);
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
      if (error) throw new Error(error.message);

      // ③ そのフェーズのタスクに担当を割り当てる。**状態は queued のまま**
      if (crew.length) {
        const { error: e2 } = await c.from('tasks')
          .update({ assignee_type: 'employee', assignee_employee_id: crew[0].id })
          .eq('phase_id', first.id).eq('status', 'queued');
        if (e2) throw new Error(e2.message);
      }
    }

    // ④ 最後に Work 自身
    const { error } = await c.from('works').update({
      status: 'active', started_at: new Date().toISOString(), current_phase_id: first?.id ?? null,
    }).eq('id', id);
    if (error) throw new Error(error.message);

    // 台帳（`audit_events`）はここでは書かない。**引き金が書く**
    // （`authenticated` に insert が無い。0008_works_audit.sql）
  },

  /** 計画を引き直す。**前のフェーズとタスクは消して入れ替える**（版を持つのは成果物だけ） */
  async revise(id, next) {
    const c = await db();
    const { data: w } = await c.from('works').select('status').eq('id', id).maybeSingle();
    if (!w) throw new Error('その計画は見つかりませんでした');
    if (w.status !== 'plan_review') throw new Error('もう承認された計画は直せません');

    await c.from('tasks').delete().eq('work_id', id);
    await c.from('phases').delete().eq('work_id', id);
    await c.from('questions').delete().eq('work_id', id);

    const { error } = await c.from('works')
      .update({ title: next.title, goal: next.goal, plan_draft: body(next) as never })
      .eq('id', id);
    if (error) throw new Error(error.message);

    await writePlan(c, id, next);
    // スレッドは残す（相談の行き先は計画を引き直しても変わらない）
    await writeQuestions(c, id, await threadFor(c, id, next.title), next);
  },

  async getWork(id) {
    const c = await db();
    const { data: w } = await c
      .from('works').select('id, title, goal, status, started_at, plan_draft').eq('id', id).maybeSingle();
    if (!w) return null;

    const [{ data: ph }, { data: tk }] = await Promise.all([
      c.from('phases').select('id, seq, name, goal, status').eq('work_id', id).order('seq'),
      c.from('tasks').select('id, phase_id, title, intent, status, assignee_employee_id').eq('work_id', id).order('created_at'),
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
        owner: t.assignee_employee_id ? em.get(t.assignee_employee_id)?.display_name : undefined,
      })),
      crew: [...em.values()].map((e) => ({
        id: e.id, name: e.display_name,
        color: AGENT_COLOR[e.color_token as EmployeeColor] ?? '#5C6BC0',
      })),
      startedAt: (w.started_at ?? undefined) as string | undefined,
    };
  },
};
