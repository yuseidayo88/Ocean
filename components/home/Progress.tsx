'use client';

import { Go as Link } from '@/components/ui/Go';
import { useParam } from '@/lib/use-open';

import { Icon } from '@/components/ui/Icon';
import type { Phase, Work } from '@/lib/view/model';

import { AMBER, AMBER_T, DIM, EDGE, FAINT, GREEN_T, HAIR, MUTE, RED_T, SUNK, T1, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * 進捗＝図で読む。中身は「答えの1行」と「タイムライン」だけ。
 *
 * **行は伸ばさない**（2026-08-26 に作り直した。社長の「これマジで見にくい」）。
 * 前は `flex: 1` にしていたので、Work が2つだと1行が 380px になり、
 * 帯どうしが画面半分ぶん離れていた。**Mobbin で見た8アプリ**
 * （Wrike / Airtable / Asana / Jira / ClickUp / Coda / Programa / Height）は
 * **全部、行の高さを固定**していて、行を伸ばして画面を埋めるものは1つも無い。
 * 少ないときに下が空くのは正しい — 埋めるために間延びさせない。
 *
 * **下の黒は、そのまま空けておく。** CLAUDE.md には「下の余白を放置しない」ともあるが、
 * ここで埋められるのは一度消したもの（今週の3数字・件数リスト・最近の成果物）だけで、
 * どれも「数えるだけで誰も動かない」から消した。**正直な空白のほうがましで、
 * Mobbin の Asana / Programa も Work が1つのときはこう見える。**
 */

/** 左の名前の列と、帯とのすき間。**右の列は置かない**（状態も残りも名前の下） */
const LABEL = 210, GAP = 16;
const MAXW = 1420;
/** 1行の高さ（題は2行まで ＋ 状態の1行）と、帯の高さ */
const ROW = 72, BAR = 32, SPLIT = 4;

/**
 * 帯の明るさ。**これから → 済 → いま の順に明るくなる**（3段が離れて見えること）。
 * 前は #1D1D1D / #2E2E2E / 1px の点線 で、純黒の上ではどれも同じに見えていた。
 * 新しい灰色は作らない（`lib/design/tokens.ts` のはしごから取る）。
 */
function Seg({ p }: { p: Phase }) {
  const base: React.CSSProperties = {
    position: 'absolute', left: `${p.x}%`, width: `calc(${p.w}% - ${SPLIT}px)`, top: 0, height: BAR,
    borderRadius: 6, overflow: 'hidden', boxSizing: 'border-box',
  };
  if (p.state === 'done') {
    return <div style={{ ...base, background: EDGE }}><Label c={T3}>{p.name}</Label></div>;
  }
  if (p.state === 'now') {
    return (
      <div style={{ ...base, background: MUTE }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: T1 }} />
        <Label c={T1}>{p.name}</Label>
      </div>
    );
  }
  // これから＝点線（ワークフローの地図と同じ読み方）。**面を敷いて、点線を明るくする** —
  // 線だけだと純黒の上で消える
  return (
    <div style={{ ...base, background: SUNK, border: `1px dashed ${FAINT}` }}>
      <Label c={T5}>{p.name}</Label>
    </div>
  );
}

/** 目盛りの文字。**端では中央合わせをやめる**（左右にはみ出して切れないように） */
const tick = (x: number): React.CSSProperties => ({
  position: 'absolute', bottom: 6, fontSize: 11, whiteSpace: 'nowrap',
  ...(x < 4 ? { left: 0 } : x > 96 ? { right: 0 } : { left: `${x}%`, transform: 'translateX(-50%)' }),
});

/**
 * 帯の中のフェーズ名。**切れていて正しい**（`clip`）—
 * 帯の幅は「何週かかるか」が決めるので、文字に合わせて広げると図が嘘になる。
 */
const Label = ({ c, pad = 11, children }: { c: string; pad?: number; children: React.ReactNode }) => (
  <span className="clip" style={{
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: `0 ${pad}px`,
    color: c, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }}>{children}</span>
);

