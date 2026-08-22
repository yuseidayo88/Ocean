import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, DELIVERABLES, TASKS, WORKS, WORK_DECISIONS, employee } from '@/lib/dummy';

/**
 * Work＝会話を持たない。一目で状況が分かる1枚（参考: Upwork / Squarespace / Linear）。
 * 上に事実の帯 → フェーズ全部 → いま動いていること → 成果物。タブに隠さない。
 * 相談は「統括AIに相談する」でチャットへ飛ぶ。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN = '#1E8E3E', GREEN_T = '#5BB974', RED_T = '#F28B82';

/** 数字の下に置く図形。文章で言い直さない */
const Bar = ({ pct }: { pct: number }) => (
  <span style={{ display: 'block', width: 86, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#6E6E6E' }} />
  </span>
);
const Seg = ({ n, on }: { n: number; on: number }) => (
  <span style={{ display: 'flex', gap: 4 }}>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < on ? '#5BB974' : '#1F1F1F' }} />
    ))}
  </span>
);
const Pips = ({ ids }: { ids: string[] }) => (
  <span style={{ display: 'flex', gap: 6, height: 15, alignItems: 'center' }}>
    {ids.map((id) => <Dot key={id} color={AGENT_COLOR[employee(id).color]} size={5} />)}
  </span>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: T5, fontSize: 11, lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);
/** フェーズの状態は行の先頭の印で言う（状態の列は置かない） */
const PhaseMark = ({ state }: { state: 'done' | 'now' | 'next' }) => {
  if (state === 'done') return <Icon name="check" color={GREEN_T} size={13} width={2.2} />;
  if (state === 'now') return <span style={{
    width: 10, height: 10, borderRadius: 999, border: '1.5px solid #8B8B8B',
    background: 'linear-gradient(90deg, #8B8B8B 50%, transparent 50%)',
  }} />;
  return <span style={{ width: 9, height: 9, borderRadius: 999, border: '1px dashed #3A3A3A' }} />;
};

