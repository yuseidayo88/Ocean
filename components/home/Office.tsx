'use client';

import { Orb } from '@/components/ui/Orb';
import { EASE } from '@/lib/design/tokens';
import { useSize } from '@/lib/use-size';
import { AGENT_COLOR, WORKS, employee } from '@/lib/dummy';

/**
 * オフィス＝1枚の絵だけ。
 *   **軌道 = Work。1本の輪が1つの Work** で、輪そのものが進捗の計器になる。
 *   真上がはじまり、時計回りに済んだぶんだけ明るい弧。数字は書かない。
 *
 *   **弧の色 ＝ その区間をやった人。** 色が変わるところが引き継ぎで、
 *   それはそのままフェーズの境目でもある（だから刻みは置かない — 二度言うことになる）。
 *   変わり目には時計回りの矢羽根を立てる。先端は尾を引いて「いま」を言う。
 *
 *   社員は**自分がやった区間のまん中**に立つ。先頭の球の下にいまのフェーズ名。
 *   赤い点線＝予定との差。橙の菱形＝あなたが決めるところ（先端の少し先）。
 *   「あなた」は描かない。社長は統括AIより上にいる存在で、社員の一部ではない。
 */

const T2 = '#B8B8B8', T3 = '#8B8B8B', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', RED = '#D93025';

/**
 * 輪の大きさ（内側から）。判断待ちの Work をいちばん内側に置く。
 * **器の実寸に対する比率で持つ** — 窓が高ければ輪も大きくなる。
 * 縦は一定の比にしない: 内側を平たくしておかないと、
 * 内の輪の社員と外の輪の社員が同じ角度で重なる（球は縮まないので）。
 */
const RX = [0.546, 0.773, 1], RY = [0.4, 0.7, 1];
/** 輪の上に立つ球。下に名前とフェーズ名がぶら下がるので、その半分ぶんを縁に空ける */
const ORB = 56, BOX = ORB + 5 + 17 + 5 + 14;
/** 輪を1周ぶん引くのにかける時間（秒）と、その上に置くものの出方 */
const SWEEP = 1.05, DOT = '.3s ease-out';

/** 背景の瞬き。[left%, top%, 遅れ秒] */
const SPECKS: [number, number, number][] = [
  [9, 20, 0.35], [24, 60, 1.2], [33, 10, 0.6], [41, 84, 1.9], [47, 16, 2.4], [56, 80, 0.9],
  [63, 28, 1.6], [71, 90, 0.2], [78, 12, 2.1], [87, 62, 1.1], [93, 24, 0.7], [16, 84, 2.6],
  [52, 93, 1.4], [68, 8, 0.4], [29, 40, 1.05], [84, 44, 2.2],
];
const CORE: [number, number, number][] = [
  [38, 30, 0], [58, 46, 0.8], [44, 60, 1.5], [62, 32, 2.2], [50, 42, 1.1], [34, 52, 1.8],
];
/** 瞬きの組。[長さ秒, 遅れ秒] — **粒ごとではなく、この数だけ動かす** */
const BLINKS: [number, number][] = [[3.2, 0], [4.1, 1.1], [2.7, 2.2], [3.6, 0.6]];
const CORES: [number, number][] = [[2.6, 0], [3.3, 1.2]];

/** 先端をやっている人の色（弧の上を走る光の色） */
const tipHint = (R: { segs: { owner: string }[] }) =>
  AGENT_COLOR[employee(R.segs[R.segs.length - 1].owner).color];

/** Math.cos/sin は実装で最後の桁が変わる。server と client でずれるので必ず丸める */
const r2 = (n: number) => Number(n.toFixed(2));

/**
 * 対になっている人の球に差す光。**星のように光る** —
 * 芯のまわりの光の輪と、十字＋斜めの光条。指が離れたら消える。
 * 光条は瞬く（`twinkle`）ので、当たっているあいだ生きて見える。
 */
