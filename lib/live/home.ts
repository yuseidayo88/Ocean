import type { AgentPref, LiveEmployee, LiveWork, Note, RunStep } from '@/lib/store/types';
import { prefWords } from '@/lib/view/model';
import { buildBoard } from './flow';
import type {
  DeskBody, Event, Lane, MapChip, MapWork, Produce, Ring, State, Work,
} from '@/lib/view/model';

/**
 * live のデータ → ホーム4ビューの絵の形。**ここが唯一の変換点。**
 *
 * 決めごと:
 *   ・**無いものは無いと出す。** 週数の無い計画は等分で置き、日付は書かない。
 *     進捗が 0 の輪は弧を引かない（始まっていないものを進んでいるように見せない）
 *   ・進捗＝終わったタスク／全タスク。tasks.progress は run_steps の導出値のまま使う
 *   ・遅れ＝計画の週数に対して今日がどこか（実測）。予定の無い Work に遅れは無い
 */

export type StaffCard = {
  id: string; name: string; state: State; now: string;
  /**
   * いま選ばれているモデルの名前（メンバー画面で選んだもの）。
   * **深さはここに出さない** — 言葉が長く（「いちばん深く」）、状態の語と1行に収まらない。
   * 深さはつまみのあるメンバー画面で見る（同じことを2か所で言わない）。
   */
  model: string;
  color: string;
  desk: { el: string; step: { done: number; all: number; name: string }; produce: Produce; wait: number };
};

export type HomeData = {
  /** 統括AIのモデル（オフィスの先頭のカード） */
  exec: { model: string };
  works: Work[];
  events: Event[];
  staff: StaffCard[];
  lanes: Lane[];
  idle: { id: string; name: string; color: string }[];
  /** ワークフローの盤面（組み立ては `lib/live/flow.ts`。archify の作法と検査つき） */
  map: { works: MapWork[]; chips: MapChip[]; diags: string[] };
  ticks: { x: number; label: string }[];
  todayX: number;
  done: { id: string; title: string; ended: string; phases: number }[];
  /** 判断待ちと遅れの数。答えの1行が言う */
  gates: number; late: number;
};

const DAY = 24 * 3600 * 1000;
const md = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };

/** フェーズの重み（弧とガントの幅）。週数があれば週数、無ければ等分 */
const weight = (w: LiveWork) => {
  const ws = w.phases.map((p) => p.weeks ?? 0);
  return ws.some((x) => x > 0) ? ws.map((x) => Math.max(x, 0.5)) : w.phases.map(() => 1);
};

const phaseTasks = (w: LiveWork, phaseId: string) => w.tasks.filter((t) => t.phaseId === phaseId);

/** フェーズの進み（0-1）。終わったタスク＋走っているタスクの自己申告 */
function phaseDone(w: LiveWork, phaseId: string): number {
  const ts = phaseTasks(w, phaseId);
  if (!ts.length) return 0;
  const sum = ts.reduce((a, t) => a + (t.state === 'done' ? 100 : t.progress ?? 0), 0);
  return Math.min(1, sum / (ts.length * 100));
}

/** Work 全体の進み（%）。フェーズの重みで合成する */
function workPct(w: LiveWork): number {
  const ws = weight(w);
  const total = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  w.phases.forEach((p, i) => {
    const r = p.state === 'done' ? 1 : p.state === 'skipped' ? 1 : phaseDone(w, p.id);
    acc += (ws[i] / total) * r;
  });
  return Math.round(acc * 100);
}

/** その社員の色。crew に居なければ灰（担当が未定のフェーズ） */
const colorOf = (w: LiveWork, name?: string) =>
  w.crew.find((c) => c.name === name)?.color ?? '#5F5F5F';

