'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Orb } from '@/components/ui/Orb';
import { useParam } from '@/lib/use-open';
import { useSize } from '@/lib/use-size';
import { AMBER, AMBER_T, CANVAS, COMPOSER_H, EASE, EDGE, FAINT, HAIR, LINE, RAIL, RED_T, SEAM, SUNK, T1, T2, T4, T5, WELL } from '@/lib/design/tokens';
import type { MapChip, MapPhase, MapWork } from '@/lib/view/model';

/**
 * ワークフロー＝**地図**。横に区切らない。鎖（Work）を格子の上に置いて、
 * 関係は直角に曲がる線で言う（地下鉄の路線図と同じ引き方）。
 *   ・文法は2つだけ — **鎖の中は横の線**（次のフェーズ）/ **枝は縦の線**（新しい Work・成果物）
 *   ・**済んだフェーズが2つ以上続いたら1枚に畳む**（フェーズ 1〜3 · 完了）。
 *     ノードの形は変えないので、フェーズが増えても鎖の幅が伸びきらない
 *   ・左3pxの色帯は進捗のガントと同じ読み方 — 済＝暗い / いま＝明るい / これから＝点線 /
 *     あなたの番＝橙。**完了を緑にしない**（緑は社員の「実行中」で使っている）
 *   ・道具（カーソル・手・拡大率）は置かない。動かすのは指と、右下の地図
 */

/**
 * 格子。列は 198px おき、段は 104px おき。**全部この上に載せる**。
 * 盤面は入力欄の下まで伸びるが、**中身が隠れたままになってはいけない**。
 */
const COL = [56, 254, 452, 650, 848, 1046];
const ROW = [88, 192, 296, 400, 504, 608, 712];
/** 盤面の座標系。線（SVG）とノード（HTML）は**同じ寸法で描く**（拡げると噛み合わなくなる） */
const BOARD_W = 1180, BOARD_H = 748;
/**
 * ノード。**社員の球がそのまま入る大きさ**にしてある。
 * 球は 40px 要る（それ未満は同心リングと芯だけになって球に見えない →
 * `components/ui/Orb.tsx`）ので、高さ 60・幅 176。**枠からはみ出させない。**
 */
const NW = 176, NH = 60, CHIP_H = 52;
const CREW = 40, CREW_PAD = 10;
/**
 * 盤面が出るときの順番。**フェーズ1から順に、左から右へ**。
 * 列ごとに遅らせるので、鎖が2本並ぶ段でも1枚の波として読める。
 */
const STEP = 0.058, IN = `.34s cubic-bezier(.33, 1, .68, 1)`;
const rise = (col: number) => `flowin ${IN} ${(0.04 + col * STEP).toFixed(3)}s backwards`;
/** 新しい Work の枝が一度落ちる、列のあいだの通り道 */
const TRUNK = 180;
const cc = (col: number) => COL[col] + NW / 2;

type Kind = 'done' | 'now' | 'wait' | 'gate';
const SKIN: Record<Kind, { bg: string; border: string; bar: string; title: string; sub: string }> = {
  done: { bg: '#0B0B0B', border: '1px solid #1D1D1D', bar: EDGE, title: T2, sub: T5 },
  now:  { bg: '#101010', border: '1px solid #333333', bar: T2, title: T1, sub: T4 },
  wait: { bg: '#080808', border: `1px dashed ${WELL}`, bar: RAIL, title: T4, sub: T5 },
  gate: { bg: 'rgba(227,116,0,0.05)', border: '1px solid rgba(227,116,0,0.28)', bar: AMBER, title: T1, sub: AMBER_T },
};

