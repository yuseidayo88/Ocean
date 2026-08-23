'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { openHref } from '@/lib/use-open';
import { Orb } from '@/components/ui/Orb';
import { useRail } from '@/lib/use-rail';
import { EASE } from '@/lib/design/tokens';
import {
  AGENT_COLOR, EMPLOYEES, EVENTS, EXEC,
  type Desk, type Employee, type Produce, type State,
} from '@/lib/dummy';

/**
 * ホームのオフィスの、絵の外にあるもの。
 *   右＝**ログ**（縦にスクロール。下端はグラデーションに溶かして「まだある」と分かる）
 *   下＝**AI社員**（横にスクロール。1人ぶんの幅は固定して、増えても縮めない）
 *
 * 社員の計器は**担当ではなく produces で決める**（業種を埋め込まない）。
 * 統括AIは AI社員ではないので、左に分けて置き、人数にも入れない。
 */

const T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F', DIM = '#3A3A3A';
const HAIR = '#161616';
const GREEN = '#1E8E3E', AMBER = '#E37400';
const GREEN_T = '#5BB974', AMBER_T = '#FDD663', RED_T = '#F28B82';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const STATE_C: Record<string, [string, string]> = {
  実行中: [GREEN, GREEN_T], 要確認: [AMBER, AMBER_T], 判断待ち: [AMBER, AMBER_T], 待機: ['#4A4A4A', T4],
};
const TONE: Record<string, string> = { gate: AMBER_T, ok: GREEN_T, bad: RED_T };

const Mono = ({ t, c = DIM }: { t: string; c?: string }) => (
  <span style={{ fontFamily: MONO, fontSize: 10.5, color: c, whiteSpace: 'nowrap' }}>{t}</span>
);

// ── 右: 今日の出来事 ─────────────────────────────────────────

export function OfficeLog({ w = 288 }: { w?: number }) {
  return (
    <div style={{
      width: w, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: `1px solid ${HAIR}`, paddingLeft: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 2 }}>
        <span style={{ color: T5, fontSize: 11 }}>ログ</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T5, fontSize: 10.5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 9, background: GREEN }} />稼働中
        </span>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div className="sy" style={{ position: 'absolute', inset: 0, paddingRight: 8 }}>
          {EVENTS.map((e, i) => (
            <div key={`${e.at}-${i}`} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
              borderBottom: i === EVENTS.length - 1 ? undefined : '1px solid #131313',
            }}>
              <span style={{ color: DIM, fontSize: 10.5, width: 34, flexShrink: 0, paddingTop: 1 }} className="tnum">{e.at}</span>
              <span style={{ color: T5, fontSize: 11, width: 52, flexShrink: 0, paddingTop: 1 }}>{e.who}</span>
              <span style={{ flex: 1, minWidth: 0, color: e.tone ? TONE[e.tone] : '#8B8B8B', fontSize: 11.5, lineHeight: '17px' }}>
                {e.what}
              </span>
            </div>
          ))}
        </div>
        {/* 下端を黒に溶かす。**まだ下にあることを、絵のほうで言う** */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, pointerEvents: 'none',
          background: 'linear-gradient(rgba(0,0,0,0), #000)',
        }} />
      </div>
    </div>
  );
}

// ── 下: AI社員 ──────────────────────────────────────────────

/** 出したもの。**器は produces で決める** — レールを見るだけで職種が分かる */
function Meter({ p, color }: { p: Produce; color: string }) {
  if (p.kind === 'text') return <Mono t={p.cap} c={T5} />;
  const fig =
    p.kind === 'squares' ? (
      <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
        {Array.from({ length: p.n }, (_, i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: 1, background: color, opacity: i < p.filled ? 0.85 : 0.16 }} />
        ))}
      </span>
    ) : p.kind === 'lines' ? (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
        {[40, 33, 22].map((wd, i) => (
          <span key={wd} style={{ width: wd, height: 2, borderRadius: 1, background: color, opacity: [0.75, 0.55, 0.35][i] }} />
        ))}
      </span>
    ) : p.kind === 'dots' ? (
      <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
        {Array.from({ length: p.n }, (_, i) => (
          <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: color, opacity: i < p.ok ? 0.9 : 0.16 }} />
        ))}
      </span>
    ) : (
      <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
        {Array.from({ length: p.n }, (_, i) => (
          <span key={i} style={{ width: 15, height: 7, borderRadius: 2, background: color, opacity: i < p.done ? 0.85 : 0.14 }} />
        ))}
      </span>
    );
  return <>{fig}<Mono t={p.cap} /></>;
}

/**
 * run_steps を1本に畳む。済＝暗い / いま＝明るい / これから＝暗い面。
 * **いまやっている1つだけ脈打つ**（動いているという事実なので、動きを減らす設定でも止めない）。
 */
