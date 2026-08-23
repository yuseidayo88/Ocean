'use client';

import { useState } from 'react';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { useSize } from '@/lib/use-size';
import { COMPOSER_H } from '@/lib/design/tokens';
import { AGENT_COLOR, FLOWMAP, type MapPhase, type MapWork } from '@/lib/dummy';

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
 * 格子。列は 180px おき、段は 96px おき。**全部この上に載せる**。
 * 段の高さは、いちばん下の段まで **入力欄の上（`COMPOSER_H`）に収まる**ように取ってある。
 * 盤面は入力欄の下まで伸びるが、**中身が隠れたままになってはいけない**。
 */
const COL = [56, 236, 416, 596, 776, 956];
const ROW = [84, 180, 276, 372, 468, 564, 660];
/** 盤面の座標系。線（SVG）とノード（HTML）は**同じ寸法で描く**（拡げると噛み合わなくなる） */
const BOARD_W = 1180, BOARD_H = 748;
const NW = 160, NH = 52, CHIP_H = 46;
/** 新しい Work の枝が一度落ちる、列のあいだの通り道 */
const TRUNK = 180;
const cc = (col: number) => COL[col] + NW / 2;

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', RED_T = '#F28B82', AMBER_T = '#FDD663';
const CANVAS = '#060606';

type Kind = 'done' | 'now' | 'wait' | 'gate';
const SKIN: Record<Kind, { bg: string; border: string; bar: string; title: string; sub: string }> = {
  done: { bg: '#0B0B0B', border: '1px solid #1D1D1D', bar: '#2A2A2A', title: T2, sub: T5 },
  now:  { bg: '#101010', border: '1px solid #333333', bar: T2, title: T1, sub: T4 },
  wait: { bg: '#080808', border: '1px dashed #1F1F1F', bar: '#141414', title: T4, sub: T5 },
  gate: { bg: 'rgba(227,116,0,0.05)', border: '1px solid rgba(227,116,0,0.28)', bar: AMBER, title: T1, sub: AMBER_T },
};

function Node({ x, y, w, h, title, sub, kind, pct, href }: {
  x: number; y: number; w: number; h: number; title: string; sub: string;
  kind: Kind; pct?: number; href: string;
}) {
  const s = SKIN[kind];
  return (
    <Link href={href as Route} className="card" style={{
      position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', padding: '0 13px 0 14px', borderRadius: 14,
      background: s.bg, border: s.border, overflow: 'hidden',
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
          borderRadius: 2, background: '#1A1A1A', overflow: 'hidden',
        }}>
          <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 2, background: T2 }} />
        </span>
      )}
    </Link>
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

