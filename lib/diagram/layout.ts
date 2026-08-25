import type { DiagramEdge, Workflow } from './types';

/**
 * 格子の上に置く。**位置を目分量でずらさない**（→ CLAUDE.md ワークフロー）。
 * 列は `col`、行はレーンの並び順で決まる。図を書く側は座標を持たない。
 *
 * 寸法はワークフローの地図と同じ語彙にしてある — ノード 176×60、
 * 列 198px おき、段 104px おき。**同じ会社の中で2つの図法を作らない。**
 */
export const NW = 176, NH = 60;
export const COLW = 198, ROWH = 104;
const PAD_X = 28, PAD_TOP = 34, PAD_BOTTOM = 34;
/** 帯（フェーズ名）の高さ。無ければ 0 */
const BAND = 26;
/** 戻りの線が通る、いちばん下の道 */
const RETURN_LANE = 34;

export type Placed = {
  id: string; x: number; y: number; w: number; h: number;
  label: string; sublabel?: string; type: string; lane: string; col: number;
  /** 例外のレーンにいるか（点線で沈める） */
  faint: boolean;
};
export type Wire = { d: string; label?: string; lx: number; ly: number; role: string; faint: boolean };
export type Band = { x: number; w: number; label: string };
export type LaneRow = { y: number; label: string; faint: boolean };

export type Laid = {
  w: number; h: number;
  nodes: Placed[]; wires: Wire[]; bands: Band[]; lanes: LaneRow[];
};

/** 直角に曲がる線（角だけ丸める）。**斜めにしない** — 線がどこへ行くのか目で追えるように */
function elbow(pts: [number, number][], r = 12) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x1 - x0) / l1, uy = (y1 - y0) / l1, vx = (x2 - x1) / l2, vy = (y2 - y1) / l2;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    d += ` L ${(x1 - ux * rr).toFixed(1)} ${(y1 - uy * rr).toFixed(1)}`;
    d += ` Q ${x1} ${y1} ${(x1 + vx * rr).toFixed(1)} ${(y1 + vy * rr).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

export function layout(wf: Workflow): Laid {
  const lanes = wf.lanes ?? [];
  const laneAt = new Map(lanes.map((l, i) => [l.id, i]));
  const bandH = (wf.phases?.length ?? 0) ? BAND : 0;

  const x = (col: number) => PAD_X + col * COLW;
  const y = (lane: string) => PAD_TOP + bandH + (laneAt.get(lane) ?? 0) * ROWH;

  const nodes: Placed[] = (wf.nodes ?? []).map((n) => ({
    id: n.id, x: x(n.col), y: y(n.lane), w: NW, h: NH,
    label: n.label, sublabel: n.sublabel, type: n.type, lane: n.lane, col: n.col,
    faint: lanes.find((l) => l.id === n.lane)?.variant === 'exception',
  }));
  const at = new Map(nodes.map((n) => [n.id, n]));

  const cols = Math.max(1, ...(wf.nodes ?? []).map((n) => n.col + 1));
  const rows = Math.max(1, lanes.length);
  const back = (wf.edges ?? []).some((e) => (at.get(e.to)?.col ?? 0) <= (at.get(e.from)?.col ?? 0));
  const W = PAD_X * 2 + (cols - 1) * COLW + NW;
  const H = PAD_TOP + bandH + (rows - 1) * ROWH + NH + (back ? RETURN_LANE : 0) + PAD_BOTTOM;

  /** 戻りの線が通る高さ（いちばん下の段の、さらに下） */
  const floor = PAD_TOP + bandH + (rows - 1) * ROWH + NH + RETURN_LANE / 2;

  const wires: Wire[] = [];
  for (const e of wf.edges ?? []) {
    const a = at.get(e.from), b = at.get(e.to);
    if (!a || !b) continue;                    // 検証で弾いてあるが、描く側でも落とさない
    wires.push(wire(a, b, e, floor));
  }

  const bands: Band[] = (wf.phases ?? []).map((p) => ({
    x: x(p.fromCol) - 8, w: (p.toCol - p.fromCol) * COLW + NW + 16, label: p.label,
  }));

  return {
    w: W, h: H, nodes, wires, bands,
    lanes: lanes.map((l) => ({ y: y(l.id), label: l.label, faint: l.variant === 'exception' })),
  };
}

/**
 * 1本の線を引く。**道は3つだけ**（覚える形を増やさない）:
 *   ・同じ段で右へ → まっすぐ
 *   ・段が変わる → 右に出て、列の隙間を縦に降り（昇り）、左から入る
 *   ・戻る（左へ） → 下に出て、いちばん下の道を通り、下から入る
 */
function wire(a: Placed, b: Placed, e: DiagramEdge, floor: number): Wire {
  const role = e.role ?? 'main';
  const faint = a.faint || b.faint;
  const ay = a.y + a.h / 2, by = b.y + b.h / 2;
  let pts: [number, number][];
  let lx: number, ly: number;

  if (b.col <= a.col) {
    // 戻り。いちばん下の道を通す（ノードの上を横切らない）
    const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
    pts = [[ax, a.y + a.h], [ax, floor], [bx, floor], [bx, b.y + b.h]];
    lx = (ax + bx) / 2; ly = floor - 8;
  } else if (a.y === b.y) {
    pts = [[a.x + a.w, ay], [b.x, by]];
    lx = (a.x + a.w + b.x) / 2; ly = ay - 9;
  } else {
    const mid = (a.x + a.w + b.x) / 2;
    pts = [[a.x + a.w, ay], [mid, ay], [mid, by], [b.x, by]];
    lx = mid; ly = (ay + by) / 2 - 9;
  }
  return { d: elbow(pts), label: e.label, lx, ly, role, faint };
}
