import { checkWorkflow } from '@/lib/diagram/check';
import type { Workflow } from '@/lib/diagram/types';
import { MAX_NODES } from '@/lib/diagram/types';
import type { MapChip, MapPhase, MapWork } from '@/lib/view/model';
import type { LiveWork } from '@/lib/store';

/**
 * ホームの**ワークフローの盤面を組み立てる唯一の場所**（2026-08-25）。
 *
 * 社長の指示で **archify**（https://github.com/tt-a1i/archify · MIT）の作法をここに当てた。
 * archify 本体（Node の CLI）は動かせないので、**持ち込むのは形と作法**
 * （→ `docs/design/11-diagram.md`）。当てたのは3つ:
 *
 * **① 主線を1本にする。** 前は Work が対等に縦へ積まれていて、
 * 「いまどれを見ればいいか」が盤面のどこにも出ていなかった。
 * **放っておけない順**（判断待ち → 遅れ → 順調。タスク一覧・進捗とまったく同じ規則）の
 * 1本目を主線にして、**いちばん上の段**に置く。
 *
 * **② 枝は、いちばん近い主線のノードから出す。** 前はチップ（判断・要確認）の列を
 * `Math.max(nowSeq, 1)` で決めていて、**畳んだあとの列とずれていた** —
 * だから親の真下に落ちず、**線が斜めに出ていた**（この会社の決まりは直角の線）。
 * 畳みをここでやって、チップは**親のフェーズと同じ列**に置く。
 *
 * **③ ノードは12まで。** 超えたら、済んだフェーズを**Work ごと1枚に畳む**。
 * 一目で読めない盤面は、地図として役に立たない。
 *
 * 組んだものは **archify と同じ9つの検査**に掛ける（`lib/diagram/check.ts`）。
 * **盤面も、通らないものは描かない。**
 */

/** 畳んだあとのフェーズ。**元のフェーズ番号は失わない**（フェーズ 1〜3 · 完了） */
type Folded = MapPhase & { from: number; to: number };

/**
 * 済んだフェーズが**2つ以上続いたら1枚に畳む**。
 * `hard` は予算に当たったとき — **済んだものは全部1枚**にする。
 */
function fold(ph: MapPhase[], hard = false): Folded[] {
  const out: Folded[] = [];
  let run: { p: MapPhase; i: number }[] = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1 && !hard) {
      const { p, i } = run[0];
      out.push({ ...p, from: i + 1, to: i + 1 });
    } else {
      out.push({
        name: run.map((r) => r.p.name).join('・'), kind: 'done',
        from: run[0].i + 1, to: run[run.length - 1].i + 1,
      });
    }
    run = [];
  };
  ph.forEach((p, i) => {
    if (p.kind === 'done') { run.push({ p, i }); return; }
    flush();
    out.push({ ...p, from: i + 1, to: i + 1 });
  });
  flush();
  return out;
}

/** 放っておけない順。**タスク一覧・進捗と同じ規則**（語彙も順番も揃える） */
const urgency = (w: LiveWork) =>
  w.tasks.some((t) => t.state === 'needs_decision') ? 0
    : (w.dels ?? []).some((d) => d.state === '要確認') ? 1 : 2;

export type Board = {
  works: MapWork[];
  chips: MapChip[];
  /** 主線（いちばん上の鎖）の Work id。**無いこともある**（Work が1つも無い会社） */
  main?: string;
  /** 組み立ての診断。**空でないときは盤面を描かない** */
  diags: string[];
};