function Lane({ w, last }: { w: Work; last: boolean }) {
  const late = typeof w.health === 'object';
  const state = late ? `遅れ ${(w.health as { late: number }).late}日` : w.gate ? '判断待ち' : '順調';
  const scol = late ? RED_T : w.gate ? AMBER_T : GREEN_T;
  // 残りは絵と同じ出どころ（計画の週数）。予定の無い Work には書かない
  const rest = w.endDate ? `残り${w.restDays}日` : '';
  const lead = w.crew[0];

  return (
    /* **行ぜんぶが1つの Work。** 帯を押しても名前を押しても同じところへ行く
       （前は名前だけが押せて、帯は押せなかった） */
    <Link href={`/work/${w.id}`} className="row" style={{
      height: ROW, flexShrink: 0, display: 'flex', alignItems: 'center', gap: GAP,
      borderBottom: last ? undefined : `1px solid ${HAIR}`, borderRadius: 7,
      padding: '0 8px', margin: '0 -8px',
    }}>
      <div style={{
        width: LABEL, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
      }}>
        {/* 本物の Work 名はダミーより長い。**切らずに折り返す**（2行まで） */}
        <span style={{
          lineHeight: '19px', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{w.title}</span>
        {/* 状態も残りも**名前の下**へ（前は 1400px 先の右端にあって、目でつながらなかった）。
            フェーズ番号は書かない — 明るい帯がどれかで読める */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          {lead && (
            <>
              <span style={{
                width: 7, height: 7, borderRadius: 999, background: lead.color,
                opacity: lead.dim ? 0.45 : 1, flexShrink: 0,
              }} />
              <span style={{ color: lead.dim ? T5 : T4, fontSize: 11 }}>{lead.name}</span>
              <span style={{ color: DIM, fontSize: 11 }}>·</span>
            </>
          )}
          <span style={{ color: scol, fontSize: 11 }}>{state}</span>
          <span style={{ color: T5, fontSize: 11 }} className="tnum">{w.progress}%</span>
          {rest && <span style={{ color: T5, fontSize: 11 }} className="tnum">{rest}</span>}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', height: BAR }}>
        {w.phases.map((p) => <Seg key={p.name} p={p} />)}
        {w.over && (
          <div style={{
            /* はみ出したぶんの帯。**フェーズの帯ではないので、すき間も広い余白も取らない** */
            position: 'absolute', left: `${w.over.x}%`, width: `${w.over.w}%`, top: 0, height: BAR,
            borderRadius: 6, border: '1px dashed rgba(217,48,37,0.55)', boxSizing: 'border-box',
          }}><Label c={RED_T} pad={8}>{w.over.label}</Label></div>
        )}
        {/* ◆ は**帯の上端に立てる**。中に置くと帯に食い込んで、どちらも読めなくなる
            （計画の承認の画面と同じ、軸の上に立てる読み方） */}
        {w.gate && (
          <div style={{
            position: 'absolute', left: `${w.gate.x}%`, top: -5.5, width: 11, height: 11,
            marginLeft: -5.5, background: AMBER, transform: 'rotate(45deg)',
            borderRadius: 2, boxShadow: '0 0 0 3px #000',
          }} />
        )}
      </div>
    </Link>
  );
}

export function Progress({ works, ticks, todayX, done: doneList, gates, late, review }: {
  works: Work[]; ticks: { x: number; label: string }[]; todayX: number;
  done: { id: string; title: string; ended: string; phases: number }[];
  gates: number; late: number; review: number;
}) {
  // 畳みを開いたかどうかは URL に持つ（ホームの他のビューへ行って戻っても同じ）
  const [done, setDone] = useParam('done', '');
  // ◆ のラベルは答えの1行が言う（帯の下に段を作らない）。1件のときだけ名前を出す
  const gateLabel = gates === 1 ? works.find((w) => w.gate)?.gate?.label : '';

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 16, padding: '10px 24px 108px',
    }}>
      {/* **答えを先に。** 放っておけないことが無いなら、無いと言い切る
          （前は「2つの Workが動いています。」だけで、数を数えただけだった） */}
      <div style={{ width: '100%', maxWidth: MAXW, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, lineHeight: '25px' }}>
          {works.length}つの Work
          {late > 0 ? <>のうち <span style={{ color: RED_T }}>{late}つが遅れています</span>。</> : <>が動いています。</>}
        </span>
        {gates > 0 && (
          <Link href="/decisions" className="lnk" style={{ color: AMBER_T, fontSize: 14 }}>
            判断待ちが {gates}件{gateLabel ? ` — ${gateLabel}` : ''} ›
          </Link>
        )}
        {review > 0 && (
          <Link href="/deliverables" className="lnk" style={{ color: AMBER_T, fontSize: 14 }}>
            成果物 {review}件 を見てください ›
          </Link>
        )}
        {gates === 0 && review === 0 && late === 0 && (
          <span style={{ color: T5, fontSize: 14 }}>あなたを待っているものはありません。</span>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: MAXW, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 日付の軸 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP, height: 30, flexShrink: 0 }}>
          <div style={{ width: LABEL, flexShrink: 0 }} />
          <div style={{ flex: 1, position: 'relative', height: 30 }}>
            {/* **「今日」に近い目盛りは出さない。** 重ねると両方読めなくなる
                （Work が今日から始まると、最初の目盛りと今日が同じ位置に来る） */}
            {ticks.filter((t) => Math.abs(t.x - todayX) > 6).map((t) => (
              <span key={t.x} style={{ ...tick(t.x), color: T5 }}>{t.label}</span>
            ))}
            <span style={{ ...tick(todayX), color: T3 }}>今日</span>
          </div>
        </div>

        {/* レーン。**目盛りの線は行のぶんだけ**（下の空いた黒まで引かない） */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: LABEL + GAP, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
            {ticks.slice(1, -1).map((t) => (
              <div key={t.x} style={{ position: 'absolute', left: `${t.x}%`, top: 0, bottom: 0, width: 1, background: HAIR }} />
            ))}
            <div style={{ position: 'absolute', left: `${todayX}%`, top: 0, bottom: 0, width: 1, background: DIM }} />
          </div>
          {works.map((w, i) => <Lane key={w.id} w={w} last={i === works.length - 1} />)}
        </div>

        {/* 完了した Work は下に溜めない。押したときだけ開く */}
        {doneList.length > 0 && (
        <button onClick={() => setDone(done ? '' : '1')} className="row" style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          height: 42, borderRadius: 7, padding: '0 8px', margin: '0 -8px', textAlign: 'left',
          borderTop: `1px solid ${HAIR}`,
        }}>
          <span style={{ color: T4 }}>完了した Work</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{doneList.length}件</span>
          <div style={{ flex: 1 }} />
          <Icon name={done ? 'up' : 'chev'} color={T5} size={13} />
        </button>
        )}

        {done && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {doneList.map((w) => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 36, padding: '0 8px',
                borderTop: `1px solid ${HAIR}`,
              }}>
                <Icon name="check" color={FAINT} size={13} width={2} />
                <span style={{ color: T5, fontSize: 13 }}>{w.title}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: DIM, fontSize: 11.5 }} className="tnum">フェーズ{w.phases}</span>
                <span style={{ color: DIM, fontSize: 11.5, width: 62, textAlign: 'right' }}>{w.ended}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
