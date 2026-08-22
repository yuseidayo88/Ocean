import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, DECISIONS, DELIVERABLES, TASKS, WORKS, employee } from '@/lib/dummy';

/**
 * Work＝会話を持たない。一目で状況が分かる1枚（参考: Upwork / Squarespace / Linear）。
 * 上に事実の帯 → フェーズ全部 → いま動いていること → 成果物。タブに隠さない。
 * 相談は「統括AIに相談する」でチャットへ飛ぶ。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974', RED_T = '#F28B82';

export function generateStaticParams() {
  return WORKS.map((w) => ({ id: w.id }));
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = WORKS.find((x) => x.id === id);
  if (!w) notFound();

  const tasks = TASKS.filter((t) => t.workId === w.id);
  const live = tasks.filter((t) => t.state === '実行中' || t.state === '判断待ち' || t.state === '要確認');
  const dels = DELIVERABLES.filter((d) => d.workId === w.id);
  const decs = DECISIONS.filter((d) => d.workId === w.id && d.state === '承認済');
  const late = typeof w.health === 'object';

  const facts: [string, string, string?][] = [
    ['進捗', `${w.progress}%`],
    ['いまのフェーズ', w.phases.find((p) => p.state === 'now')!.name],
    ['判断待ち', w.gate ? '1' : '—', w.gate ? AMBER_T : undefined],
    ['残り', `${w.restDays}日`, late ? RED_T : undefined],
    ['AI社員', `${w.crew.length}`],
  ];

  return (
    <>
      <Centre>
        <TopBar crumb="Work" title={w.title} right={
          <Link href={`/chat/t-price`} style={{ color: T4, fontSize: 12 }}>統括AIに相談する ›</Link>
        } />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px', display: 'flex', flexDirection: 'column', gap: 30 }}>
          {/* 事実の帯 — ラベル（小）→ 数字（大）。説明文は置かない */}
          <div style={{ display: 'flex', gap: 26 }}>
            {facts.map(([k, v, c], i) => (
              <div key={k} style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                borderRight: i === facts.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                <span style={{ fontSize: 24, lineHeight: '30px', color: c ?? T1 }} className="tnum">{v}</span>
              </div>
            ))}
          </div>

          {/* フェーズ全部。タブに隠さない */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>フェーズ</span>
            {w.phases.map((p, i) => (
              <div key={p.name} style={{
                display: 'flex', alignItems: 'center', gap: 14, height: 46,
                borderBottom: i === w.phases.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ width: 14, flexShrink: 0, color: T5 }} className="tnum">{i + 1}</span>
                <span style={{ width: 96, flexShrink: 0, color: p.state === 'next' ? T5 : T1 }}>{p.name}</span>
                <span style={{ flex: 1, minWidth: 0, color: p.state === 'next' ? T5 : T3, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.goal}
                </span>
                <span style={{ width: 110, flexShrink: 0 }}>
                  <span style={{ display: 'block', height: 4, borderRadius: 2, background: '#161616', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 2,
                      width: p.state === 'done' ? '100%' : p.state === 'now' ? `${w.progress}%` : '0%',
                      background: p.state === 'done' ? '#2E2E2E' : '#6E6E6E',
                    }} />
                  </span>
                </span>
                <span style={{ width: 62, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">
                  {p.tasks}タスク
                </span>
              </div>
            ))}
          </div>

          {/* いま動いていること — フェーズをまたいで並べる */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>いま動いていること</span>
            {live.map((t, i) => (
              <div key={t.title} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 42,
                borderBottom: i === live.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ width: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  {t.state === '判断待ち' ? <Diamond size={9} />
                    : t.state === '要確認' ? <Icon name="deliv" color={AMBER_T} size={13} />
                    : <Dot color="#6E6E6E" size={8} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ color: t.owner === 'me' ? AMBER_T : T4, fontSize: 12 }}>
                  {t.owner === 'me' ? 'あなた' : employee(t.owner).name}
                </span>
                <span style={{ width: 62, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">{t.due}</span>
              </div>
            ))}
          </div>

          {/* 成果物 */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>成果物</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
              {dels.slice(0, 4).map((d) => (
                <div key={d.id} style={{ borderRadius: 10, background: '#0B0B0B', border: '1px solid #1C1C1C', padding: '11px 13px' }}>
                  <span style={{ display: 'block', color: T5, fontSize: 11, lineHeight: '17px', height: 34, overflow: 'hidden' }}>
                    {d.preview[0]}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 8 }}>
                    <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ color: d.state === '要確認' ? AMBER_T : T5, fontSize: 11, whiteSpace: 'nowrap' }}>{d.state}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Composer placeholder={`${w.title} について統括AIに指示する`} />
      </Centre>

      <Pane width={400} tabs={[{ label: '最新の状況' }, { label: '決めたこと' }, { label: 'AI社員' }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
              <Dot color={late ? '#D93025' : '#1E8E3E'} size={7} />
              <span style={{ color: late ? RED_T : GREEN_T }}>{late ? `遅れ ${(w.health as { late: number }).late}日` : '順調'}</span>
              <span style={{ color: T5, fontSize: 11 }}>統括AI · 2時間前</span>
            </div>
            <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>
              {w.gate ? `${w.phases.find((p) => p.state === 'now')!.name}フェーズは後半です。${w.gate.label}だけ、判断を待っています。`
                      : `${w.phases.find((p) => p.state === 'now')!.name}フェーズを進めています。`}
            </span>
          </div>

          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>決めたこと</span>
            {decs.length === 0 && (
              <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px' }}>
                まだありません。判断が要る場面になったら、統括AIが選択肢を出します。
              </span>
            )}
            {decs.map((d, i) => (
              <div key={d.id} style={{ padding: '10px 0', borderBottom: i === decs.length - 1 ? undefined : '1px solid #161616' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="check" color={GREEN_T} size={12} width={2.2} />
                  <span style={{ fontSize: 12.5 }}>{d.chosen}</span>
                </div>
                <span style={{ display: 'block', color: T5, fontSize: 11, paddingLeft: 20, paddingTop: 3 }}>{d.question} · {d.when}</span>
              </div>
            ))}
          </div>

          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>AI社員</span>
            {w.crew.map((c, i) => {
              const e = employee(c.id);
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0',
                  borderBottom: i === w.crew.length - 1 ? undefined : '1px solid #161616',
                }}>
                  <Orb color={AGENT_COLOR[e.color]} size={24} seed={e.name.length * 7 + 3} dim={Boolean(c.dim)} />
                  <span style={{ color: c.dim ? T4 : T2 }}>{e.name}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ color: e.state === '要確認' ? AMBER_T : T5, fontSize: 12 }}>{e.state}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Pane>
    </>
  );
}