function Star({ color, on }: { color: string; on: boolean }) {
  /** **見えていないときは瞬かせない**（16本ぶんの計算が、何もしていないのに毎フレーム走る） */
  const ray = (deg: number, len: number, wd: number, op: number, dur: number, delay: number) => ({
    position: 'absolute' as const, left: '50%', top: '50%', width: len, height: wd,
    marginLeft: -len / 2, marginTop: -wd / 2, borderRadius: wd,
    background: `linear-gradient(90deg, transparent, ${color} 50%, transparent)`,
    opacity: op, transform: `rotate(${deg}deg)`, transformOrigin: '50% 50%',
    animation: on ? `twinkle ${dur}s ease-in-out ${delay}s infinite` : undefined,
  });
  return (
    <span aria-hidden style={{
      position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none',
      opacity: on ? 1 : 0, transition: `opacity ${EASE}`,
      animation: on ? `starin .34s cubic-bezier(.33, 1, .68, 1)` : undefined,
    }}>
      {/* 光の輪。芯に近いほど明るい */}
      <span style={{
        position: 'absolute', left: -ORB, top: -ORB, width: ORB * 2, height: ORB * 2, borderRadius: 999,
        background: `radial-gradient(circle, ${color}59 0%, ${color}22 30%, transparent 66%)`,
      }} />
      {/* 光条。長い十字と、短い斜め */}
      <span style={ray(0, ORB * 3.1, 1.6, 0.8, 3.4, 0)} />
      <span style={ray(90, ORB * 2.5, 1.6, 0.6, 4.1, 0.5)} />
      <span style={ray(45, ORB * 1.5, 1, 0.4, 2.9, 1.1)} />
      <span style={ray(-45, ORB * 1.5, 1, 0.4, 3.7, 0.3)} />
    </span>
  );
}

