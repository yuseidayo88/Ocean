import { MAX_NODES, type Workflow } from './types';

/**
 * 図の検証。**archify の「9つの検査を全部通してから出す」を、CLI 無しで回す。**
 *
 * archify は `archify.mjs validate` を通してから `deliver` する決まりで、
 * 「通ったら凍結して編集しない」まで書いてある。ここではその考え方だけ引き継ぐ —
 * **通らない図は成果物にしない。** 直せなければ、直せなかったと正直に言う。
 *
 * 見るのは9つ。どれも**絵が壊れる**か**読めなくなる**ものだけにしてある
 * （通らない規則を並べない → CLAUDE.md の eslint と同じ考え）。
 */
export type Diag = { rule: string; says: string };

export function checkWorkflow(w: Workflow): Diag[] {
  const bad: Diag[] = [];
  const say = (rule: string, says: string) => bad.push({ rule, says });

  const nodes = w.nodes ?? [];
  const edges = w.edges ?? [];
  const ids = nodes.map((n) => n.id);
  const has = new Set(ids);

  // ① id は1つずつ。同じ id が2つあると、線がどちらに繋がるか決まらない
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) say('id が重複', `${[...new Set(dup)].join('・')} が2つ以上あります`);

  // ② 線の両端が実在する。無い先に引くと、線が宙に出る
  for (const e of edges) {
    if (!has.has(e.from)) say('線の元がいない', `${e.from} → ${e.to} の ${e.from}`);
    if (!has.has(e.to)) say('線の先がいない', `${e.from} → ${e.to} の ${e.to}`);
  }

  // ③ レーンが実在する。無いレーンに置くと、行が決まらない
  const lanes = new Set((w.lanes ?? []).map((l) => l.id));
  for (const n of nodes) if (!lanes.has(n.lane)) say('レーンがいない', `${n.label} の ${n.lane}`);

  // ④ **主線は1本、2つ以上、順に繋がっている**（archify の作法の核）
  const mp = w.mainPath ?? [];
  if (mp.length < 2) say('主線が無い', '主線は2つ以上のノードで書きます');
  for (const id of mp) if (!has.has(id)) say('主線に居ないノード', id);
  const link = new Set(edges.map((e) => `${e.from}>${e.to}`));
  for (let i = 0; i + 1 < mp.length; i++) {
    if (!link.has(`${mp[i]}>${mp[i + 1]}`)) say('主線が切れている', `${mp[i]} → ${mp[i + 1]} の線がありません`);
  }

  // ⑤ 主要ノードは12まで（多いと、一目で読めない）
  if (nodes.length > MAX_NODES) say('ノードが多すぎる', `${nodes.length}個（${MAX_NODES}個まで）`);

  // ⑥ 迷子を作らない。どこからも線が来ず、どこへも行かないノードを置かない
  const touched = new Set<string>();
  for (const e of edges) { touched.add(e.from); touched.add(e.to); }
  for (const n of nodes) {
    if (!touched.has(n.id) && !mp.includes(n.id)) say('迷子のノード', `${n.label} はどの線とも繋がっていません`);
  }

  // ⑦ **枝は、いちばん近い主線のノードから出る**（archify の作法）
  const onMain = new Set(mp);
  for (const e of edges) {
    if ((e.role ?? 'main') !== 'branch') continue;
    if (!onMain.has(e.from)) say('枝の出どころ', `${e.from} は主線の上にいません`);
  }

  // ⑧ 同じレーンの同じ列に2つ置かない（格子の上で重なる）
  const cell = new Map<string, string>();
  for (const n of nodes) {
    const k = `${n.lane}:${n.col}`;
    const was = cell.get(k);
    if (was) say('同じ場所に2つ', `${was} と ${n.label}`);
    cell.set(k, n.label);
  }

  // ⑨ ラベルが空でない・同じ名前を2つ置かない（どちらか分からなくなる）
  const seen = new Set<string>();
  for (const n of nodes) {
    const t = (n.label ?? '').trim();
    if (!t) { say('名前が無い', n.id); continue; }
    if (seen.has(t)) say('同じ名前が2つ', t);
    seen.add(t);
  }

  return bad;
}

/** 統括AI・社員に返す言葉（直してもらうため）。**何が悪いかだけ言う** */
export const sayDiags = (d: Diag[]): string =>
  d.map((x) => `- ${x.rule}: ${x.says}`).join('\n');
