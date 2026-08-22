'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref } from '@/lib/use-open';

import { Orb } from '@/components/ui/Orb';
import { Icon } from '@/components/ui/Icon';
import { AGENT_COLOR, WORKS, employee } from '@/lib/dummy';

/**
 * オフィス＝1枚の絵だけ。
 *   軌道 = Work。1本の輪が1つの Work で、輪そのものが進捗の計器になる。
 *   真上がはじまり、時計回りに済んだぶんだけ明るい弧。数字は書かない。
 *   社員は担当している Work の輪の上に立つ。輪のどこにいるか＝タスクがどこまで来ているか。
 *   **判断待ちの Work をいちばん内側に置く**（社長がまず見るものが中心に近い）。
 *   「あなた」は描かない。社長は統括AIより上にいる存在で、社員の一部ではない。
 */

const OW = 1148, OH = 760, CX = 574, CY = 330;
const T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400';

/** 輪の大きさ（内側から） */
const RINGS = [
  { rx: 280, ry: 158 },
  { rx: 380, ry: 215 },
  { rx: 470, ry: 266 },
];
/** 名前は輪の外側、左上の空いているところに。輪ごとに角度を変えて重ならないようにする */
const LANGS = [200, 215, 230];
/** 統括AIの球と社員の球のぶんだけ、線の両端を空ける */
const GAP0 = 66, GAP1 = 56;

/** 背景の瞬き。[left%, top%, 遅れ秒] */
const SPECKS: [number, number, number][] = [
  [9, 20, 0.35], [24, 60, 1.2], [33, 10, 0.6], [41, 84, 1.9], [47, 16, 2.4], [56, 80, 0.9],
  [63, 28, 1.6], [71, 90, 0.2], [78, 12, 2.1], [87, 62, 1.1], [93, 24, 0.7], [16, 84, 2.6],
  [52, 93, 1.4], [68, 8, 0.4], [29, 40, 1.05], [84, 44, 2.2],
];
const CORE: [number, number, number][] = [
  [38, 30, 0], [58, 46, 0.8], [44, 60, 1.5], [62, 32, 2.2], [50, 42, 1.1], [34, 52, 1.8],
];

/** Math.cos/sin は実装で最後の桁が変わる。server と client でずれるので必ず丸める */
const r2 = (n: number) => Number(n.toFixed(2));

const on = (rx: number, ry: number, pct: number) => {
  const a = ((-90 + (360 * pct) / 100) * Math.PI) / 180;
  return [r2(CX + rx * Math.cos(a)), r2(CY + ry * Math.sin(a))] as const;
};