export function buildHome(
  works: LiveWork[],
  employees: LiveEmployee[],
  notes: Note[],
  steps: { at?: string; who: string; what: string }[],
  stepsByTask: Map<string, RunStep[]>,
  prefs: AgentPref[] = [],
): HomeData {
  /** 設定 → 画面の言葉。**選んでいない人は既定の姿**（実行もそれで走る） */
  const wordsFor = (id: string | null, who: 'exec' | 'employee') =>
    prefWords(who, prefs.find((x) => x.employeeId === id));
  const active = works.filter((w) => w.status !== 'done' && w.status !== 'archived');
  const finished = works.filter((w) => w.status === 'done');
  const now = Date.now();

  /* ── 会社の時間軸（ガント）。開始の最小 〜 計画の終わりの最大 ── */
  const spans = active.map((w) => {
    const start = w.startedAt ? new Date(w.startedAt).getTime() : now;
    const weeks = w.phases.reduce((a, p) => a + (p.weeks ?? 0), 0) || w.phases.length;
    return { w, start, end: start + weeks * 7 * DAY };
  });
  const min = spans.length ? Math.min(...spans.map((s) => s.start)) : now;
  const max = spans.length ? Math.max(...spans.map((s) => s.end), now + DAY) : now + 7 * DAY;
  const range = Math.max(max - min, DAY);
  const px = (t: number) => Math.max(0, Math.min(100, ((t - min) / range) * 100));
  const todayX = px(now);
  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i <= 4; i++) ticks.push({ x: i * 25, label: md(min + (range * i) / 4) });

  /* ── Work ごとの絵 ── */
  const LABEL_DEG = [198, 225, 242, 210, 232];
  const view: Work[] = spans.map(({ w, start, end }, wi) => {
    const ws = weight(w);
    const total = ws.reduce((a, b) => a + b, 0);
    const gateTask = w.tasks.find((t) => t.state === 'needs_decision');
    const pct = workPct(w);

    // ガントのフェーズ帯（%）と、遅れ（いま active の帯を今日が過ぎているか）
    let acc = 0;
    let lateDays = 0;
    const phases = w.phases.map((p, i) => {
      const x = px(start + (acc / total) * (end - start));
      const to = start + ((acc + ws[i]) / total) * (end - start);
      const xEnd = px(to);
      acc += ws[i];
      const st = p.state === 'done' || p.state === 'skipped' ? 'done'
        : p.state === 'active' || p.state === 'review' ? 'now' : 'next';
      if (st === 'now' && now > to) lateDays = Math.max(lateDays, Math.ceil((now - to) / DAY));
      const ts = phaseTasks(w, p.id);
      const hasWeeks = w.phases.some((q) => q.weeks);
      return {
        name: p.name, goal: p.goal, state: st as 'done' | 'now' | 'next',
        x, w: Math.max(xEnd - x, 1.5),
        done: ts.filter((t) => t.state === 'done').length, all: ts.length,
        // 日付は計画（週数）があるときだけ書く。でっち上げない
        from: hasWeeks ? md(start + ((acc - ws[i]) / total) * (end - start)) : '',
        to: hasWeeks ? md(to) : '',
        owner: undefined,
      };
    });

    /* 輪。弧はフェーズごとに1本、担当の色。tip＝全体の進み。0 なら弧を引かない */
    const segs: Ring['segs'] = [];
    let arcAcc = 0;
    w.phases.forEach((p, i) => {
      const share = (ws[i] / total) * 100;
      const fill = p.state === 'done' || p.state === 'skipped' ? 1 : phaseDone(w, p.id);
      if (fill <= 0) { arcAcc += 0; return; }
      const to = Math.min(pct, arcAcc + share * fill);
      if (to > arcAcc + 0.5) {
        const owner = phaseTasks(w, p.id).find((t) => t.owner)?.owner;
        segs.push({ to, color: colorOf(w, owner) });
        arcAcc = to;
      }
    });
    const tip = segs.length ? segs[segs.length - 1].to : 0;

    // 予定に対して今日がどこか。実測が予定より後ろなら、赤い点線で差を見せる
    const plannedPct = Math.round(((now - start) / (end - start)) * 100);
    const behind = w.status === 'active' && plannedPct > tip + 4 && tip > 0
      ? Math.min(plannedPct, 100) : undefined;

    // 球＝いまのフェーズの担当。自分の弧のまん中に立つ
    const nowPhase = w.phases.find((p) => p.state === 'active' || p.state === 'review');
    const nowOwnerName = nowPhase ? phaseTasks(w, nowPhase.id).find((t) => t.owner)?.owner : undefined;
    const nowOwner = w.crew.find((c) => c.name === nowOwnerName);
    const running = w.tasks.some((t) => t.state === 'running');
    const crew: Ring['crew'] = nowOwner && tip > 0
      ? [{ id: nowOwner.id, at: Math.max(tip * 0.6, 1), gate: !!gateTask,
           name: nowOwner.name, color: nowOwner.color, run: running }]
      : [];

    const phaseIndex = nowPhase?.seq ?? w.phases.length;
    const restDays = Math.max(0, Math.ceil((end - now) / DAY));
    const hasWeeks = w.phases.some((q) => q.weeks);

    return {
      id: w.id, title: w.title, goal: w.goal,
      phaseIndex, progress: pct,
      health: lateDays > 0 ? { late: lateDays } : '順調',
      state: (gateTask ? '判断待ち' : running ? '実行中' : '待機') as State,
      restDays, endDate: hasWeeks ? md(end) : '',
      phases,
      crew: nowOwner ? [{
        id: nowOwner.id, x: Math.min(todayX + 2, 96), ring: tip,
        name: nowOwner.name, color: nowOwner.color, dim: !running,
      }] : [],
      gate: gateTask ? { x: todayX, label: gateTask.title } : undefined,
      over: undefined,
      ring: {
        segs, tip, behind,
        labelDeg: LABEL_DEG[wi % LABEL_DEG.length],
        crew,
      },
    };
  });

  /* ── ログ（右の列）。通知と歩みを1本に ── */
  const hm = (at?: string) => at ? new Date(at).toTimeString().slice(0, 5) : '';
  const events: Event[] = [
    ...notes.map((n): Event & { t: string } => ({
      at: hm(n.at), who: '統括AI', what: n.body,
      tone: n.kind === 'エラー' ? 'bad' : n.kind === '判断待ち' ? 'gate' : 'ok',
      t: n.at ?? '',
    })),
    ...steps.map((s): Event & { t: string } => ({ at: hm(s.at), who: s.who, what: s.what, t: s.at ?? '' })),
  ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 30);

  /* ── 社員のカードとデスクのレーン ── */
  const delsBy = new Map<string, { title: string; preview?: string; review: number; count: number }>();
  for (const w of active.concat(finished)) {
    for (const d of w.dels ?? []) {
      const cur = delsBy.get(d.by ?? '') ?? { title: '', preview: undefined, review: 0, count: 0 };
      cur.count += 1;
      if (d.state === '要確認') cur.review += 1;
      if (!cur.title) { cur.title = d.title; cur.preview = d.preview; }
      delsBy.set(d.by ?? '', cur);
    }
  }

  const taskOf = (e: LiveEmployee) => {
    for (const w of active) {
      const t = w.tasks.find((x) => x.ownerId === e.id && x.state === 'running');
      if (t) return { w, t };
    }
    for (const w of active) {
      const t = w.tasks.find((x) => x.owner === e.name && x.state === 'running');
      if (t) return { w, t };
    }
    return null;
  };

  const dur = (a?: string, b?: string) => {
    if (!a || !b) return '';
    const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
    return s < 90 ? `${s}s` : `${Math.round(s / 60)}m`;
  };

  const staff: StaffCard[] = [];
  const lanes: Lane[] = [];
  const idle: { id: string; name: string; color: string }[] = [];

  for (const e of employees) {
    const at = taskOf(e);
    const my = delsBy.get(e.name) ?? { title: '', preview: undefined, review: 0, count: 0 };
    const ts = at ? stepsByTask.get(at.t.id) ?? [] : [];
    const last = ts[ts.length - 1];
    const stepName = last?.summary ?? (at ? '準備しています' : '');
    const produce: Produce = my.count
      ? { kind: 'squares', n: Math.min(Math.max(my.count, 4), 8), filled: my.count, cap: `成果物 ${my.count}` }
      : { kind: 'text', cap: 'まだ何も出していません' };

    staff.push({
      id: e.id, name: e.name, color: e.color,
      state: at ? '実行中' : '待機',
      now: at ? at.t.title : '仕事を待っています',
      model: wordsFor(e.id, 'employee').label,
      desk: {
        el: '',
        step: { done: ts.length, all: at ? ts.length + 1 : ts.length, name: stepName },
        produce, wait: my.review,
      },
    });

    if (at) {
      const body: DeskBody = my.preview && my.title
        ? { kind: 'text', file: my.title, lines: (my.preview ?? '').split(/(?<=。)/).filter(Boolean).slice(0, 3) }
        : { kind: 'facts', cap: '歩み', n: ts.length, items: ts.slice(-3).map((x) => x.summary ?? '').filter(Boolean) };
      lanes.push({
        id: e.id, name: e.name, color: e.color, role: undefined,
        state: '実行中',
        line: last?.summary ? `${last.summary}` : `「${at.t.title}」に取りかかっています`,
        steps: ts.slice(-4).map((x, i, arr): [string, string] => [
          x.summary ?? '', dur(x.at, arr[i + 1]?.at ?? new Date().toISOString()),
        ]),
        body,
        task: at.t.title, taskId: at.t.id, pct: at.t.progress ?? 0,
        elapsed: '',
      });
    } else {
      idle.push({ id: e.id, name: e.name, color: e.color });
    }
  }

  /**
   * ── ワークフローの地図 ──
   * **組み立ては `lib/live/flow.ts` に1か所。** archify の作法（主線1本 /
   * 枝は最寄りの主線ノードから / ノードは12まで）と、9つの検査がそこに入っている。
   * ここは live から必要な値を渡すだけ。
   */
  const board = buildBoard(
    active,
    (w) => {
      const nowPhase = w.phases.find((p) => p.state === 'active' || p.state === 'review');
      return nowPhase
        ? [...new Set(phaseTasks(w, nowPhase.id).map((t) => colorOf(w, t.owner)).filter((c) => c !== '#5F5F5F'))]
        : [];
    },
    (w) => {
      const h = view[active.indexOf(w)]?.health;
      return typeof h === 'object' ? h.late : undefined;
    },
  );

  return {
    exec: { model: wordsFor(null, 'exec').label },
    works: view,
    events,
    staff, lanes, idle,
    map: board,
    ticks, todayX,
    done: finished.map((w) => ({ id: w.id, title: w.title, ended: '', phases: w.phases.length })),
    gates: view.filter((v) => v.gate).length,
    late: view.filter((v) => typeof v.health === 'object').length,
  };
}