function Node({ x, y, w, h, title, sub, kind, pct, crew = 0, col = 0, lit, pick }: {
  x: number; y: number; w: number; h: number; title: string; sub: string;
  kind: Kind; pct?: number; crew?: number; col?: number; lit: boolean; pick: () => void;
}) {
  const s = SKIN[kind];
  /** 社員の球のぶんだけ右を空ける。**文字が球の下に潜らない** */
  const right = crew ? CREW_PAD * 2 + CREW + (crew - 1) * 17 - 4 : 13;
  return (
    /* **押しても盤面から出ない。** 押すとその鎖だけが残り、ほかが沈む */
    <button type="button" onClick={pick} className="card" style={{
      position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', padding: `0 ${right}px 0 14px`, borderRadius: 14,
      background: s.bg, border: s.border, overflow: 'hidden',
      textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
      opacity: lit ? 1 : 0.26, transition: `opacity ${EASE}`, animation: rise(col),
    }}>
      <span style={{ position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, borderRadius: '0 2px 2px 0', background: s.bar }} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: s.title, fontSize: 14, lineHeight: '19px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ color: s.sub, fontSize: 11, lineHeight: '15px', whiteSpace: 'nowrap' }}>{sub}</span>
      </div>
      {/* いまのフェーズの進み。**数字では書かない**（幅そのものが言っている） */}
      {pct !== undefined && (
        <span style={{
          position: 'absolute', left: 12, bottom: 5, width: w - 24, height: 3,
          borderRadius: 2, background: SUNK, overflow: 'hidden',
        }}>
          {/* **0 から今の割合まで、左から右へ満ちる**（ノードが出たすぐあと） */}
          <span style={{
            display: 'block', width: `${pct}%`, height: '100%', borderRadius: 2, background: T2,
            transformOrigin: 'left',
            animation: `fillin .66s cubic-bezier(.33, 1, .68, 1) ${(0.2 + col * STEP).toFixed(3)}s backwards`,
          }} />
        </span>
      )}
    </button>
  );
}

/** 済んだフェーズが2つ以上続いたら1枚に。**畳んでも元のフェーズ番号は失わない** */
type Folded = { name: string; kind: 'done' | 'now' | 'wait'; pct?: number; from: number; to: number };
function fold(ph: MapPhase[]): Folded[] {
  const out: Folded[] = [];
  let run: { p: MapPhase; i: number }[] = [];
  const flush = () => {
    if (!run.length) return;
    out.push({
      name: run.map((r) => r.p.name).join('・'), kind: 'done',
      from: run[0].i + 1, to: run[run.length - 1].i + 1,
    });
    run = [];
  };
  ph.forEach((p, i) => {
    if (p.kind === 'done') { run.push({ p, i }); return; }
    flush();
    out.push({ name: p.name, kind: p.kind, pct: p.pct, from: i + 1, to: i + 1 });
  });
  flush();
  return out;
}

const WORD = { done: '完了', now: '実行中', wait: '待機' } as const;

/** 直角に曲がる線（角だけ丸める）。斜めの曲線をやめると、線がどこへ行くのか目で追える */
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

type FlowMap = { works: MapWork[]; chips: MapChip[] };

