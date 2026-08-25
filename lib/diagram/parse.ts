import { checkWorkflow, type Diag } from './check';
import type { DiagramEdge, DiagramLane, DiagramNode, DiagramPhase, EdgeRole, NodeType, Workflow } from './types';

/**
 * 道具から来た値を、図の形に写す。**型を被せるだけにしない** —
 * 足りない鍵は落とし、知らない語は既定に倒す（→ `lib/exec/parse.ts` と同じ考え）。
 */
const S = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; };

const TYPES: NodeType[] = ['work', 'decision', 'deliverable', 'wait', 'end'];
const ROLES: EdgeRole[] = ['main', 'branch', 'async', 'return', 'error'];

export function toWorkflow(a: Record<string, unknown>): Workflow {
  const rows = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    schema_version: 1,
    diagram_type: 'workflow',
    meta: { title: S(a.title, 40) || '図', subtitle: S(a.subtitle, 80) || undefined },
    lanes: rows(a.lanes).map((l): DiagramLane => ({
      id: S(l.id, 40), label: S(l.label, 40),
      variant: l.variant === 'exception' ? 'exception' : 'normal',
    })).filter((l) => l.id && l.label),
    phases: rows(a.phases).map((p): DiagramPhase => ({
      id: S(p.id, 40), label: S(p.label, 40), fromCol: N(p.fromCol), toCol: N(p.toCol),
    })).filter((p) => p.label),
    nodes: rows(a.nodes).map((n): DiagramNode => ({
      id: S(n.id, 40), lane: S(n.lane, 40), col: N(n.col),
      type: TYPES.find((t) => t === n.type) ?? 'work',
      label: S(n.label, 60), sublabel: S(n.sublabel, 60) || undefined,
    })).filter((n) => n.id),
    edges: rows(a.edges).map((e): DiagramEdge => ({
      from: S(e.from, 40), to: S(e.to, 40), label: S(e.label, 30) || undefined,
      role: ROLES.find((r) => r === e.role) ?? 'main',
    })).filter((e) => e.from && e.to),
    mainPath: (Array.isArray(a.mainPath) ? a.mainPath : []).map((x) => S(x, 40)).filter(Boolean),
  };
}

/**
 * 成果物に入れる形。**IR は archify のまま**にして、こちらの都合は外側に持つ。
 * `unresolved` は「2回やっても直らなかった診断」— archify の
 * 「直らなかったものは正直に報告する」をそのまま守るための欄。
 */
export type DiagramDoc = { workflow: Workflow; unresolved?: string[] };

export const packDoc = (workflow: Workflow, unresolved?: Diag[]): string =>
  JSON.stringify(unresolved?.length
    ? { workflow, unresolved: unresolved.map((d) => `${d.rule}: ${d.says}`) }
    : { workflow });

/** 成果物の本文から図を読む。**読めなければ null**（画面は「図が読めません」と出す） */
export function readDoc(body?: string): DiagramDoc | null {
  if (!body) return null;
  try {
    const o = JSON.parse(body) as DiagramDoc;
    if (!o?.workflow?.nodes?.length) return null;
    return o;
  } catch { return null; }
}

/**
 * **絵が壊れるものと、読みにくいだけのものを分ける。**
 * 壊れるほうは出さない（直してもらう）。読みにくいだけなら出して、
 * 直らなかったことを成果物に残す。
 */
const FATAL = new Set(['id が重複', '線の元がいない', '線の先がいない', 'レーンがいない', '同じ場所に2つ', '名前が無い']);
export const fatalOf = (d: Diag[]) => d.filter((x) => FATAL.has(x.rule));
export { checkWorkflow };

/**
 * 一覧に出す書き出し。**灰色の棒を置かない**（→ CLAUDE.md 成果物）。
 * 図の「書き出し」は**主線**（いちばん通ってほしい道）— これが読めれば、
 * 開かなくても何の図か分かる。
 */
export function previewOf(body: string): string | null {
  const doc = readDoc(body);
  if (!doc) return null;
  const at = new Map(doc.workflow.nodes.map((n) => [n.id, n.label]));
  const road = doc.workflow.mainPath.map((id) => at.get(id)).filter(Boolean);
  return road.length ? road.join(' → ').slice(0, 90) : doc.workflow.meta.title;
}
