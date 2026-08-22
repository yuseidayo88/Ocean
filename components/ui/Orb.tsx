/**
 * AI社員のアバターは粒子で描く（→ docs/design/03-agent-schema.md）。
 * 点の緯度リングでできた球 ＋ 芯の格子 ＋ 外へ伸びるスポーク ＋ 散り ＋ 芯。
 * 社員ごとに変わるのは**色だけ**。形は同じ言語。
 * 40px 未満は球をやめて同心リングと芯だけにする（表のアイコンで潰れない）。
 */

function rng(seed: number) {
  let a = seed * 7919 + 13;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexRgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

type Props = { color: string; size?: number; seed?: number; dim?: boolean; spin?: boolean };

export function Orb({ color, size = 88, seed = 1, dim = false, spin = true }: Props) {
  const rgb = hexRgb(color);
  const rand = rng(seed);
  const A = dim ? 0.4 : 1;
  const uid = `o${seed}${size}`;
  const rgba = (a: number) => `rgba(${rgb},${Math.max(0, Math.min(1, a * A)).toFixed(3)})`;

  const tier = size >= 72 ? 2 : size >= 40 ? 1 : 0;
  const [LAT, LATTICE, SPOKES, SCAT, DOT, R, BOOST, CORE] = [
    [5, 0, 0, 0, 1.7, 40, 1.55, 3.0],
    [9, 7, 13, 10, 1.0, 36, 1.2, 2.1],
    [13, 11, 22, 30, 0.7, 34, 1.0, 1.7],
  ][tier];

  const spinEl = (dur: number, rev = false) =>
    !spin || dim ? null : (
      <animateTransform
        attributeName="transform" type="rotate"
        from={`${rev ? 360 : 0} 50 50`} to={`${rev ? 0 : 360} 50 50`}
        dur={`${dur}s`} repeatCount="indefinite"
      />
    );

  const body: React.ReactNode[] = [];

  if (tier === 0) {
    [[23, 11], [35, 18]].forEach(([r2, n], ri) => {
      const dots = [];
      for (let k = 0; k < n; k++) {
        const a = ((k * 360) / n + (ri ? 18 : 0)) * (Math.PI / 180);
        dots.push(<circle key={k} cx={(50 + r2 * Math.cos(a)).toFixed(1)} cy={(50 + r2 * Math.sin(a)).toFixed(1)} r={1.6} />);
      }
      body.push(
        <g key={`r${ri}`} fill={rgba(ri ? 0.75 : 0.5)}>
          <g>{dots}{spinEl(30 + ri * 24, Boolean(ri))}</g>
        </g>,
      );
    });
    body.push(<circle key="h" cx="50" cy="50" r="9" fill={rgba(0.3)} />);
    body.push(<circle key="c" cx="50" cy="50" r="4.4" fill={`rgba(255,255,255,${(0.92 * A).toFixed(2)})`} />);
  } else {
    // 点でつくる球（緯度リング）。手前の粒ほど明るい
    const sphere: React.ReactNode[] = [];
    let n = 0;
    for (let i = 0; i < LAT; i++) {
      const t = (i + 0.5) / LAT;
      const y = 50 - R + t * 2 * R;
      const rx = Math.sqrt(Math.max(0, R * R - (y - 50) ** 2));
      if (rx < 2) continue;
      const ry = Math.max(1.4, rx * 0.3);
      const cnt = Math.max(9, Math.floor(rx * 1.2));
      for (let k = 0; k < cnt; k++) {
        const a = ((k * 360) / cnt + (rand() * 6 - 3)) * (Math.PI / 180);
        const near = 0.5 + 0.5 * Math.sin(a);
        const op = Math.min(0.95, (0.22 + 0.5 * near) * BOOST);
        const rr = DOT * (0.65 + rand() * 0.5);
        sphere.push(
          <circle key={n++} cx={(50 + rx * Math.cos(a)).toFixed(1)} cy={(y + ry * Math.sin(a)).toFixed(1)}
                  r={rr.toFixed(1)} fill={rgba(op)} />,
        );
      }
    }
    body.push(<g key="sph">{sphere}{spinEl(96)}</g>);

    // 芯の格子（放射線 × 同心円のモアレ）
    const lat: React.ReactNode[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i * 18) * (Math.PI / 180);
      lat.push(<line key={`l${i}`} x1="50" y1="50" x2={(50 + 22 * Math.cos(a)).toFixed(1)}
                     y2={(50 + 22 * Math.sin(a)).toFixed(1)} stroke={rgba(0.34)} strokeWidth={0.3} />);
    }
    for (let i = 0; i < LATTICE; i++) {
      lat.push(<circle key={`c${i}`} cx="50" cy="50" r={(3.4 + i * 1.85).toFixed(1)} fill="none"
                       stroke={rgba(0.34)} strokeWidth={0.34} />);
    }
    body.push(<g key="lat" clipPath={`url(#${uid}_c)`}>{lat}{spinEl(52)}</g>);

    // 外へ伸びるスポーク（先端に点）
    const sp: React.ReactNode[] = [];
    for (let i = 0; i < SPOKES; i++) {
      const a = ((i * 360) / SPOKES + (rand() * 10 - 5)) * (Math.PI / 180);
      const r0 = R + 0.5 + rand() * 3;
      const r1 = r0 + 4 + rand() * 11;
      const op = 0.14 + rand() * 0.32;
      const x1 = 50 + r0 * Math.cos(a), y1 = 50 + r0 * Math.sin(a);
      const x2 = 50 + r1 * Math.cos(a), y2 = 50 + r1 * Math.sin(a);
      sp.push(<line key={`s${i}`} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
                    stroke={rgba(op)} strokeWidth={(0.4 + rand() * 0.4).toFixed(2)} strokeLinecap="round" />);
      if (rand() < 0.55) {
        sp.push(<circle key={`sd${i}`} cx={x2.toFixed(1)} cy={y2.toFixed(1)}
                        r={(0.4 + rand() * 0.55).toFixed(2)} fill={rgba(op + 0.26)} />);
      }
    }
    body.push(<g key="spk">{sp}{spinEl(68, true)}</g>);

    // 外へ散った粒
    const sc: React.ReactNode[] = [];
    for (let i = 0; i < SCAT; i++) {
      const a = rand() * Math.PI * 2;
      const r = R + 6 + rand() * 12;
      sc.push(<circle key={`x${i}`} cx={(50 + r * Math.cos(a)).toFixed(1)} cy={(50 + r * Math.sin(a)).toFixed(1)}
                      r={(0.3 + rand() * 0.5).toFixed(2)} fill={rgba(0.12 + rand() * 0.28)} />);
    }
    body.push(<g key="sct">{sc}{spinEl(150)}</g>);

    body.push(<circle key="h" cx="50" cy="50" r={tier ? 4.6 : 6} fill={rgba(0.42)} />);
    body.push(
      <circle key="core" cx="50" cy="50" r={CORE} fill={`rgba(255,255,255,${(0.9 * A).toFixed(2)})`}>
        {!dim && (
          <animate attributeName="opacity"
                   values={`${(0.55 * A).toFixed(2)};1;${(0.55 * A).toFixed(2)}`}
                   dur="3.4s" repeatCount="indefinite" />
        )}
      </circle>,
    );
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id={`${uid}_g`}>
            <stop offset="0" stopColor={`rgb(${rgb})`} stopOpacity={0.3 * A} />
            <stop offset="0.5" stopColor={`rgb(${rgb})`} stopOpacity={0.07 * A} />
            <stop offset="1" stopColor={`rgb(${rgb})`} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}_c`}><circle cx="50" cy="50" r="21" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="44" fill={`url(#${uid}_g)`} />
        {body}
      </svg>
    </span>
  );
}