/** 盤面のすべて（ノード・線・ラベル）を一度に組む。ミニマップも同じものから描く */
function build(FLOWMAP: FlowMap) {
  /** どの要素も **どの鎖のものか**（`of`）を持つ。押したときに残すものが決まる */
  const nodes: { x: number; y: number; w: number; h: number; kind: Kind; tone?: string;
                 title: string; sub: string; pct?: number; crew?: number; col: number; of: string }[] = [];
  const links: { pts: [number, number][]; faint?: boolean; col: number; of: string[] }[] = [];
  const labels: { x: number; y: number; col: number; of: string[] }[] = [];
  const names: { x: number; y: number; title: string; status?: string; tone?: string; col: number; of: string }[] = [];

  const byId = new Map<string, MapWork>();
  const folded = new Map<string, Folded[]>();
  for (const w of FLOWMAP.works) { byId.set(w.id, w); folded.set(w.id, fold(w.phases)); }
  /** 元のフェーズ番号 → 畳んだあとの列 */
  const slot = (w: MapWork, phase: number) =>
    folded.get(w.id)!.findIndex((f) => phase + 1 >= f.from && phase + 1 <= f.to);

  for (const w of FLOWMAP.works) {
    const fs = folded.get(w.id)!;
    names.push({ x: COL[w.col], y: ROW[w.row] - 26, title: w.title, status: w.status, tone: w.tone,
                 col: w.col, of: w.id });
    fs.forEach((f, i) => {
      nodes.push({
        x: COL[w.col + i], y: ROW[w.row], w: NW, h: NH, kind: f.kind, of: w.id, col: w.col + i,
        title: f.name, pct: f.pct, crew: f.kind === 'now' ? w.crew.length : 0,
        sub: `フェーズ ${f.from === f.to ? f.from : `${f.from}〜${f.to}`} · ${WORD[f.kind]}`,
        tone: w.tone === 'late' && f.kind === 'now' ? 'late' : undefined,
      });
      if (i) links.push({ of: [w.id], col: w.col + i,
        pts: [[COL[w.col + i] - 22, ROW[w.row] + NH / 2], [COL[w.col + i], ROW[w.row] + NH / 2]] });
    });
  }

  // 新しい Work の枝。**同じ親から出るものは1本の幹にまとめる**ので、線が交差しない
  const kids = new Map<string, MapWork[]>();
  for (const w of FLOWMAP.works) if (w.from) {
    const k = `${w.from[0]}:${w.from[1]}`;
    kids.set(k, [...(kids.get(k) ?? []), w]);
  }
  for (const [key, ks] of kids) {
    const [pid, pi] = key.split(':');
    const p = byId.get(pid)!;
    const pcol = p.col + slot(p, Number(pi));
    const pb = ROW[p.row] + NH;
    if (ks.length > 1) {
      const lane = ROW[p.row + 1] + 66;
      links.push({ of: [p.id, ks[0].id], col: ks[0].col,
        pts: [[cc(pcol) - 40, pb], [cc(pcol) - 40, pb + 14], [TRUNK, pb + 14],
              [TRUNK, lane], [cc(ks[0].col), lane], [cc(ks[0].col), ROW[ks[0].row]]] });
      for (const k of ks.slice(1)) {
        links.push({ of: [p.id, k.id], col: k.col,
                     pts: [[TRUNK, lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      }
      labels.push({ x: TRUNK, y: ROW[p.row + 1] + 20, col: 0, of: [p.id, ...ks.map((k) => k.id)] });
    } else {
      const k = ks[0];
      const lane = pb + 26;
      links.push({ of: [p.id, k.id], col: k.col,
        pts: [[cc(pcol), pb], [cc(pcol), lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      labels.push({ x: cc(pcol), y: lane, col: pcol, of: [p.id, k.id] });
    }
  }

  // 成果物と判断は、属するフェーズの**真下に**ぶら下げる
  const byOwner = new Map<string, typeof FLOWMAP.chips>();
  for (const c of FLOWMAP.chips) {
    const k = `${c.owner[0]}:${c.owner[1]}`;
    byOwner.set(k, [...(byOwner.get(k) ?? []), c]);
  }
  for (const [key, cs] of byOwner) {
    const [pid, pi] = key.split(':');
    const p = byId.get(pid)!;
    const pcol = p.col + slot(p, Number(pi));
    const pb = ROW[p.row] + NH;
    const stem = cs.length > 1 ? cc(pcol) + 40 : cc(pcol);
    cs.forEach((c, i) => {
      links.push({
        faint: true, of: [p.id], col: c.col,
        pts: i === 0 && cs.length > 1
          ? [[stem, pb], [stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
          : cs.length > 1
            ? [[stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
            : [[stem, pb], [cc(c.col), ROW[c.row]]],
      });
      nodes.push({ x: COL[c.col], y: ROW[c.row], w: NW, h: CHIP_H, kind: 'gate',
                   title: c.title, sub: c.sub, col: c.col, of: p.id });
    });
  }
  return { nodes, links, labels, names };
}

const MINI: Record<Kind, string> = {
  done: FAINT, now: '#7A7A7A', wait: SEAM, gate: 'rgba(227,116,0,0.6)',
};

/** 中身のいちばん外側（線のラベルも入れる）。**器に合わせるのはこの箱** */
function bounds(b: ReturnType<typeof build>) {
  const xs = [...b.nodes.map((n) => n.x), ...b.names.map((n) => n.x), ...b.labels.map((l) => l.x - 46)];
  const ys = [...b.nodes.map((n) => n.y), ...b.names.map((n) => n.y), ...b.labels.map((l) => l.y - 8)];
  const xe = [...b.nodes.map((n) => n.x + n.w), ...b.names.map((n) => n.x + 190), ...b.labels.map((l) => l.x + 46)];
  const ye = [...b.nodes.map((n) => n.y + n.h), ...b.names.map((n) => n.y + 18), ...b.labels.map((l) => l.y + 8)];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xe), y1: Math.max(...ye) };
}

const MAP_W = 184, MAP_PAD = 8, MAP_H = 116;

/**
 * 右下の地図。**盤面と同じデータから描く**（飾りの棒を並べない）。
 * 縮尺は**中身だけ**から決める（送るたびに地図が伸び縮みしない）。
 * 枠は盤面の側から毎コマ書き換えるので、ここは**中身を1回描くだけ**。
 */
const MiniMap = memo(function MiniMap({ nodes, links, lit, sc, X0, Y0, H, frame, go }: {
  nodes: ReturnType<typeof build>['nodes'];
  links: ReturnType<typeof build>['links'];
  lit: (of: string | string[]) => boolean;
  sc: number; X0: number; Y0: number; H: number;
  frame: React.RefObject<SVGRectElement | null>;
  /** つまんだところを真ん中に持ってくる（中身の座標） */
  go: (cx: number, cy: number) => void;
}) {
  const m = (x: number, y: number): [number, number] => [MAP_PAD + (x - X0) * sc, MAP_PAD + (y - Y0) * sc];
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    go(X0 + (e.clientX - r.left - MAP_PAD) / sc, Y0 + (e.clientY - r.top - MAP_PAD) / sc);
  };
  return (
    <div
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={(e) => { if (e.buttons & 1) at(e); }}
      style={{
      /* 盤面の道具なので **`COMPOSER_H` ぶん逃がす**（入力欄に隠れたままにしない） */
      position: 'absolute', right: 24, bottom: COMPOSER_H, width: MAP_W, height: H,
      borderRadius: 10, background: '#0A0A0A', border: `1px solid ${LINE}`, overflow: 'hidden',
      cursor: 'pointer', touchAction: 'none',
      /* 盤面が描き終わるころに出る（先に地図だけあると、そこだけ浮いて見える） */
      animation: `flowfade ${IN} .34s backwards`,
    }}>
      <svg width={MAP_W} height={H} viewBox={`0 0 ${MAP_W} ${H}`} style={{ pointerEvents: 'none' }}>
        {links.map((l, i) => (
          <path key={i} d={`M ${l.pts.map((q) => m(q[0], q[1]).map((n) => n.toFixed(1)).join(' ')).join(' L ')}`}
                fill="none" stroke="#242424" strokeWidth={0.8} opacity={lit(l.of) ? 1 : 0.26} />
        ))}
        {nodes.map((n, i) => {
          const [x, y] = m(n.x, n.y);
          return <rect key={i} x={x.toFixed(1)} y={y.toFixed(1)} width={(n.w * sc).toFixed(1)}
                       height={Math.max(2.4, n.h * sc).toFixed(1)} rx={1.5} opacity={lit(n.of) ? 1 : 0.26}
                       fill={n.tone === 'late' ? 'rgba(217,48,37,0.6)' : MINI[n.kind]} />;
        })}
        {/* いま見えている範囲。**盤面の側から毎コマ書き換える** */}
        <rect ref={frame} rx={4} fill="rgba(255,255,255,0.05)" stroke={T4} strokeWidth={1.2} />
      </svg>
    </div>
  );
});

/** ほかの画面と同じ印。判断待ち＝橙の菱形 / 要確認＝書類 */
function Mark({ status }: { status?: string }) {
  if (status === '判断待ち') return <span style={{ width: 8, height: 8, background: AMBER, transform: 'rotate(45deg)', borderRadius: 1.5, display: 'inline-block', flexShrink: 0 }} />;
  if (status === '要確認') return <span style={{ width: 9, height: 11, border: `1px solid ${AMBER}`, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />;
  return null;
}

/**
 * 盤面の中身。**拡大縮小のあいだ組み直さない。**
 * 動かしているのは外側の1枚だけなのに、中の何千という節点を毎コマ作り直すと
 * そのぶん遅れて「ぎこちない」になる（社員の球を入れてから 3,900 節点ある）。
 * 選んでいる鎖（`of`）が変わったときだけ作り直す。
 */
const Scene = memo(function Scene({ nodes, links, labels, names, works, endX, endY, lit, pick }: {
  nodes: ReturnType<typeof build>['nodes'];
  links: ReturnType<typeof build>['links'];
  labels: ReturnType<typeof build>['labels'];
  names: ReturnType<typeof build>['names'];
  works: MapWork[];
  endX: number; endY: number;
  lit: (of: string | string[]) => boolean;
  pick: (of: string) => void;
}) {
  return (<>
      {/* 線は見るだけ。**押せる面をふさがない**（空きを押したら選択が外れる）。
          **中身と同じ寸法**にする（盤面の幅で描くと、真ん中に寄せたぶん右へはみ出す） */}
      <svg width={endX} height={endY} viewBox={`0 0 ${endX} ${endY}`}
           style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {links.map((l, i) => (
          <path key={i} d={elbow(l.pts)} fill="none" strokeWidth={1.3}
                stroke={l.faint ? `${FAINT}` : '#333333'} opacity={lit(l.of) ? 1 : 0.26}
                style={{ transition: `opacity ${EASE}`,
                         animation: `flowfade ${IN} ${(0.02 + l.col * STEP).toFixed(3)}s backwards` }} />
        ))}
      </svg>

      {names.map((n) => (
        <button key={n.title} type="button" onClick={() => pick(n.of)} className="lnk" style={{
          position: 'absolute', left: n.x, top: n.y, display: 'flex', alignItems: 'center', gap: 9,
          whiteSpace: 'nowrap', color: T2, fontSize: 13,
          background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer',
          opacity: lit(n.of) ? 1 : 0.26, transition: `opacity ${EASE}`, animation: rise(n.col),
        }}>
          {n.title}
          <Mark status={n.status} />
          {n.status && <span style={{ color: n.tone === 'late' ? RED_T : AMBER_T, fontSize: 11.5 }}>{n.status}</span>}
        </button>
      ))}

      {nodes.map((n, i) => <Node key={i} {...n} lit={lit(n.of)} pick={() => pick(n.of)} />)}

      {/* 社員はいまのフェーズのノードの右に置く（⊕ で足すものではない）。
          **オフィスと同じ粒子のアバター**。ここだけ別の丸を描かない */}
      {works.map((w) => {
        const fs = fold(w.phases);
        const i = fs.findIndex((f) => f.kind === 'now');
        if (i < 0 || !w.crew.length) return null;
        const x = COL[w.col + i] + NW - CREW_PAD - CREW / 2, y = ROW[w.row] + NH / 2;
        return w.crew.map((c, k) => (
          <span key={`${w.id}-${c}`} style={{
            position: 'absolute', left: x - (w.crew.length - 1 - k) * 17 - CREW / 2, top: y - CREW / 2,
            opacity: lit(w.id) ? 1 : 0.26, transition: `opacity ${EASE}`, pointerEvents: 'none',
            animation: `flowfade ${IN} ${(0.24 + (w.col + i) * STEP).toFixed(3)}s backwards`,
          }}>
            <Orb color={c} size={CREW} seed={c.length * 7 + 3} />
          </span>
        ));
      })}

      {labels.map((l, i) => (
        <span key={i} style={{
          position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -50%)',
          padding: '0 6px', color: T5, fontSize: 10.5, whiteSpace: 'nowrap', background: CANVAS,
          opacity: lit(l.of) ? 1 : 0.26, transition: `opacity ${EASE}`, pointerEvents: 'none',
          animation: `flowfade ${IN} ${(0.1 + l.col * STEP).toFixed(3)}s backwards`,
        }}>新しい Work</span>
      ))}
  </>);
});

/** 見る目の位置。中身 → 画面は `translate(x, y) scale(z)` */
type Eye = { x: number; y: number; z: number };
const MIN_Z = 0.16, MAX_Z = 4;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 中身と器のあいだに空ける縁 */
const PAD_EDGE = 26;
/**
 * 端から端まで送ったあと、**さらに動かせるぶん**（器の 45%）。
 * ぴったりで止めると盤面が窮屈で、地図を隅に寄せて見る、ができない。
 * 押しても中身が半分は残るので、迷子にはならない。
 */
const SLACK = 0.45;

export function Flow({ map: given }: { map: FlowMap }) {
  /** 盤面の形はデータで決まる。**描き直すたびに組み直さない**（`Scene` の memo が効かなくなる） */
  const made = useMemo(() => build(given), [given]);
  const { nodes, links, labels, names } = made;
  const B = useMemo(() => bounds(made), [made]);
  const bw = B.x1 - B.x0, bh = B.y1 - B.y0;

  const board = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(board);
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<SVGRectElement>(null);

  /**
   * **押しても盤面から出ない。** 選んだ鎖だけが残り、ほかは沈む。
   * 8本の鎖が1枚に載っているので「これはどの Work か」は本当に分からなくなる。
   * 選んでいる1件は URL に持つ（`?view=flow&of=w-lp`）。
   */
  const [of, setOf] = useParam('of', '');
  const lit = useCallback(
    (o: string | string[]) => !of || (Array.isArray(o) ? o.includes(of) : o === of), [of]);
  // `setOf` は `useParam` 側で固めてあるので、素直に依存に入れられる
  // （前はここで ref に逃がしていた。逃がす必要が無くなった）
  const pick = useCallback((o: string) => setOf(of === o ? '' : o), [of, setOf]);

  const vw = w < 2 ? BOARD_W : w;
  /** 見えているのは入力欄より上まで。**隠れているぶんを「見えている」と言わない** */
  const vh = h < 2 ? BOARD_H : Math.max(160, h - COMPOSER_H);

  /** 右下の地図の縮尺。**中身だけから決める**（送っても伸び縮みしない） */
  const map = useMemo(() => {
    const sc = Math.min((MAP_W - MAP_PAD * 2) / bw, MAP_H / bh);
    return { sc, H: Math.round(bh * sc + MAP_PAD * 2) };
  }, [bw, bh]);

  /**
   * **中身は画面から出さない。**
   *   ・器より小さいときは、器の中で動ける（外へは出ない）
   *   ・器より大きいときは、器が中身の中で動ける（外へは出ない）
   * どちらも「端から端まで」で止まるので、指を動かすと盤面がどこかへ滑っていく、が起きない。
   */
  const hold = useCallback((e: Eye): Eye => {
    const ax = (v: number, p0: number, p1: number, box: number) => {
      const a = -p0 * e.z + PAD_EDGE, b = box - p1 * e.z - PAD_EDGE, s = box * SLACK;
      return clamp(v, Math.min(a, b) - s, Math.max(a, b) + s);
    };
    return { z: e.z, x: ax(e.x, B.x0, B.x1, vw), y: ax(e.y, B.y0, B.y1, vh) };
  }, [B, vw, vh]);

  /** 全体に合わせる。**器いっぱいまで大きくする**（小さく置いて余白を残さない） */
  const fit = useCallback((): Eye => {
    const z = clamp(Math.min((vw - PAD_EDGE * 2) / bw, (vh - PAD_EDGE * 2) / bh), MIN_Z, MAX_Z);
    return { z, x: (vw - bw * z) / 2 - B.x0 * z, y: (vh - bh * z) / 2 - B.y0 * z };
  }, [vw, vh, bw, bh, B]);

  const [eye, setEye] = useState<Eye>(() => ({ x: 0, y: 0, z: 1 }));
  /** 自分で動かしたか。**動かしたあとは、窓の大きさが変わっても勝手に戻さない** */
  const touched = useRef(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; far: boolean } | null>(null);
  const [held, setHeld] = useState(false);

  /**
   * **描くのは DOM に直接。** 動かしているあいだ React を1回も通さない。
   * 通すと、たとえ中身を組み直さなくても差分を取るぶんだけ毎コマ遅れて
   * 「ぎこちない」になる。React の state は指を離したときだけ合わせる。
   */
  const now = useRef<Eye>(eye);
  const goal = useRef<Eye>(eye);
  const raf = useRef(0);
  const last = useRef(0);
  const draw = useCallback((e: Eye) => {
    now.current = e;
    const c = content.current, b = board.current, f = frame.current;
    if (c) c.style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px) scale(${e.z.toFixed(4)})`;
    if (b) {
      b.style.backgroundSize = `${(22 * e.z).toFixed(2)}px ${(22 * e.z).toFixed(2)}px`;
      b.style.backgroundPosition = `${e.x.toFixed(2)}px ${e.y.toFixed(2)}px`;
    }
    if (f) {
      /* いま見えている範囲を中身の座標に戻して、地図の枠に写す */
      const vx0 = -e.x / e.z, vy0 = -e.y / e.z, vx1 = (-e.x + vw) / e.z, vy1 = (-e.y + vh) / e.z;
      const px = (x: number) => MAP_PAD + (x - B.x0) * map.sc, py = (y: number) => MAP_PAD + (y - B.y0) * map.sc;
      const x = clamp(px(vx0), 1, MAP_W - 2), y = clamp(py(vy0), 1, map.H - 2);
      f.setAttribute('x', x.toFixed(1)); f.setAttribute('y', y.toFixed(1));
      f.setAttribute('width', Math.max(2, clamp(px(vx1), 1, MAP_W - 1) - x).toFixed(1));
      f.setAttribute('height', Math.max(2, clamp(py(vy1), 1, map.H - 1) - y).toFixed(1));
    }
  }, [vw, vh, B, map]);   // board / content / frame は ref。識別は変わらないので依存に入れない

  /** 行き先を追いかける。時間で詰めるので、画面の速さが変わっても手ざわりが同じ */
  const chase = useCallback(() => {
    // **`function` で立てる。** `const step = (t) => … step …` だと
    // 自分の初期化の途中で自分を指すことになる（動くが、読む側も機械も引っかかる）
    function step(t: number) {
      const dt = Math.min(64, last.current ? t - last.current : 16);
      last.current = t;
      const a = now.current, b = goal.current;
      const k = 1 - Math.exp(-dt / 42);
      const next = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z * (b.z / a.z) ** k };
      const done = Math.abs(b.x - next.x) < 0.3 && Math.abs(b.y - next.y) < 0.3 && Math.abs(b.z - next.z) < 0.0008;
      draw(done ? b : next);
      if (done) { raf.current = 0; last.current = 0; setEye(b); }
      else raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
  }, [draw]);
  /** `snap` は指と1対1のとき（つまんで動かす・二本指で送る・地図をつまむ） */
  const aim = useCallback((next: Eye, snap = false) => {
    goal.current = next;
    if (snap) {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; last.current = 0; }
      draw(next);
      return;
    }
    if (!raf.current) chase();
  }, [chase, draw]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  /** 最初の1回は追いかけない（開いた瞬間に動いて見えると、それは演出になる） */
  useEffect(() => {
    if (w < 2 || touched.current) return;
    const f = fit();
    goal.current = f; setEye(f); draw(f);
  }, [w, h, fit, draw]);

  /** ホイールは器のほうで拾う（React のは受け身なので、拡大縮小を止められない） */
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left, py = ev.clientY - r.top;
      const v = goal.current;
      if (ev.ctrlKey || ev.metaKey) {
        /* 1目盛りは 1.33 倍。間はフレームごとに詰めるので、段には見えない */
        const z = clamp(v.z * Math.exp(-ev.deltaY / 420), MIN_Z, MAX_Z);
        aim(hold({ z, x: px - (px - v.x) * (z / v.z), y: py - (py - v.y) * (z / v.z) }));
      } else {
        /** 二本指の移動は指と1対1。**追いかけると滑って見える** */
        aim(hold({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }), true);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hold, aim]);

  /** Esc で選択を外す（右ペインと同じ作法）。⇧1 で全体、⇧0 で等倍 */
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key === 'Escape' && of) { setOf(''); return; }
      if (ev.key === '!') { touched.current = false; aim(fit()); }
      if (ev.key === ')') { touched.current = true; aim(hold({ ...goal.current, z: 1 })); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  /** 盤面の空きか（＝つまんで動かせるところ。ノードの上ではない） */
  const empty = (ev: { target: EventTarget | null }) =>
    !!(ev.target as HTMLElement | null)?.dataset?.pan;

  /** 地図をつまんだとき。中身のその点を真ん中に持ってくる */
  const go = useCallback((cx: number, cy: number) => {
    touched.current = true;
    const v = goal.current;
    aim(hold({ ...v, x: vw / 2 - cx * v.z, y: vh / 2 - cy * v.z }), true);
  }, [aim, hold, vw, vh]);

  return (
    /* 盤面は中身の領域いっぱい。**外の計算から切り離す** */
    <div ref={board} data-pan="1"
      /* 空きをつまんだら盤面が付いてくる。**動かさずに離したら「押した」** */
      onPointerDown={(ev) => {
        if (!(ev.button === 1 || (ev.button === 0 && empty(ev)))) return;
        drag.current = { x: ev.clientX, y: ev.clientY, ox: goal.current.x, oy: goal.current.y, far: false };
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setHeld(true);
      }}
      onPointerMove={(ev) => {
        const d = drag.current;
        if (!d) return;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (!d.far && Math.hypot(dx, dy) < 4) return;
        d.far = true; touched.current = true;
        aim(hold({ ...goal.current, x: d.ox + dx, y: d.oy + dy }), true);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setHeld(false);
        if (d?.far) setEye(now.current);
        else if (d && of) setOf('');
      }}
      onDoubleClick={(ev) => { if (empty(ev)) { touched.current = false; aim(fit()); } }}
      style={{
      position: 'absolute', inset: 0, overflow: 'hidden', contain: 'strict',
      cursor: held ? 'grabbing' : 'grab', touchAction: 'none',
      backgroundColor: CANVAS,
      /* ドットも一緒に動いて、拡大縮小に付いてくる（どれだけ動いたかが目で分かる） */
      backgroundImage: `radial-gradient(${HAIR} 1px, transparent 1px)`,
      backgroundSize: `${22 * eye.z}px ${22 * eye.z}px`,
      backgroundPosition: `${eye.x}px ${eye.y}px`,
    }}>
      {/* 中身はひとかたまりで動かす。**線とノードが同じだけ動いて、同じだけ伸び縮みする** */}
      <div ref={content} data-pan="1"
           style={{
             position: 'absolute', left: 0, top: 0, width: B.x1 + 24, height: B.y1 + 24,
             transform: `translate(${eye.x}px, ${eye.y}px) scale(${eye.z})`,
             transformOrigin: '0 0',
           }}>
        <Scene nodes={nodes} links={links} labels={labels} names={names} works={given.works}
               endX={B.x1 + 24} endY={B.y1 + 24} lit={lit} pick={pick} />
      </div>

      <MiniMap nodes={nodes} links={links} lit={lit}
               sc={map.sc} X0={B.x0} Y0={B.y0} H={map.H} frame={frame} go={go} />
    </div>
  );
}