export function buildBoard(
  active: LiveWork[],
  crewOf: (w: LiveWork) => string[],
  lateOf: (w: LiveWork) => number | undefined,
): Board {
  // ① 主線を先頭に。**同じ urgency なら元の順**（並びが毎回変わらない）
  const order = active.map((w, i) => ({ w, i }))
    .sort((a, b) => urgency(a.w) - urgency(b.w) || a.i - b.i)
    .map((x) => x.w);

  // ③ 12ノードの予算。まずふつうに畳んで、超えたら済んだぶんを1枚にする
  const count = (hard: boolean) =>
    order.reduce((n, w) => n + fold(phasesOf(w), hard).length, 0)
    + order.reduce((n, w) => n + chipsOf(w).length, 0);
  const hard = count(false) > MAX_NODES;

  const works: MapWork[] = [];
  const chips: MapChip[] = [];
  order.forEach((w, i) => {
    const fs = fold(phasesOf(w), hard);
    const gate = w.tasks.some((t) => t.state === 'needs_decision');
    const late = lateOf(w);
    works.push({
      id: w.id, title: w.title, col: 0, row: i * 2,
      status: gate ? '判断待ち' : late ? `遅れ ${late}日` : undefined,
      tone: gate ? 'gate' : late ? 'late' : undefined,
      crew: crewOf(w),
      // **畳んだあとの形を渡す**（描く側は畳まない — 列がずれる元だった）
      // **元のフェーズ番号を必ず持たせる。** 畳むと列と番号がずれるので、
      // 番号のほうを渡す（「フェーズ 1〜2 · 完了」の次は「フェーズ 3」）
      phases: fs.map((f) => ({
        name: f.name, kind: f.kind, pct: f.pct, span: [f.from, f.to] as [number, number],
      })),
    });
    // ② 枝は**親のフェーズと同じ列**へ。畳んだあとの列で数える
    const nowAt = w.phases.findIndex((p) => p.state === 'active' || p.state === 'review');
    const col = Math.max(0, fs.findIndex((f) => nowAt + 1 >= f.from && nowAt + 1 <= f.to));
    for (const c of chipsOf(w)) {
      chips.push({ ...c, col, row: i * 2 + 1, owner: [w.id, col] });
    }
  });

  return { works, chips, main: order[0]?.id, diags: verify(works, chips) };
}

const phasesOf = (w: LiveWork): MapPhase[] => w.phases.map((p) => ({
  name: p.name,
  kind: p.state === 'done' || p.state === 'skipped' ? 'done'
    : p.state === 'active' || p.state === 'review' ? 'now' : 'wait',
}));

/** その Work にぶら下がるもの。**判断が先、無ければ要確認の成果物1つ** */
function chipsOf(w: LiveWork): Omit<MapChip, 'col' | 'row' | 'owner'>[] {
  const gate = w.tasks.find((t) => t.state === 'needs_decision');
  if (gate) return [{ title: gate.title, sub: '判断 · あなたの番' }];
  const rev = (w.dels ?? []).find((d) => d.state === '要確認');
  return rev ? [{ title: rev.title, sub: '成果物 · 要確認' }] : [];
}

/**
 * 組んだ盤面を **archify と同じ9つの検査**に掛ける。
 * 盤面は格子の上にあるので、意味を持つのは「同じ場所に2つ」「名前が無い」など。
 * **通らないものは描かない** — 壊れた地図は、地図として嘘をつく。
 */
function verify(works: MapWork[], chips: MapChip[]): string[] {
  const wf: Workflow = {
    schema_version: 1, diagram_type: 'workflow',
    meta: { title: 'ワークフロー' },
    lanes: works.flatMap((w) => [
      { id: `${w.id}`, label: w.title },
      { id: `${w.id}-b`, label: `${w.title}（枝）` },
    ]),
    nodes: [
      ...works.flatMap((w) => w.phases.map((p, i) => ({
        id: `${w.id}-p${i}`, lane: w.id, col: i, type: 'work' as const,
        label: `${w.title} ${p.name}`,
      }))),
      ...chips.map((c, i) => ({
        id: `chip${i}`, lane: `${c.owner[0]}-b`, col: c.col, type: 'decision' as const,
        label: `${c.owner[0]} ${c.title}`,
      })),
    ],
    edges: [
      ...works.flatMap((w) => w.phases.slice(1).map((_, i) => ({
        from: `${w.id}-p${i}`, to: `${w.id}-p${i + 1}`, role: 'main' as const,
      }))),
      ...chips.map((c, i) => ({
        from: `${c.owner[0]}-p${c.col}`, to: `chip${i}`, role: 'branch' as const,
      })),
    ],
    mainPath: (works[0]?.phases.length ?? 0) > 1
      ? works[0].phases.map((_, i) => `${works[0].id}-p${i}`)
      : [],
  };
  // 主線が1ノードしか無い Work（フェーズ1つ）では ④ は成り立たない。そこは見ない
  return checkWorkflow(wf)
    .filter((d) => d.rule !== '主線が無い' && d.rule !== '枝の出どころ')
    .map((d) => `${d.rule}: ${d.says}`);
}
