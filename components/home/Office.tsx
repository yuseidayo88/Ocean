'use client';

import { Orb } from '@/components/ui/Orb';
import { Icon } from '@/components/ui/Icon';
import { AGENT_COLOR, EMPLOYEES, WORKS, employee } from '@/lib/dummy';

/**
 * オフィス＝1枚の絵だけ。
 *   軌道 = Work。1本の輪が1つの Work で、輪そのものが進捗の計器になる。
 *   真上がはじまり、時計回りに済んだぶんだけ明るい弧。数字は書かない。
 *   社員は担当している Work の輪の上に立つ。輪のどこにいるか＝タスクがどこまで来ているか。
 *   「あなた」は描かない。社長は統括AIより上にいる存在で、社員の一部ではない。
 */

const OW = 1148, OH = 760, CX = 574, CY = 330;
const T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400';

/** 輪の大きさ（内側から）。Work の並び順に対応する */
const RINGS = [
  { rx: 280, ry: 158 },
  { rx: 380, ry: 215 },
  { rx: 470, ry: 266 },
];
/** 名前は輪の外側、左上の空いているところに。輪ごとに角度を変えて重ならないようにする */
const LANGS = [200, 215, 230];

const on = (rx: number, ry: number, pct: number) => {
  const a = ((-90 + (360 * pct) / 100) * Math.PI) / 180;
  return [CX + rx * Math.cos(a), CY + ry * Math.sin(a)] as const;
};

function arc(rx: number, ry: number, pct: number) {
  if (pct <= 0) return null;
  const [x1, y1] = on(rx, ry, pct);
  const large = pct > 50 ? 1 : 0;
  return <path d={`M ${CX} ${CY - ry} A ${rx} ${ry} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
               fill="none" stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" />;
}

export function Office() {
  const running = EMPLOYEES.filter((e) => e.state === '実行中').length;

  const rings: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  WORKS.forEach((w, i) => {
    const { rx, ry } = RINGS[i];
    const a = (LANGS[i] * Math.PI) / 180;
    const lx = CX + rx * Math.cos(a), ly = CY + ry * Math.sin(a);
    rings.push(
      <g key={w.id}>
        <ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="#1B1B1B" strokeWidth={1} />
        {arc(rx, ry, w.progress)}
        <line x1={CX} y1={CY - ry - 5} x2={CX} y2={CY - ry + 5} stroke="#2E2E2E" strokeWidth={1} />
        <line x1={lx - 7} y1={ly} x2={lx + 2} y2={ly} stroke="#2E2E2E" strokeWidth={1} />
        {/* 弧の先端＝その Work のいま。判断待ちの Work だけ橙の菱形 */}
        {w.gate
          ? <>
              <rect x={on(rx, ry, w.progress)[0] - 4.5} y={on(rx, ry, w.progress)[1] - 4.5}
                    width={9} height={9} rx={1.6} fill={AMBER}
                    transform={`rotate(45 ${on(rx, ry, w.progress)[0]} ${on(rx, ry, w.progress)[1]})`} />
              <circle cx={on(rx, ry, w.progress)[0]} cy={on(rx, ry, w.progress)[1]} r={11}
                      fill="rgba(227,116,0,0.14)" />
            </>
          : <circle cx={on(rx, ry, w.progress)[0]} cy={on(rx, ry, w.progress)[1]} r={2.6} fill="#7A7A7A" />}
      </g>,
    );
    labels.push(
      <div key={w.id} style={{
        position: 'absolute', left: lx - 9, top: ly, transform: 'translate(-100%, -50%)',
        paddingRight: 9, color: T4, fontSize: 11, whiteSpace: 'nowrap',
      }}>{w.title}</div>,
    );
  });

  // 社員は担当 Work の輪の上に立つ
  const people = WORKS.flatMap((w, i) =>
    w.crew.map((c) => {
      const e = employee(c.id);
      const [x, y] = on(RINGS[i].rx, RINGS[i].ry, c.ring);
      return { x, y, e, dim: Boolean(c.dim) };
    }),
  );

  return (
    <div style={{ position: 'relative', width: OW, height: OH, flexShrink: 0, overflow: 'hidden' }}>
      <svg width={OW} height={OH} viewBox={`0 0 ${OW} ${OH}`} style={{ position: 'absolute', inset: 0 }}>
        {rings}
        {/* 外周の目盛り */}
        {Array.from({ length: 64 }, (_, i) => {
          const ang = (i * (360 / 64) * Math.PI) / 180;
          const lg = i % 4 === 0;
          const r1 = lg ? 0.965 : 0.982;
          return <line key={i}
            x1={CX + 500 * r1 * Math.cos(ang)} y1={CY + 283 * r1 * Math.sin(ang)}
            x2={CX + 500 * Math.cos(ang)} y2={CY + 283 * Math.sin(ang)}
            stroke={lg ? '#1E1E1E' : '#151515'} />;
        })}
        {/* 統括AIから各社員へ、受け渡しの線 */}
        {people.map(({ x, y, e, dim }) => (
          <line key={`l-${e.id}`} x1={CX} y1={CY} x2={x} y2={y} stroke={dim ? '#141414' : '#1F1F1F'} strokeWidth={1} />
        ))}
      </svg>

      {labels}

      {/* 統括AI（白）。社長は描かない */}
      <div style={{
        position: 'absolute', left: CX, top: CY, transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <div style={{
            position: 'absolute', inset: -18, borderRadius: 999,
            background: 'radial-gradient(circle, rgba(255,255,255,0.07), rgba(255,255,255,0) 66%)',
            filter: 'blur(12px)', animation: 'breathe 4.2s ease-in-out infinite',
          }} />
          <span style={{ position: 'absolute', inset: 0 }}><Orb color="#D2D2D2" size={112} seed={7} /></span>
        </div>
        <span style={{ whiteSpace: 'nowrap', fontSize: 14 }}>統括AI</span>
      </div>

      {people.map(({ x, y, e, dim }) => (
        <div key={e.id} style={{
          position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <Orb color={AGENT_COLOR[e.color]} size={88} seed={e.name.length * 7 + 3} dim={dim} />
          <span style={{ color: dim ? T5 : T2, whiteSpace: 'nowrap', fontSize: 13 }}>{e.name}</span>
        </div>
      ))}

      {/* 拡大縮小・移動（Figma のような形） */}
      <div style={{
        position: 'absolute', left: 10, top: 10, display: 'flex', alignItems: 'center', gap: 4,
        padding: 5, borderRadius: 12, background: '#101010', border: '1px solid #262626',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 10px', color: '#8B8B8B', fontSize: 12 }}>
          <Icon name="search" color={T4} size={13} />100%
        </span>
        <span style={{ width: 1, height: 16, background: '#242424' }} />
        {(['plus', 'close', 'panel'] as const).map((n, i) => (
          <span key={n} style={{
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: i === 2 ? '#1C1C1C' : undefined,
          }}><Icon name={n} color={i === 2 ? T2 : T4} size={14} /></span>
        ))}
      </div>

      <div style={{ position: 'absolute', right: 16, top: 14, color: T5, fontSize: 12 }} className="tnum">
        稼働 {running} / {EMPLOYEES.length}
      </div>
    </div>
  );
}