export function generateStaticParams() {
  return WORKS.map((w) => ({ id: w.id }));
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = WORKS.find((x) => x.id === id);
  if (!w) notFound();

  const live = TASKS.filter((t) => t.workId === w.id && t.state !== '完了').slice(0, 4);
  const dels = DELIVERABLES.filter((d) => d.workId === w.id).slice(0, 4);
  const decs = WORK_DECISIONS[w.id] ?? [];
  const late = typeof w.health === 'object';

  return (
    <>
      <Centre>
        <TopBar crumb="Work" title={w.title} right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Dot color={late ? '#D93025' : GREEN} size={7} />
            <span style={{ color: late ? RED_T : GREEN_T, fontSize: 12 }}>
              {late ? `遅れ ${(w.health as { late: number }).late}日` : '進行中'}
            </span>
          </span>
        } />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div>
            <span style={{ fontSize: 20, lineHeight: '30px', display: 'block' }}>{w.title}</span>
            <span style={{ color: T4, fontSize: 13, display: 'block', paddingTop: 6 }}>{w.goal}</span>
          </div>

          {/* 事実の帯 — ラベル（小）→ 数字（大）→ **図形**。数で言えるものは文章にしない */}
          <div style={{ display: 'flex', gap: 24 }}>
            {([
              ['進捗',     `${w.progress}%`,                            undefined,             <Bar key="b" pct={w.progress} />],
              ['フェーズ', `${w.phaseIndex} / ${w.phases.length}`,      undefined,             <Seg key="s" n={w.phases.length} on={w.phaseIndex} />],
              ['判断待ち', w.gate ? '1' : '—', w.gate ? AMBER_T : undefined, w.gate ? <Sub key="g">{w.gate.label}</Sub> : null],
              ['残り',     `${w.restDays}日`, late ? RED_T : undefined,     <Sub key="d">{w.endDate}</Sub>],
              ['AI社員',   String(w.crew.length),                       undefined,             <Pips key="p" ids={w.crew.map((c) => c.id)} />],
            ] as [string, string, string | undefined, React.ReactNode][]).map(([k, v, c, shape], i, arr) => (
              <div key={k} style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5,
                borderRight: i === arr.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                <span style={{ fontSize: 24, lineHeight: '30px', color: c ?? T1 }} className="tnum">{v}</span>
                {shape}
              </div>
            ))}
          </div>

          {/* フェーズ全部。タブに隠さない */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>フェーズ</span>
            {w.phases.map((p, i) => (
              <div key={p.name} className="row" style={{
                display: 'flex', alignItems: 'center', gap: 14, height: 46, borderRadius: 7,
                borderBottom: i === w.phases.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  <PhaseMark state={p.state} />
                </span>
                <span style={{ width: 14, flexShrink: 0, color: T5 }} className="tnum">{i + 1}</span>
                <span style={{ width: 110, flexShrink: 0, color: p.state === 'next' ? T5 : T1 }}>{p.name}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', height: 4, borderRadius: 2, background: '#161616', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 2,
                      width: `${Math.round((p.done / p.all) * 100)}%`,
                      background: p.state === 'done' ? GREEN : p.state === 'now' ? '#6E6E6E' : 'transparent',
                    }} />
                  </span>
                </span>
                <span style={{ width: 42, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">
                  {p.done}/{p.all}
                </span>
                <span style={{ width: 92, flexShrink: 0, textAlign: 'right', color: '#4A4A4A', fontSize: 11 }} className="tnum">
                  {p.from} – {p.to}
                </span>
              </div>
            ))}
          </div>

          {/* いま動いているもの — フェーズをまたいで並べる */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>いま動いているもの</span>
            {live.map((t, i) => (
              <div key={t.title} className="row" style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44, borderRadius: 7,
                borderBottom: i === live.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ width: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  {t.state === '判断待ち' ? <Diamond size={9} />
                    : t.state === '要確認' ? <Icon name="deliv" color={AMBER_T} size={13} />
                    : t.state === '待機' ? <span style={{ width: 8, height: 8, borderRadius: 999, border: '1px solid #333' }} />
                    : <Dot color="#6E6E6E" size={8} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ width: 84, color: T5, fontSize: 12 }}>フェーズ{w.phases.findIndex((p) => p.name === t.phase) + 1}</span>
                <span style={{ width: 78, color: t.owner === 'me' ? AMBER_T : T4, fontSize: 12 }}>
                  {t.owner === 'me' ? 'あなた' : employee(t.owner).name}
                </span>
                <span style={{ width: 52, textAlign: 'right', color: t.state === '判断待ち' ? AMBER_T : T5, fontSize: 12 }} className="tnum">
                  {t.state === '判断待ち' ? '決める' : t.state === '待機' ? '待機' : `${t.progress}%`}
                </span>
              </div>
            ))}
          </div>

          {/* 成果物 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 8 }}>
              <span style={{ color: T3 }}>成果物</span>
              <div style={{ flex: 1 }} />
              <Link href="/deliverables" className="lnk" style={{ color: T5, fontSize: 12 }}>すべて表示 ›</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28 }}>
              {dels.map((d, i) => (
                <div key={d.id} className="row" style={{
                  display: 'flex', alignItems: 'center', gap: 13, height: 56, borderRadius: 7,
                  borderBottom: i >= dels.length - 2 ? undefined : '1px solid #161616',
                }}>
                  {/* サムネイルだけは面と枠を持てる */}
                  <span style={{
                    width: 34, height: 26, flexShrink: 0, borderRadius: 4, background: '#141414',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '0 6px',
                  }}>
                    {[10, 16, 13].map((wd, k) => (
                      <span key={k} style={{ height: 2, width: wd, borderRadius: 1, background: '#2E2E2E' }} />
                    ))}
                  </span>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{employee(d.by).name}{d.when && ` · ${d.when}`}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {d.state === '要確認' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                      background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12, whiteSpace: 'nowrap',
                    }}>要確認</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Composer placeholder="この Work について統括AIに相談する" />
      </Centre>

      <Pane width={400} icon="work" title="この Work について">
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px' }}>
          <PaneHead top>最新の状況</PaneHead>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0 8px' }}>
            <Dot color={late ? '#D93025' : GREEN} size={7} />
            <span style={{ color: late ? RED_T : GREEN_T }}>
              {late ? `遅れ ${(w.health as { late: number }).late}日` : '順調'}
            </span>
            <span style={{ color: T5, fontSize: 11 }}>統括AI · 2時間前</span>
          </div>
          <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>
            {w.gate
              ? `${w.phases.find((p) => p.state === 'now')!.name}フェーズは後半です。${w.gate.label}だけ、判断を待っています。`
              : `${w.phases.find((p) => p.state === 'now')!.name}フェーズを進めています。`}
          </span>

          <PaneHead>決めたこと</PaneHead>
          {decs.length === 0 && (
            <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px' }}>
              まだありません。判断が要る場面になったら、統括AIが選択肢を出します。
            </span>
          )}
          {decs.map(([when, what], i) => (
            <div key={what} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 40,
              borderBottom: i === decs.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ width: 52, flexShrink: 0, color: T5, fontSize: 11 }}>{when}</span>
              <Icon name="check" color={GREEN_T} size={12} width={2.2} />
              <span style={{ color: T2, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{what}</span>
            </div>
          ))}

          <PaneHead>AI社員</PaneHead>
          {w.crew.map((c, i) => {
            const e = employee(c.id);
            const n = TASKS.filter((t) => t.workId === w.id && t.owner === c.id && t.state !== '完了').length;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 11, height: 44,
                borderBottom: i === w.crew.length - 1 ? undefined : '1px solid #161616',
              }}>
                <Orb color={AGENT_COLOR[e.color]} size={24} seed={e.name.length * 7 + 3} dim={Boolean(c.dim)} />
                <span style={{ color: c.dim ? T4 : T2 }}>{e.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: c.dim ? T5 : T4, fontSize: 12 }} className="tnum">
                  {c.dim ? '待機' : `${n}タスク`}
                </span>
              </div>
            );
          })}
        </div>
      </Pane>
    </>
  );
}