/** 盤面のすべて（ノード・線・ラベル）を一度に組む。ミニマップも同じものから描く */
function build() {
  const nodes: { x: number; y: number; w: number; h: number; kind: Kind; tone?: string;
                 title: string; sub: string; pct?: number; href: string }[] = [];
  const links: { pts: [number, number][]; faint?: boolean }[] = [];
  const labels: { x: number; y: number }[] = [];
  const names: { x: number; y: number; title: string; status?: string; tone?: string; href: string }[] = [];

  const byId = new Map<string, MapWork>();
  const folded = new Map<string, Folded[]>();
  for (const w of FLOWMAP.works) { byId.set(w.id, w); folded.set(w.id, fold(w.phases)); }
  /** 元のフェーズ番号 → 畳んだあとの列 */
  const slot = (w: MapWork, phase: number) =>
    folded.get(w.id)!.findIndex((f) => phase + 1 >= f.from && phase + 1 <= f.to);

  for (const w of FLOWMAP.works) {
    const fs = folded.get(w.id)!;
    names.push({ x: COL[w.col], y: ROW[w.row] - 26, title: w.title, status: w.status, tone: w.tone, href: w.href });
    fs.forEach((f, i) => {
      nodes.push({
        x: COL[w.col + i], y: ROW[w.row], w: NW, h: NH, kind: f.kind, href: w.href,
        title: f.name, pct: f.pct,
        sub: `フェーズ ${f.from === f.to ? f.from : `${f.from}〜${f.to}`} · ${WORD[f.kind]}`,
        tone: w.tone === 'late' && f.kind === 'now' ? 'late' : undefined,
      });
      if (i) links.push({ pts: [[COL[w.col + i] - 20, ROW[w.row] + NH / 2], [COL[w.col + i], ROW[w.row] + NH / 2]] });
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
      links.push({ pts: [[cc(pcol) - 40, pb], [cc(pcol) - 40, pb + 14], [TRUNK, pb + 14],
                         [TRUNK, lane], [cc(ks[0].col), lane], [cc(ks[0].col), ROW[ks[0].row]]] });
      for (const k of ks.slice(1)) {
        links.push({ pts: [[TRUNK, lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      }
      labels.push({ x: TRUNK, y: ROW[p.row + 1] + 20 });
    } else {
      const k = ks[0];
      const lane = pb + 26;
      links.push({ pts: [[cc(pcol), pb], [cc(pcol), lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      labels.push({ x: cc(pcol), y: lane });
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
        faint: true,
        pts: i === 0 && cs.length > 1
          ? [[stem, pb], [stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
          : cs.length > 1
            ? [[stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
            : [[stem, pb], [cc(c.col), ROW[c.row]]],
      });
      nodes.push({ x: COL[c.col], y: ROW[c.row], w: NW, h: CHIP_H, kind: 'gate',
                   title: c.title, sub: c.sub, href: c.href });
    });
  }
  return { nodes, links, labels, names };
}

const MINI: Record<Kind, string> = {
  done: '#2E2E2E', now: '#7A7A7A', wait: '#1C1C1C', gate: 'rgba(227,116,0,0.6)',
};

/**
 * 右下の地図。**盤面と同じデータから描く**（飾りの棒を並べない）。
 * 形が一致するので「いま見ているのは地図のどこか」が絵の相似で分かる。
 * 範囲も**中身から測る**ので、Work が増えて盤面がはみ出しても地図はそのまま合う。
 * 窓の枠は、いま実際に見えている範囲（入力欄に隠れているぶんは入れない）。
 */
function MiniMap({ nodes, links, view, at, off }: {
  nodes: ReturnType<typeof build>['nodes'];
  links: ReturnType<typeof build>['links'];
  view: [number, number, number, number];
  at: { x: number; y: number };
  off: { x: number; y: number };
}) {
  const PAD = 8, W = 184, M = 26;
  /** 盤面の中身と、いま見えている範囲。**両方が入る**ようにする */
  const X0 = Math.min(view[0] - off.x, ...nodes.map((n) => n.x)) - M;
  const Y0 = Math.min(view[1] - off.y, ...nodes.map((n) => n.y)) - M;
  const X1 = Math.max(view[2] - off.x, ...nodes.map((n) => n.x + n.w)) + M;
  const Y1 = Math.max(view[3] - off.y, ...nodes.map((n) => n.y + n.h)) + M;
  const sc = Math.min((W - PAD * 2) / (X1 - X0), 116 / (Y1 - Y0));
  const H = (Y1 - Y0) * sc + PAD * 2;
  const m = (x: number, y: number): [number, number] => [PAD + (x - X0) * sc, PAD + (y - Y0) * sc];
  const [vx, vy] = m(view[0] - off.x, view[1] - off.y);
  return (
    <div style={{
      /* 盤面の道具なので **`COMPOSER_H` ぶん逃がす**（入力欄に隠れたままにしない）。
         送っても右下から動かないよう、送ったぶんだけ戻す */
      position: 'absolute', left: at.x + view[2] - view[0] - W - 24,
      top: at.y + view[3] - view[1] - Math.round(H) - 24, width: W, height: Math.round(H),
      borderRadius: 10, background: '#0A0A0A', border: '1px solid #232323', overflow: 'hidden',
    }}>
      <svg width={W} height={Math.round(H)} viewBox={`0 0 ${W} ${Math.round(H)}`}>
        {links.map((l, i) => (
          <path key={i} d={`M ${l.pts.map((q) => m(q[0], q[1]).map((n) => n.toFixed(1)).join(' ')).join(' L ')}`}
                fill="none" stroke="#242424" strokeWidth={0.8} />
        ))}
        {nodes.map((n, i) => {
          const [x, y] = m(n.x, n.y);
          return <rect key={i} x={x.toFixed(1)} y={y.toFixed(1)} width={(n.w * sc).toFixed(1)}
                       height={Math.max(2.4, n.h * sc).toFixed(1)} rx={1.5}
                       fill={n.tone === 'late' ? 'rgba(217,48,37,0.6)' : MINI[n.kind]} />;
        })}
        {/* いま見えている範囲 */}
        <rect x={vx.toFixed(1)} y={vy.toFixed(1)}
              width={((view[2] - view[0]) * sc).toFixed(1)}
              height={((view[3] - view[1]) * sc).toFixed(1)}
              rx={4} fill="rgba(255,255,255,0.05)" stroke="#6E6E6E" strokeWidth={1.2} />
      </svg>
    </div>
  );
}

/** ほかの画面と同じ印。判断待ち＝橙の菱形 / 要確認＝書類 */
function Mark({ status }: { status?: string }) {
  if (status === '判断待ち') return <span style={{ width: 8, height: 8, background: AMBER, transform: 'rotate(45deg)', borderRadius: 1.5, display: 'inline-block', flexShrink: 0 }} />;
  if (status === '要確認') return <span style={{ width: 9, height: 11, border: `1px solid ${AMBER}`, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />;
  return null;
}

export function Flow() {
  const { nodes, links, labels, names } = build();
  const [board, { w, h }] = useSize<HTMLDivElement>();
  /** どこまで送ったか。**Work が増えて盤面からはみ出したときだけ動く** */
  const [at, setAt] = useState({ x: 0, y: 0 });
  /** 見えているのは、入力欄より上まで。**隠れているぶんを「見えている」と言わない** */
  const vw = w < 2 ? BOARD_W : w;
  const vh = h < 2 ? BOARD_H : Math.max(120, h - COMPOSER_H);
  const view: [number, number, number, number] = [at.x, at.y, at.x + vw, at.y + vh];
  /** 中身のいちばん端 */
  const endX = Math.max(...nodes.map((n) => n.x + n.w)) + 24;
  const endY = Math.max(...nodes.map((n) => n.y + n.h)) + 24;
  /** 器が中身より大きいときは**真ん中に置く**（左上に寄せて右下を空けない） */
  const offX = Math.max(0, Math.round((vw - endX) / 2));
  const offY = Math.max(0, Math.round((vh - endY) / 2));
  return (
    /* 盤面は中身の領域いっぱい。**外の計算から切り離す** */
    <div ref={board}
      onScroll={(e) => setAt({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
      style={{
      position: 'absolute', inset: 0, overflow: 'auto', contain: 'strict',
      backgroundColor: CANVAS,
      backgroundImage: 'radial-gradient(#161616 1px, transparent 1px)', backgroundSize: '22px 22px',
    }}>
      {/* 中身はひとかたまりで動かす。**線とノードが同じだけずれる** */}
      <div style={{ position: 'absolute', left: offX, top: offY, width: endX, height: endY }}>
      <svg width={BOARD_W} height={BOARD_H} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
           style={{ position: 'absolute', inset: 0 }}>
        {links.map((l, i) => (
          <path key={i} d={elbow(l.pts)} fill="none" stroke={l.faint ? '#2E2E2E' : '#333333'} strokeWidth={1.3} />
        ))}
      </svg>

      {names.map((n) => (
        <Link key={n.title} href={n.href as Route} className="lnk" style={{
          position: 'absolute', left: n.x, top: n.y, display: 'flex', alignItems: 'center', gap: 9,
          whiteSpace: 'nowrap', color: T2, fontSize: 13,
        }}>
          {n.title}
          <Mark status={n.status} />
          {n.status && <span style={{ color: n.tone === 'late' ? RED_T : AMBER_T, fontSize: 11.5 }}>{n.status}</span>}
        </Link>
      ))}

      {nodes.map((n, i) => <Node key={i} {...n} />)}

      {/* 社員はいまのフェーズのノードの右に粒で置く（⊕ で足すものではない） */}
      {FLOWMAP.works.map((w) => {
        const fs = fold(w.phases);
        const i = fs.findIndex((f) => f.kind === 'now');
        if (i < 0 || !w.crew.length) return null;
        const x = COL[w.col + i] + NW - 14, y = ROW[w.row] + NH / 2;
        return w.crew.map((c, k) => (
          <span key={`${w.id}-${c}`} style={{
            position: 'absolute', left: x - (w.crew.length - 1 - k) * 11 - 8, top: y - 8,
            width: 16, height: 16, borderRadius: 999,
            background: `radial-gradient(circle at 40% 35%, ${AGENT_COLOR[c]}, ${AGENT_COLOR[c]}22 60%, transparent 72%)`,
          }} />
        ));
      })}

      {labels.map((l, i) => (
        <span key={i} style={{
          position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -50%)',
          padding: '0 6px', color: T5, fontSize: 10.5, whiteSpace: 'nowrap', background: CANVAS,
        }}>新しい Work</span>
      ))}

      </div>

      {/* 送れる先。**中身は絶対位置なので、端を1枚置いて器に教える**（下は入力欄のぶんも） */}
      <div style={{
        position: 'absolute', left: 0, top: 0, pointerEvents: 'none',
        width: offX + endX, height: offY + endY + COMPOSER_H,
      }} />

      <MiniMap nodes={nodes} links={links} view={view} at={at} off={{ x: offX, y: offY }} />
    </div>
  );
}
