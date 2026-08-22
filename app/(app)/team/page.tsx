import Link from 'next/link';
import { Centre, Composer, EffortSlider, Pane, Section, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, EMPLOYEES, HIRE_SUGGESTION, RULES, SKILLS, employee } from '@/lib/dummy';

/**
 * メンバー＝表（人数が増えても崩れない）。1行=1社員。
 * 右ペイン＝「AI社員の設定」。**保存ボタンを置かない**（切り替えたその場で効く）。
 * 採用ページへの入口は2つ — 見出しの右の「＋ 採用する」と、提案の右の「ほかの候補を見る ›」。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

const Toggle = ({ on }: { on: boolean }) => (
  <span style={{
    width: 34, height: 20, borderRadius: 999, background: on ? BLUE : '#2A2A2A',
    display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0,
  }}>
    <span style={{
      width: 16, height: 16, borderRadius: 999, background: '#fff',
      marginLeft: on ? 14 : 0, transition: 'margin-left .12s',
    }} />
  </span>
);

export default function TeamPage() {
  const sel = employee('e-research');
  const mine = SKILLS.filter((s) => s.scope === 'employee');
  const shared = SKILLS.filter((s) => s.scope === 'company');

  return (
    <>
      <Centre>
        <TopBar title="メンバー" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 26px 12px' }}>
            <span style={{ color: T3 }}>在籍しているAI社員</span>
            <span style={{ color: T5, fontSize: 12 }} className="tnum">{EMPLOYEES.length}</span>
            <div style={{ flex: 1 }} />
            <Link href="/hire" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 12px',
              borderRadius: 8, background: '#1A1A1A', border: '1px solid #262626', color: T2,
            }}>
              <Icon name="plus" color={T4} size={13} />採用する
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 30, padding: '0 26px', borderBottom: '1px solid #232323' }}>
            {[['AI社員', 210], ['状態', 92], ['いまの担当', 200], ['今週の稼働', 132], ['タスク', 64], ['成果物', 64]].map(([l, w], i) => (
              <span key={l as string} style={{
                width: w as number, flexShrink: 0, color: T5, fontSize: 11,
                textAlign: i >= 4 ? 'right' : 'left',
              }}>{l}</span>
            ))}
          </div>

          {EMPLOYEES.map((e) => {
            const on = e.id === sel.id;
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', height: 54, padding: '0 26px',
                borderBottom: '1px solid #161616', background: on ? '#0C0C0C' : undefined,
                boxShadow: on ? `inset 3px 0 0 ${AGENT_COLOR[e.color]}` : undefined,
              }}>
                <span style={{ width: 210, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Orb color={AGENT_COLOR[e.color]} size={26} seed={e.name.length * 7 + 3} dim={e.state !== '実行中'} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: on ? T1 : T2 }}>{e.name}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{e.role}</span>
                  </span>
                </span>
                <span style={{ width: 92, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: 999,
                    background: e.state === '要確認' ? '#E37400' : '#1E8E3E',
                  }} />
                  <span style={{ color: e.state === '要確認' ? AMBER_T : T3, fontSize: 12 }}>{e.state}</span>
                </span>
                <span style={{ width: 200, flexShrink: 0, color: T2, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.now}
                </span>
                <span style={{ width: 132, flexShrink: 0 }}>
                  <span style={{ display: 'block', width: 108, height: 5, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${e.load}%`, height: '100%', background: '#4A4A4A' }} />
                  </span>
                </span>
                <span style={{ width: 64, flexShrink: 0, textAlign: 'right', color: T2 }} className="tnum">{e.tasks}</span>
                <span style={{ width: 64, flexShrink: 0, textAlign: 'right', color: T2 }} className="tnum">{e.deliverables}</span>
              </div>
            );
          })}

          <div style={{ flex: 1 }} />

          {/* 統括AIからの提案。無ければこの行ごと出さない。「あとで」は置かない */}
          <div style={{ padding: '0 26px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
              <Icon name="plus" color={T4} size={13} />
              <span style={{ color: T3 }}>統括AIからの提案</span>
              <div style={{ flex: 1 }} />
              <Link href="/hire" style={{ color: T4, fontSize: 12 }}>ほかの候補を見る ›</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Orb color={AGENT_COLOR.cyan} size={26} seed={11} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{HIRE_SUGGESTION.name}</span>
                <span style={{ color: T5, fontSize: 11 }}>{HIRE_SUGGESTION.reason}</span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
                borderRadius: 8, background: BLUE, color: '#fff',
              }}>採用する</span>
            </div>
          </div>
        </div>
        <Composer placeholder="この社員に頼む、または統括AIに聞く" />
      </Centre>

      {/* AI社員の設定。道具（capabilities）は社長に触らせない */}
      <Pane width={430} tabs={[{ label: 'AI社員の設定' }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={AGENT_COLOR[sel.color]} size={44} seed={sel.name.length * 7 + 3} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15 }}>{sel.name}</span>
              <span style={{ color: T5, fontSize: 11.5 }}>{sel.role} · {sel.since}から在籍</span>
            </div>
          </div>

          <Section label="スキル" right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
              <Icon name="plus" color={T4} size={12} />追加
            </span>
          }>
            {[...mine, ...shared].map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                borderBottom: i === SKILLS.length - 1 ? undefined : '1px solid #161616',
              }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.file}</span>
                </div>
                <div style={{ flex: 1 }} />
                <Toggle on={s.on} />
              </div>
            ))}
          </Section>

          <Section label="ルール" right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
              <Icon name="plus" color={T4} size={12} />追加
            </span>
          }>
            {RULES.map((r, i) => (
              <div key={r} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 10px 11px',
                borderLeft: '2px solid #262626',
                borderBottom: i === RULES.length - 1 ? undefined : '1px solid #161616',
              }}>
                <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{r}</span>
                <div style={{ flex: 1 }} />
                <Icon name="close" color="#3A3A3A" size={12} />
              </div>
            ))}
          </Section>

          <Section label="モデル" right={
            <span style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 8, background: '#141414', border: '1px solid #232323' }}>
              <span style={{ padding: '3px 10px', borderRadius: 6, background: '#262626', color: T1, fontSize: 12 }}>自動</span>
              <span style={{ padding: '3px 10px', borderRadius: 6, color: T4, fontSize: 12 }}>手動</span>
            </span>
          }>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingTop: 4 }}>
              <span style={{ color: T3, fontSize: 12.5 }}>自動で 標準 を選んでいます</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>Sonnet 5</span>
            </div>
          </Section>

          <Section label="思考の深さ" right={
            <span style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 8, background: '#141414', border: '1px solid #232323' }}>
              <span style={{ padding: '3px 10px', borderRadius: 6, background: '#262626', color: T1, fontSize: 12 }}>自動</span>
              <span style={{ padding: '3px 10px', borderRadius: 6, color: T4, fontSize: 12 }}>手動</span>
            </span>
          }>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 6px' }}>
              <span style={{ color: T5, fontSize: 11 }}>速い</span>
              <span style={{ color: T5, fontSize: 11 }}>深い</span>
            </div>
            <EffortSlider pct={58} dim />
            <span style={{ color: T3, fontSize: 12.5, paddingTop: 8 }}>自動で 中 を選んでいます</span>
          </Section>

          {/* 保存ボタンは置かない。一時停止は保存ではないので最後の行に */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            <span style={{ color: T3 }}>この社員を一時停止する</span>
            <div style={{ flex: 1 }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
              borderRadius: 8, border: '1px solid #2A2A2A', color: T3, fontSize: 12,
            }}>一時停止</span>
          </div>
        </div>
      </Pane>
    </>
  );
}