function arc(rx: number, ry: number, pct: number) {
  if (pct <= 0) return null;
  const [x1, y1] = on(rx, ry, pct);
  const large = pct > 50 ? 1 : 0;
  return <path d={`M ${CX} ${CY - ry} A ${rx} ${ry} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
               fill="none" stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" />;
}

export function Office() {
  /** 判断待ちの Work をいちばん内側へ。あとは Work の並びのまま */
  const works = [...WORKS].sort((a, b) => Number(!!b.gate) - Number(!!a.gate));

  const rings: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  const people: { x: number; y: number; e: ReturnType<typeof employee>; dim: boolean }[] = [];

  works.forEach((w, i) => {
    const { rx, ry } = RINGS[i];
    const a = (LANGS[i] * Math.PI) / 180;
    const lx = r2(CX + rx * Math.cos(a)), ly = r2(CY + ry * Math.sin(a));
    const [ex, ey] = on(rx, ry, w.progress);
    rings.push(
      <g key={w.id}>
        <ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="#1B1B1B" strokeWidth={1} />
        {arc(rx, ry, w.progress)}
        <line x1={CX} y1={CY - ry - 5} x2={CX} y2={CY - ry + 5} stroke="#2E2E2E" strokeWidth={1} />
        <line x1={r2(lx - 7)} y1={ly} x2={r2(lx + 2)} y2={ly} stroke="#2E2E2E" strokeWidth={1} />
        {/* 弧の先端＝その Work のいま。判断待ちの Work だけ橙の菱形 */}
        {w.gate
          ? <>
              <rect x={ex - 4.5} y={ey - 4.5} width={9} height={9} rx={1.6} fill={AMBER}
                    transform={`rotate(45 ${ex.toFixed(1)} ${ey.toFixed(1)})`} />
              <circle cx={ex} cy={ey} r={11} fill="rgba(227,116,0,0.14)" />
            </>
          : <circle cx={ex} cy={ey} r={2.6} fill="#7A7A7A" />}
      </g>,
    );
    labels.push(
      <Link key={w.id} href={`/work/${w.id}`} className="lnk" style={{
        position: 'absolute', left: r2(lx - 7), top: ly, transform: 'translate(-100%, -50%)',
        paddingRight: 9, color: T4, fontSize: 11, whiteSpace: 'nowrap',
      }}>{w.title}</Link>,
    );
    w.crew.forEach((c) => {
      const [x, y] = on(rx, ry, c.ring);
      people.push({ x, y, e: employee(c.id), dim: !!c.dim });
    });
  });

  return (
    /* 盤面は大きさが決まっていて中身も外に出ない。**外の計算から切り離す** —
       入力欄に1文字打つたびに、ここの何千個もの粒まで 数え直さなくてよくなる */
    <div style={{ position: 'relative', width: OW, height: OH, flexShrink: 0, overflow: 'hidden', contain: 'strict' }}>
      <svg width={OW} height={OH} viewBox={`0 0 ${OW} ${OH}`} style={{ position: 'absolute', inset: 0 }}>
        {rings}
        {/* 外周の目盛り */}
        {Array.from({ length: 64 }, (_, i) => {
          const ang = (i * (360 / 64) * Math.PI) / 180;
          const lg = i % 4 === 0;
          const r1 = lg ? 0.965 : 0.982;
          return <line key={i}
            x1={r2(CX + 500 * r1 * Math.cos(ang))} y1={r2(CY + 283 * r1 * Math.sin(ang))}
            x2={r2(CX + 500 * Math.cos(ang))} y2={r2(CY + 283 * Math.sin(ang))}
            stroke={lg ? '#1E1E1E' : '#151515'} />;
        })}
      </svg>

      {labels}

      {SPECKS.map(([l, t, d]) => (
        <div key={`${l}-${t}`} style={{
          position: 'absolute', left: `${l}%`, top: `${t}%`, width: 2, height: 2, borderRadius: 999,
          background: 'rgba(255,255,255,0.35)', animation: `blink 3.2s ease-in-out ${d}s infinite`,
        }} />
      ))}

      {/* 統括AIから社員への受け渡し。**粒が流れているときだけ動いている** */}
      {people.map(({ x, y, e, dim }) => {
        const dx = x - CX, dy = y - CY;
        const len = Math.hypot(dx, dy);
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const c = AGENT_COLOR[e.color];
        return (
          <div key={`l-${e.id}`} style={{
            position: 'absolute',
            left: r2(CX + (GAP0 * dx) / len), top: r2(CY + (GAP0 * dy) / len),
            width: r2(len - GAP0 - GAP1), height: 1, background: dim ? '#141414' : '#1F1F1F',
            transformOrigin: '0 50%', transform: `rotate(${deg.toFixed(2)}deg)`,
          }}>
            {!dim && [0, 1.2].map((d) => (
              <div key={d} style={{
                position: 'absolute', top: -3, left: 0, width: 7, height: 7, borderRadius: 999, background: c,
                boxShadow: `0 0 9px ${c}CC`,
                // 線の長さを渡して transform で流す（left を動かすと毎フレーム計算し直しになる）
                ['--len' as string]: `${r2(len - GAP0 - GAP1)}px`,
                animation: `travel 3s linear ${d}s infinite reverse`,
                willChange: 'transform',
              }} />
            ))}
          </div>
        );
      })}

      {/* 統括AI（白）。社長は描かない */}
      <Link href="/chat/new" className="hit" style={{
        position: 'absolute', left: CX, top: CY, transform: 'translate(-50%, -50%)', color: '#E8E8E8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <div style={{
            position: 'absolute', inset: -18, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(255,255,255,0.07), rgba(255,255,255,0) 66%)',
            filter: 'blur(12px)', animation: 'breathe 4.2s ease-in-out infinite',
          }} />
          <span style={{ position: 'absolute', inset: 0 }}><Orb color="#D2D2D2" size={112} seed={7} /></span>
          {CORE.map(([l, t, d]) => (
            <div key={`${l}-${t}`} style={{
              position: 'absolute', left: `${l}%`, top: `${t}%`, width: 3, height: 3, borderRadius: 999,
              background: 'rgba(255,255,255,0.95)', animation: `blink 2.6s ease-in-out ${d}s infinite`,
            }} />
          ))}
        </div>
        <span style={{ whiteSpace: 'nowrap', fontSize: 14 }}>統括AI</span>
      </Link>

      {people.map(({ x, y, e, dim }, i) => (
        <Link key={e.id} href={openHref('/team', e.id)} className="hit" style={{
          position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          animation: dim ? undefined : `drift 6.5s ease-in-out ${(i * 1.4).toFixed(1)}s infinite`,
        }}>
          <Orb color={AGENT_COLOR[e.color]} size={88} seed={e.name.length * 7 + 3} dim={dim} />
          <span style={{ color: dim ? T5 : T2, whiteSpace: 'nowrap', fontSize: 13 }}>{e.name}</span>
        </Link>
      ))}

      {/* 拡大縮小・移動（Figma のような形） */}
      <div style={{
        position: 'absolute', left: 10, top: 10, display: 'flex', alignItems: 'center', gap: 4,
        padding: 5, borderRadius: 12, background: '#101010', border: '1px solid #262626',
      }}>
        <span className="hit" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 10px', color: '#8B8B8B', fontSize: 12 }}>
          <Icon name="search" color={T4} size={13} />100%
        </span>
        <span style={{ width: 1, height: 16, background: '#242424' }} />
        {(['plus', 'minus', 'expand'] as const).map((n, i) => (
          <span key={n} className={i === 2 ? 'hit' : 'icob'} style={{
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: i === 2 ? '#1C1C1C' : undefined,
          }}><Icon name={n} color={i === 2 ? T2 : T4} size={14} /></span>
        ))}
      </div>
    </div>
  );
}