function Steps({ done, all, color, run, w = 70 }: {
  done: number; all: number; color: string; run?: boolean; w?: number;
}) {
  const cw = (w - (all - 1) * 3) / all;
  return (
    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
      {Array.from({ length: all }, (_, i) => (
        <span key={i} style={{
          width: cw, height: 4, borderRadius: 2,
          background: i < done ? color : i === done ? color : '#191919',
          opacity: i < done ? 0.45 : 1,
          animation: run && i === done ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }} />
      ))}
    </span>
  );
}

function Card({ who, first, lit, onHover }: {
  who: { id: string; name: string; state: State; now: string; model: string; effort: number; desk: Desk; color: string };
  first?: boolean; lit?: boolean; onHover?: (id: string) => void;
}) {
  const [dot, word] = STATE_C[who.state] ?? STATE_C['実行中'];
  const d = who.desk;
  return (
    /* **絵の中の球と対。** 上で指が乗ったら、ここが明るくなる（その逆も） */
    <div onPointerEnter={() => onHover?.(who.id)} onPointerLeave={() => onHover?.('')}
      style={{
      width: 186, flex: '0 0 186px', boxSizing: 'content-box',
      borderLeft: first ? undefined : `1px solid ${HAIR}`, paddingLeft: first ? 0 : 20,
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
      background: lit ? 'rgba(255,255,255,0.03)' : undefined,
      borderRadius: lit ? 10 : undefined, transition: `background ${EASE}`,
    }}>
      <Link href={openHref('/team', who.id) as Route} className="lnk"
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 26 }}>
        <Orb color={who.color} size={26} seed={who.name.length * 7 + 3} />
        <span style={{ fontSize: 13 }}>{who.name}</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 14 }}>
        <span style={{ width: 5, height: 5, borderRadius: 9, background: dot, flexShrink: 0 }} />
        <span style={{ color: word, fontSize: 10.5 }}>{who.state}</span>
        {who.state === '要確認' && (
          <Link href="/deliverables?open=d-rev" className="hit"
                style={{ width: 9, height: 11, border: `1px solid ${AMBER}`, borderRadius: 2, flexShrink: 0 }} />
        )}
        <span style={{ color: T5, fontSize: 10.5, whiteSpace: 'nowrap' }}>·  {who.model} · 深さ {who.effort}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, height: 17 }}>
        <span style={{ color: T2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who.now}</span>
        <div style={{ flex: 1 }} />
        {d.el && <Mono t={d.el} c={T5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 14 }}>
        <Steps done={d.step.done} all={d.step.all} color={who.color} run={who.state === '実行中'} />
        <span style={{ color: T5, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {d.step.done} / {d.step.all} · {d.step.name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 13 }}>
        <Meter p={d.produce} color={who.color} />
        <div style={{ flex: 1 }} />
        {d.wait > 0 && <Mono t={`待ち ${d.wait}`} c={T5} />}
      </div>
    </div>
  );
}

export function OfficeTeam({ lit, onHover }: { lit?: string; onHover?: (id: string) => void }) {
  const [rail, edge] = useRail<HTMLDivElement>();
  return (
    /* **見出しは置かない。** 顔と名前が並んでいれば「AI社員」だと分かるし、
       人数も稼働も1枚ずつのカードが言っている（同じことを2回書かない） */
    <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 16 }}>
      {/* 人が増えたら横に送る。**1人ぶんの幅は縮めない。**
          縦のホイールも横に効かせる（横一列はそう動くのが当たり前） */}
      <div style={{ position: 'relative' }}>
        <div ref={rail} className="sx"
             style={{ display: 'flex', gap: 20, alignItems: 'flex-start', paddingBottom: 6 }}>
          <Card first who={{ ...EXEC, now: EXEC.now, color: EXEC.color }}
                lit={lit === EXEC.id} onHover={onHover} />
          {EMPLOYEES.map((e: Employee) => (
            <Card key={e.id} who={{ ...e, color: AGENT_COLOR[e.color] }}
                  lit={lit === e.id} onHover={onHover} />
          ))}
        </div>
        {/* 端は黒に溶かす。**本当にまだあるときだけ** */}
        {(['l', 'r'] as const).map((k) => (
          <div key={k} style={{
            position: 'absolute', top: 0, bottom: 6, width: 44, pointerEvents: 'none',
            [k === 'l' ? 'left' : 'right']: 0,
            opacity: edge[k] ? 1 : 0, transition: `opacity ${EASE}`,
            background: `linear-gradient(to ${k === 'l' ? 'right' : 'left'}, #000, rgba(0,0,0,0))`,
          }} />
        ))}
      </div>
    </div>
  );
}
