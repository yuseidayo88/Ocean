'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParam } from '@/lib/use-open';
import { useSize } from '@/lib/use-size';
import { COMPOSER_H, EASE } from '@/lib/design/tokens';
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

function Node({ x, y, w, h, title, sub, kind, pct, lit, pick }: {
  x: number; y: number; w: number; h: number; title: string; sub: string;
  kind: Kind; pct?: number; lit: boolean; pick: () => void;
}) {
  const s = SKIN[kind];
  return (
    /* **押しても盤面から出ない。** 押すとその鎖だけが残り、ほかが沈む */
    <button type="button" onClick={pick} className="card" style={{
      position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', padding: '0 13px 0 14px', borderRadius: 14,
      background: s.bg, border: s.border, overflow: 'hidden',
      textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
      opacity: lit ? 1 : 0.26, transition: `opacity ${EASE}`,
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

/** 盤面のすべて（ノード・線・ラベル）を一度に組む。ミニマップも同じものから描く */
function build() {
  /** どの要素も **どの鎖のものか**（`of`）を持つ。押したときに残すものが決まる */
  const nodes: { x: number; y: number; w: number; h: number; kind: Kind; tone?: string;
                 title: string; sub: string; pct?: number; of: string }[] = [];
  const links: { pts: [number, number][]; faint?: boolean; of: string[] }[] = [];
  const labels: { x: number; y: number; of: string[] }[] = [];
  const names: { x: number; y: number; title: string; status?: string; tone?: string; of: string }[] = [];

  const byId = new Map<string, MapWork>();
  const folded = new Map<string, Folded[]>();
  for (const w of FLOWMAP.works) { byId.set(w.id, w); folded.set(w.id, fold(w.phases)); }
  /** 元のフェーズ番号 → 畳んだあとの列 */
  const slot = (w: MapWork, phase: number) =>
    folded.get(w.id)!.findIndex((f) => phase + 1 >= f.from && phase + 1 <= f.to);

  for (const w of FLOWMAP.works) {
    const fs = folded.get(w.id)!;
    names.push({ x: COL[w.col], y: ROW[w.row] - 26, title: w.title, status: w.status, tone: w.tone, of: w.id });
    fs.forEach((f, i) => {
      nodes.push({
        x: COL[w.col + i], y: ROW[w.row], w: NW, h: NH, kind: f.kind, of: w.id,
        title: f.name, pct: f.pct,
        sub: `フェーズ ${f.from === f.to ? f.from : `${f.from}〜${f.to}`} · ${WORD[f.kind]}`,
        tone: w.tone === 'late' && f.kind === 'now' ? 'late' : undefined,
      });
      if (i) links.push({ of: [w.id],
        pts: [[COL[w.col + i] - 20, ROW[w.row] + NH / 2], [COL[w.col + i], ROW[w.row] + NH / 2]] });
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
      links.push({ of: [p.id, ks[0].id],
        pts: [[cc(pcol) - 40, pb], [cc(pcol) - 40, pb + 14], [TRUNK, pb + 14],
              [TRUNK, lane], [cc(ks[0].col), lane], [cc(ks[0].col), ROW[ks[0].row]]] });
      for (const k of ks.slice(1)) {
        links.push({ of: [p.id, k.id], pts: [[TRUNK, lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      }
      labels.push({ x: TRUNK, y: ROW[p.row + 1] + 20, of: [p.id, ...ks.map((k) => k.id)] });
    } else {
      const k = ks[0];
      const lane = pb + 26;
      links.push({ of: [p.id, k.id],
        pts: [[cc(pcol), pb], [cc(pcol), lane], [cc(k.col), lane], [cc(k.col), ROW[k.row]]] });
      labels.push({ x: cc(pcol), y: lane, of: [p.id, k.id] });
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
        faint: true, of: [p.id],
        pts: i === 0 && cs.length > 1
          ? [[stem, pb], [stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
          : cs.length > 1
            ? [[stem, pb + 28], [cc(c.col), pb + 28], [cc(c.col), ROW[c.row]]]
            : [[stem, pb], [cc(c.col), ROW[c.row]]],
      });
      nodes.push({ x: COL[c.col], y: ROW[c.row], w: NW, h: CHIP_H, kind: 'gate',
                   title: c.title, sub: c.sub, of: p.id });
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
function MiniMap({ nodes, links, view, lit, go }: {
  nodes: ReturnType<typeof build>['nodes'];
  links: ReturnType<typeof build>['links'];
  /** いま見えている範囲。**中身の座標で** [x0, y0, x1, y1] */
  view: [number, number, number, number];
  lit: (of: string | string[]) => boolean;
  /** つまんで動かしたとき。中身の座標のどこを真ん中にするか */
  go: (cx: number, cy: number) => void;
}) {
  const PAD = 8, W = 184, M = 26;
  /** 盤面の中身と、いま見えている範囲。**両方が入る**ようにする */
  const X0 = Math.min(view[0], ...nodes.map((n) => n.x)) - M;
  const Y0 = Math.min(view[1], ...nodes.map((n) => n.y)) - M;
  const X1 = Math.max(view[2], ...nodes.map((n) => n.x + n.w)) + M;
  const Y1 = Math.max(view[3], ...nodes.map((n) => n.y + n.h)) + M;
  const sc = Math.min((W - PAD * 2) / (X1 - X0), 116 / (Y1 - Y0));
  const H = (Y1 - Y0) * sc + PAD * 2;
  const m = (x: number, y: number): [number, number] => [PAD + (x - X0) * sc, PAD + (y - Y0) * sc];
  const [vx, vy] = m(view[0], view[1]);
  /** 地図の中を押した／なぞったら、そこを真ん中にして盤面が付いてくる */
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    go(X0 + (e.clientX - r.left - PAD) / sc, Y0 + (e.clientY - r.top - PAD) / sc);
  };
  return (
    <div
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={(e) => { if (e.buttons & 1) at(e); }}
      style={{
      /* 盤面の道具なので **`COMPOSER_H` ぶん逃がす**（入力欄に隠れたままにしない） */
      position: 'absolute', right: 24, bottom: COMPOSER_H, width: W, height: Math.round(H),
      borderRadius: 10, background: '#0A0A0A', border: '1px solid #232323', overflow: 'hidden',
      cursor: 'pointer', touchAction: 'none',
    }}>
      <svg width={W} height={Math.round(H)} viewBox={`0 0 ${W} ${Math.round(H)}`}
           style={{ pointerEvents: 'none' }}>
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

/** 見る目の位置。中身 → 画面は `translate(x, y) scale(z)` */
type Eye = { x: number; y: number; z: number };
const MIN_Z = 0.3, MAX_Z = 2.4;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Flow() {
  const { nodes, links, labels, names } = build();
  const [board, { w, h }] = useSize<HTMLDivElement>();
  /**
   * **押しても盤面から出ない。** 選んだ鎖だけが残り、ほかは沈む。
   * 8本の鎖が1枚に載っているので「これはどの Work か」は本当に分からなくなる。
   * 選んでいる1件は URL に持つ（`?view=flow&of=w-lp`）。
   */
  const [of, setOf] = useParam('of', '');
  const lit = (o: string | string[]) => !of || (Array.isArray(o) ? o.includes(of) : o === of);
  const pick = (o: string) => setOf(of === o ? '' : o);

  /**
   * **動かし方は Figma と同じ。** 道具は置かない（見出しも説明文も要らない）。
   *   二本指・ホイール＝移動 / ⌘（Ctrl）＋ホイール・ピンチ＝指の下を軸に拡大縮小 /
   *   空きをつまんで移動 / ダブルクリック・⇧1＝全体に合わせる / ⇧0＝等倍
   */
  const [eye, setEye] = useState<Eye>({ x: 0, y: 0, z: 1 });
  /** 自分で動かしたか。**動かしたあとは、窓の大きさが変わっても勝手に戻さない** */
  const touched = useRef(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; far: boolean } | null>(null);
  const [held, setHeld] = useState(false);

  const vw = w < 2 ? BOARD_W : w;
  /** 見えているのは入力欄より上まで。**隠れているぶんを「見えている」と言わない** */
  const vh = h < 2 ? BOARD_H : Math.max(160, h - COMPOSER_H);
  /** 中身のいちばん端 */
  const endX = Math.max(...nodes.map((n) => n.x + n.w)) + 24;
  const endY = Math.max(...nodes.map((n) => n.y + n.h)) + 24;

  /** 中身が画面から消えないところまでで止める（迷子にしない） */
  const hold = useCallback((e: Eye): Eye => {
    const M = 160, cw = endX * e.z, ch = endY * e.z;
    return {
      z: e.z,
      x: clamp(e.x, Math.min(M - cw, 0), Math.max(vw - M, 0)),
      y: clamp(e.y, Math.min(M - ch, 0), Math.max(vh - M, 0)),
    };
  }, [endX, endY, vw, vh]);

  /** 全体に合わせる。**入るときは拡大しない**（等倍より大きくして粗くしない） */
  const fit = useCallback((): Eye => {
    const z = clamp(Math.min(1, (vw - 64) / endX, (vh - 64) / endY), MIN_Z, MAX_Z);
    return { z, x: (vw - endX * z) / 2, y: (vh - endY * z) / 2 };
  }, [vw, vh, endX, endY]);

  useEffect(() => { if (w > 1 && !touched.current) setEye(fit()); }, [w, h, fit]);

  /** ホイールは器のほうで拾う（React のは受け身なので、拡大縮小を止められない） */
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left, py = ev.clientY - r.top;
      setEye((v) => hold(
        ev.ctrlKey || ev.metaKey
          ? (() => {
              const z = clamp(v.z * Math.exp(-ev.deltaY / 400), MIN_Z, MAX_Z);
              return { z, x: px - (px - v.x) * (z / v.z), y: py - (py - v.y) * (z / v.z) };
            })()
          : { ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY },
      ));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [board, hold]);

  /** Esc で選択を外す（右ペインと同じ作法）。⇧1 で全体、⇧0 で等倍 */
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key === 'Escape' && of) { setOf(''); return; }
      if (ev.key === '!') { touched.current = false; setEye(fit()); }
      if (ev.key === ')') { touched.current = true; setEye((v) => hold({ ...v, z: 1 })); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  /** 盤面の空きか（＝つまんで動かせるところ。ノードの上ではない） */
  const empty = (ev: { target: EventTarget | null }) =>
    !!(ev.target as HTMLElement | null)?.dataset?.pan;

  /** 地図をつまんだとき。中身のその点を真ん中に持ってくる */
  const go = (cx: number, cy: number) => {
    touched.current = true;
    setEye((v) => hold({ ...v, x: vw / 2 - cx * v.z, y: vh / 2 - cy * v.z }));
  };

  const view: [number, number, number, number] =
    [-eye.x / eye.z, -eye.y / eye.z, (-eye.x + vw) / eye.z, (-eye.y + vh) / eye.z];

  return (
    /* 盤面は中身の領域いっぱい。**外の計算から切り離す** */
    <div ref={board} data-pan="1"
      /* 空きをつまんだら盤面が付いてくる。**動かさずに離したら「空きを押した」** */
      onPointerDown={(ev) => {
        if (!(ev.button === 1 || (ev.button === 0 && empty(ev)))) return;
        drag.current = { x: ev.clientX, y: ev.clientY, ox: eye.x, oy: eye.y, far: false };
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setHeld(true);
      }}
      onPointerMove={(ev) => {
        const d = drag.current;
        if (!d) return;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (!d.far && Math.hypot(dx, dy) < 4) return;
        d.far = true; touched.current = true;
        setEye((v) => hold({ ...v, x: d.ox + dx, y: d.oy + dy }));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setHeld(false);
        if (d && !d.far && of) setOf('');
      }}
      onDoubleClick={(ev) => { if (empty(ev)) { touched.current = false; setEye(fit()); } }}
      style={{
      position: 'absolute', inset: 0, overflow: 'hidden', contain: 'strict',
      cursor: held ? 'grabbing' : 'grab', touchAction: 'none',
      backgroundColor: CANVAS,
      /* ドットも一緒に動いて、拡大縮小に付いてくる（どれだけ動いたかが目で分かる） */
      backgroundImage: 'radial-gradient(#161616 1px, transparent 1px)',
      backgroundSize: `${22 * eye.z}px ${22 * eye.z}px`,
      backgroundPosition: `${eye.x}px ${eye.y}px`,
    }}>
      {/* 中身はひとかたまりで動かす。**線とノードが同じだけ動いて、同じだけ伸び縮みする** */}
      <div data-pan="1"
           style={{
             position: 'absolute', left: 0, top: 0, width: endX, height: endY,
             transform: `translate(${eye.x}px, ${eye.y}px) scale(${eye.z})`,
             transformOrigin: '0 0',
           }}>
      {/* 線は見るだけ。**押せる面をふさがない**（空きを押したら選択が外れる）。
          **中身と同じ寸法**にする（盤面の幅で描くと、真ん中に寄せたぶん右へはみ出す） */}
      <svg width={endX} height={endY} viewBox={`0 0 ${endX} ${endY}`}
           style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {links.map((l, i) => (
          <path key={i} d={elbow(l.pts)} fill="none" strokeWidth={1.3}
                stroke={l.faint ? '#2E2E2E' : '#333333'}
                opacity={lit(l.of) ? 1 : 0.26} style={{ transition: `opacity ${EASE}` }} />
        ))}
      </svg>

      {names.map((n) => (
        <button key={n.title} type="button" onClick={() => pick(n.of)} className="lnk" style={{
          position: 'absolute', left: n.x, top: n.y, display: 'flex', alignItems: 'center', gap: 9,
          whiteSpace: 'nowrap', color: T2, fontSize: 13,
          background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer',
          opacity: lit(n.of) ? 1 : 0.26, transition: `opacity ${EASE}`,
        }}>
          {n.title}
          <Mark status={n.status} />
          {n.status && <span style={{ color: n.tone === 'late' ? RED_T : AMBER_T, fontSize: 11.5 }}>{n.status}</span>}
        </button>
      ))}

      {nodes.map((n, i) => <Node key={i} {...n} lit={lit(n.of)} pick={() => pick(n.of)} />)}

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
            opacity: lit(w.id) ? 1 : 0.26, transition: `opacity ${EASE}`, pointerEvents: 'none',
          }} />
        ));
      })}

      {labels.map((l, i) => (
        <span key={i} style={{
          position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -50%)',
          padding: '0 6px', color: T5, fontSize: 10.5, whiteSpace: 'nowrap', background: CANVAS,
          opacity: lit(l.of) ? 1 : 0.26, transition: `opacity ${EASE}`, pointerEvents: 'none',
        }}>新しい Work</span>
      ))}

      </div>

      <MiniMap nodes={nodes} links={links} view={view} lit={lit} go={go} />
    </div>
  );
}
