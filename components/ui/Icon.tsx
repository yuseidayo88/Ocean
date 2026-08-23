import { AMBER, T4 } from '@/lib/design/tokens';/** 線のアイコン。行の先頭では**裸で置く**（四角で囲わない） */

export const ICONS = {
  bolt: <path d="M13 3.5 6.5 13.2H11l-1 7.3 6.5-9.7H12l1-7.3z" />,
  home: <><path d="m4 11 8-7 8 7" /><path d="M6.5 9.4V20h11V9.4" /></>,
  inbox: <><rect x="4" y="5.5" width="16" height="13.5" rx="2" /><path d="M4 13.2h4.2l1.5 2.2h4.6l1.5-2.2H20" /></>,
  chat: <path d="M20.5 11.5c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20l1.5-3.6A6.9 6.9 0 0 1 3.5 11.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" />,
  work: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8.2 12.2 2.4 2.4 4.6-5" /></>,
  deliv: <><path d="M13.5 3.5H7.4A1.9 1.9 0 0 0 5.5 5.4v13.2a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V8.5z" /><path d="M13.5 3.5v5h5" /></>,
  team: <><circle cx="9.2" cy="8.6" r="3.1" /><path d="M4 19.2c0-2.9 2.3-5.2 5.2-5.2s5.2 2.3 5.2 5.2" /><path d="M15.6 5.9a3 3 0 0 1 0 5.5M17.6 14.4c1.8.8 3 2.6 3 4.8" /></>,
  dec: <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />,
  back: <path d="m14 6-6 6 6 6" />,
  fwd: <path d="m10 6 6 6-6 6" />,
  panel: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M9.5 5v14" /></>,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  close: <path d="M7 7l10 10M17 7L7 17" />,
  chev: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  up: <path d="m6 14.5 6-6 6 6" />,
  check: <path d="m5 12.5 4 4 9-10" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.6 12h16.8M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z" /></>,
  roadmap: <><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><path d="M6 8.2v7.6M8.2 6H15a3 3 0 0 1 3 3v0" /></>,
  /** 歯のある閉じた輪郭。丸＋放射線8本だと 15px では明るさのアイコンに見える。
      歯は6枚・谷を深く。5枚だと花、8枚だと点線の輪になる */
  gear: <><path d="M9.77 2.05 L14.23 2.05 L14.11 5.74 L16.36 7.05 L19.51 5.10 L21.73 8.95 L18.47 10.70 L18.47 13.30 L21.73 15.05 L19.51 18.90 L16.36 16.95 L14.11 18.26 L14.23 21.95 L9.77 21.95 L9.89 18.26 L7.64 16.95 L4.49 18.90 L2.27 15.05 L5.53 13.30 L5.53 10.70 L2.27 8.95 L4.49 5.10 L7.64 7.05 L9.89 5.74 Z" /><circle cx="12" cy="12" r="2.9" /></>,
  upload: <><path d="M12 16V5" /><path d="m7.5 9.5 4.5-4.5 4.5 4.5" /><path d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5" /></>,
  download: <><path d="M12 5v11" /><path d="m7.5 11.5 4.5 4.5 4.5-4.5" /><path d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5" /></>,
  edit: <><path d="M15.5 4.5 19 8l-9.5 9.5H6V14z" /></>,
  trash: <><path d="M5 7h14" /><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" /><path d="M6.5 7v11.4A1.6 1.6 0 0 0 8.1 20h7.8a1.6 1.6 0 0 0 1.6-1.6V7" /></>,
  pencil: <path d="M15.5 4.5 19 8l-9.5 9.5H6V14z" />,
  bars: <><path d="M5 18v-5M12 18V7M19 18v-9" /></>,
  play: <path d="M8 5.5 18 12 8 18.5z" />,
  pause: <><path d="M9 5.5v13M15 5.5v13" /></>,
  hand: <path d="M8 12.5V6.2a1.4 1.4 0 0 1 2.8 0v5M10.8 11V5.2a1.4 1.4 0 0 1 2.8 0v5.6M13.6 11.2V6.4a1.4 1.4 0 0 1 2.8 0V14c0 3.3-2 5.8-5 5.8-2.6 0-3.9-1.4-5.2-3.6l-1.5-2.6a1.4 1.4 0 0 1 2.3-1.6l.8 1.1" />,
  expand: <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />,
  minus: <path d="M6 12h12" />,
  panelr: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M14.5 5v14" /></>,
  collapse: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M9.5 5v14" /><path d="m6.8 10.4-1.6 1.6 1.6 1.6" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" /><path d="M4.2 4.6v3.9h3.9" /><path d="M12 8v4.3l2.8 1.7" /></>,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, color = `${T4}`, size = 15, width = 1.5 }:
  { name: IconName; color?: string; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
         style={{ flexShrink: 0, display: 'block' }}>
      {ICONS[name]}
    </svg>
  );
}

/** 状態の点。凡例は置かない */
export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: color, flexShrink: 0, display: 'inline-block' }} />;
}

/** 判断の菱形。判断待ちのときだけ使う */
export function Diamond({ color = `${AMBER}`, size = 10, glow = true }:
  { color?: string; size?: number; glow?: boolean }) {
  return (
    <span style={{
      width: size, height: size, background: color, transform: 'rotate(45deg)',
      borderRadius: 2, flexShrink: 0, display: 'inline-block',
      boxShadow: glow ? '0 0 0 3px rgba(227,116,0,0.18)' : undefined,
    }} />
  );
}