export function Office({ lit, onHover }: { lit?: string; onHover?: (id: string) => void }) {
  const [box, { w: OW, h: OH }] = useSize<HTMLDivElement>();
  const CX = OW / 2, CY = OH / 2;
  /** 縁は、球の下にぶら下がる名前ぶんだけ空ける（切れさせない） */
  const MX = CX - 46, MY = CY - BOX / 2 - 9;
  const RINGS: [number, number][] = [0, 1, 2].map((i) => [MX * RX[i], MY * RY[i]]);
  const on = (rx: number, ry: number, pct: number) => {
    const a = ((-90 + (360 * pct) / 100) * Math.PI) / 180;
    return [r2(CX + rx * Math.cos(a)), r2(CY + ry * Math.sin(a))] as const;
  };
  const arc = (rx: number, ry: number, p0: number, p1: number) => {
    const [x0, y0] = on(rx, ry, p0), [x1, y1] = on(rx, ry, p1);
    return `M ${x0} ${y0} A ${rx} ${ry} 0 ${p1 - p0 > 50 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  /** 判断待ちの Work をいちばん内側へ。あとは Work の並びのまま */
  const works = [...WORKS].sort((a, b) => Number(!!b.gate) - Number(!!a.gate));

  const rings: React.ReactNode[] = [];
  const orbits: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const people: { x: number; y: number; id: string; gate: boolean; phase: string; in: string }[] = [];

  works.forEach((w, i) => {
    const [rx, ry] = RINGS[i];
    const R = w.ring;
    const lead = Math.max(...R.crew.map((c) => c.at));
    const phase = w.phases[w.phaseIndex - 1]?.name ?? '';
    /**
     * **輪は 0% から今の割合まで引かれる。** 進み具合そのものが動きになる。
     * 位置（%）を時間に写すので、引き継ぎの矢羽根も社員も、
     * 弧がそこに届いた瞬間に出る（あとから足したように見えない）。
     */
    const at = (pct: number) => (0.06 + i * 0.05 + (pct / R.tip) * SWEEP).toFixed(3);
    const span = (a: number, b: number) => (((b - a) / R.tip) * SWEEP).toFixed(3);

    const parts: React.ReactNode[] = [
      <ellipse key="e" cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="#1B1B1B" strokeWidth={1} />,
      /* 真上がはじまり */
      <line key="s" x1={CX} y1={CY - ry - 5} x2={CX} y2={CY - ry + 5} stroke="#2E2E2E" strokeWidth={1} />,
    ];
    let from = 0;
    R.segs.forEach((sg, k) => {
      const col = AGENT_COLOR[employee(sg.owner).color];
      parts.push(<path key={`a${k}`} d={arc(rx, ry, from, sg.to)} fill="none" stroke={col}
                       strokeWidth={2.6} strokeLinecap="round" opacity={0.95}
                       pathLength={1} strokeDasharray={1}
                       style={{ animation: `draw ${span(from, sg.to)}s linear ${at(from)}s backwards` }} />);
      /* 色が変わるところ＝引き継ぎ。時計回りの矢羽根 */
      if (k) {
        const [px, py] = on(rx, ry, from);
        const a = ((-90 + 3.6 * from) * Math.PI) / 180;
        let tx = -rx * Math.sin(a), ty = ry * Math.cos(a);
        const L = Math.hypot(tx, ty); tx /= L; ty /= L;
        const nx = -ty, ny = tx, s = 5;
        parts.push(<polygon key={`h${k}`} fill={col}
          style={{ animation: `flowfade ${DOT} ${at(from)}s backwards` }} points={
          [`${r2(px + tx * s)},${r2(py + ty * s)}`,
           `${r2(px - tx * s * 0.55 + nx * s * 0.78)},${r2(py - ty * s * 0.55 + ny * s * 0.78)}`,
           `${r2(px - tx * s * 0.55 - nx * s * 0.78)},${r2(py - ty * s * 0.55 - ny * s * 0.78)}`].join(' ')} />);
      }
      from = sg.to;
    });
    /* 先端の尾。**動いているものにだけ引く** */
    const tipCol = AGENT_COLOR[employee(R.segs[R.segs.length - 1].owner).color];
    ([[1.6, 2.6, 0.9], [4, 2, 0.5], [6.8, 1.5, 0.26]] as const).forEach(([back, r, o], k) => {
      const [x, y] = on(rx, ry, R.tip - back);
      parts.push(<circle key={`t${k}`} cx={x} cy={y} r={r} fill={tipCol} opacity={o}
                         style={{ animation: `flowfade ${DOT} ${at(R.tip)}s backwards` }} />);
    });
    /* 予定との差。はみ出したぶんを赤い点線で見せる */
    if (R.behind !== undefined) {
      parts.push(<path key="b" d={arc(rx, ry, R.tip, R.behind)} fill="none" stroke={RED}
                       strokeWidth={2.2} strokeDasharray="3 4" strokeLinecap="round"
                       style={{ animation: `flowfade ${DOT} ${at(R.tip)}s backwards` }} />);
    }
    /* あなたが決めるところ。**先端の少し先**に立てる（この Work の次は、あなたの番） */
    if (w.gate) {
      const a = ((-90 + 3.6 * R.tip) * Math.PI) / 180;
      let tx = -rx * Math.sin(a), ty = ry * Math.cos(a);
      const L = Math.hypot(tx, ty); tx /= L; ty /= L;
      const [bx, by] = on(rx, ry, R.tip);
      const gx = r2(bx + tx * 34), gy = r2(by + ty * 34);
      parts.push(
        <g key="g" style={{ animation: `flowfade ${DOT} ${(+at(R.tip) + 0.12).toFixed(3)}s backwards` }}>
          <circle cx={gx} cy={gy} r={11} fill="rgba(227,116,0,0.13)" />
          <rect x={gx - 4.5} y={gy - 4.5} width={9} height={9} rx={1.5} fill={AMBER}
                transform={`rotate(45 ${gx} ${gy})`} />
        </g>,
      );
    }
    rings.push(<g key={w.id}>{parts}</g>);

    /* 輪が大きいほどゆっくり回る（3本が同じ拍にならない） */
    const lightC = tipHint(R), squash = ry / rx;
    orbits.push(
      <div key={`p-${w.id}`} style={{
        position: 'absolute', left: CX, top: CY, width: 0, height: 0, pointerEvents: 'none',
        transform: `scaleY(${squash.toFixed(4)})`,
      }}>
        <div style={{ position: 'absolute', animation: `spin ${(13 + i * 5.5).toFixed(1)}s linear infinite` }}>
          <span style={{
            position: 'absolute', left: rx - 13, top: -13, width: 26, height: 26, borderRadius: 999,
            transform: `scaleY(${(1 / squash).toFixed(4)})`,
            background: `radial-gradient(circle, ${lightC} 0%, ${lightC}66 26%, transparent 62%)`,
            opacity: 0.62,
          }} />
        </div>
      </div>,
    );

    const a = (R.labelDeg * Math.PI) / 180;
    const lx = r2(CX + rx * Math.cos(a)), ly = r2(CY + ry * Math.sin(a));
    /* **絵は行き先を持たない。** 押して別の画面へ飛ばすと、絵を見ている目が毎回外れる */
    labels.push(
      <span key={w.id} style={{
        position: 'absolute', left: lx + 1, top: ly, transform: 'translate(-100%, -50%)',
        display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
        color: T3, fontSize: 11,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 9, flexShrink: 0, background: tipCol }} />
        {w.title}
        <span style={{ width: 12, height: 1, background: '#2E2E2E' }} />
      </span>,
    );

    R.crew.forEach((c) => {
      const [x, y] = on(rx, ry, c.at);
      people.push({ x, y, id: c.id, gate: !!c.gate, phase: c.at === lead ? phase : '', in: at(c.at) });
    });
  });

  return (
    /* 盤面は**与えられた面いっぱい**。中身は外に出ないので、外の計算から切り離す */
    <div ref={box} style={{ position: 'absolute', inset: 0, overflow: 'hidden', contain: 'strict' }}>
      {OW < 2 ? null : <>
      <svg width={OW} height={OH} viewBox={`0 0 ${OW} ${OH}`} style={{ position: 'absolute', inset: 0 }}>{rings}</svg>

      {labels}

      {/**
        * **惑星。輪の上を光がまわり続ける。**
        * `stroke-dashoffset` で走らせると合成に上がらず、
        * 何もしていないのに毎フレーム塗り直しになる（/home が 8%）。
        * **円を回して、器のほうを縦に潰して楕円にする** — transform だけなので 0%。
        */}
      {orbits}

      {/* **瞬きは組にして掛ける。** 1粒ずつ動かすと、何もしていないのに
          22個ぶんのスタイル再計算が毎フレーム走る（/home の CPU 6.5% のうち 5.6% がこれだった）。
          組ごとに速さと遅れを変えれば、目にはばらばらに瞬いて見える */}
      {BLINKS.map(([dur, delay], g) => (
        <div key={g} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: `blink ${dur}s ease-in-out ${delay}s infinite`,
        }}>
          {SPECKS.filter((_, i) => i % BLINKS.length === g).map(([l, t]) => (
            <span key={`${l}-${t}`} style={{
              position: 'absolute', left: `${l}%`, top: `${t}%`, width: 2, height: 2, borderRadius: 999,
              background: 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>
      ))}

      {/* 統括AI から、その区間を持っている人へ（割り当て。**引き継ぎより弱く**） */}
      {people.map(({ x, y, id }) => {
        const dx = x - CX, dy = y - CY, len = Math.hypot(dx, dy);
        return (
          <div key={`l-${id}-${x}`} style={{
            position: 'absolute',
            left: r2(CX + (30 * dx) / len), top: r2(CY + (30 * dy) / len),
            width: r2(len - 50), height: 1, background: '#1F1F1F',
            transformOrigin: '0 50%', transform: `rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2)}deg)`,
          }} />
        );
      })}

      {/* 統括AI（白）。社長は描かない */}
      <div onPointerEnter={() => onHover?.('exec')} onPointerLeave={() => onHover?.('')} style={{
        position: 'absolute', left: CX, top: CY, transform: 'translate(-50%, -50%)', color: '#E8E8E8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <div style={{
            position: 'absolute', inset: -16, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(255,255,255,0.07), rgba(255,255,255,0) 66%)',
            filter: 'blur(12px)', animation: 'breathe 4.2s ease-in-out infinite',
          }} />
          <span style={{ position: 'absolute', inset: 0 }}><Orb color="#D2D2D2" size={88} seed={7} /></span>
          {CORES.map(([dur, delay], g) => (
            <div key={g} style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              animation: `blink ${dur}s ease-in-out ${delay}s infinite`,
            }}>
              {CORE.filter((_, i) => i % CORES.length === g).map(([l, t]) => (
                <span key={`${l}-${t}`} style={{
                  position: 'absolute', left: `${l}%`, top: `${t}%`, width: 3, height: 3, borderRadius: 999,
                  background: 'rgba(255,255,255,0.95)',
                }} />
              ))}
            </div>
          ))}
        </div>
        <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>統括AI</span>
      </div>

      {people.map(({ x, y, id, gate, phase, in: show }, i) => {
        const e = employee(id);
        return (
          /* **ゆらぎは中の層に掛ける。** 外側に掛けると transform が上書きされて
             真ん中合わせ（translate -50%）が消え、球が輪から半個ぶんずれる。
             **押しても飛ばない。** 指が乗ったら、下のAI社員の一覧の同じ人が明るくなる */
          <div key={`${id}-${x}`}
            onPointerEnter={() => onHover?.(id)} onPointerLeave={() => onHover?.('')}
            style={{
            position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
            display: 'flex', whiteSpace: 'nowrap',
            animation: `flowfade ${DOT} ${show}s backwards`,
          }}>
            <span style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              animation: `drift 6.5s ease-in-out ${(i * 1.4).toFixed(1)}s infinite`,
            }}>
              <span style={{ position: 'relative', display: 'flex' }}>
                <Star color={AGENT_COLOR[e.color]} on={lit === id} />
                <Orb color={AGENT_COLOR[e.color]} size={ORB} seed={e.name.length * 7 + 3} />
              </span>
                <span style={{ color: lit === id ? '#EDEDED' : gate ? AMBER_T : T2, fontSize: 11.5 }}>{e.name}</span>
              {phase && <span style={{ color: T5, fontSize: 10 }}>{phase}</span>}
            </span>
          </div>
        );
      })}
      </>}
    </div>
  );
}
