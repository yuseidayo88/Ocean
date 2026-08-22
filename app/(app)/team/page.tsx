'use client';

import { useOpen } from '@/lib/use-open';
import Link from 'next/link';
import { Centre, Composer, Pane, Section, TopBar } from '@/components/shell/Chrome';
import { EffortPick, ModelPick, Toggle } from '@/components/shell/Controls';
import { COMPOSER_H } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, EMPLOYEES, HIRE_SUGGESTION, RULES, SKILLS, employee } from '@/lib/dummy';
import { openHref } from '@/lib/use-open';
import { pressable } from '@/lib/a11y';

/**
 * メンバー＝表（人数が増えても崩れない）。1行=1社員。
 * 右ペイン＝「AI社員の設定」。**保存ボタンを置かない**（切り替えたその場で効く）。
 * 採用ページへの入口は2つ — 見出しの右の「＋ 採用する」と、提案の右の「ほかの候補を見る ›」。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

/** 列の幅。**いまの担当だけ伸び縮みさせる**（右ペインが開いても列が落ちない） */
const COLS: [string, number][] = [
  ['AI社員', 190], ['状態', 84], ['いまの担当', 0], ['今週の稼働', 110], ['タスク', 56], ['成果物', 56],
];


export default function TeamPage() {
  // 右は閉じた状態から始まる。社員の行を押すと、その社員の設定が開く
  const [openId, setOpenId] = useOpen();
  const sel = EMPLOYEES.find((e) => e.id === openId) ?? null;
  const mine = SKILLS.filter((s) => s.scope === 'employee');
  const shared = SKILLS.filter((s) => s.scope === 'company');

  return (
    <>
      <Centre>
        <TopBar title="メンバー" onPanel={() => setOpenId(openId ? null : EMPLOYEES[0].id)} panelOn={!!openId} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 26px 12px' }}>
            <span style={{ color: T3 }}>在籍しているAI社員</span>
            <span style={{ color: T5, fontSize: 12 }} className="tnum">{EMPLOYEES.length}</span>
            <div style={{ flex: 1 }} />
            <span className="btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 8px',
              borderRadius: 7, color: T5, fontSize: 12,
            }}><Icon name="bars" color={T4} size={13} />絞り込み</span>
            <Link href="/hire" className="btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 12px',
              borderRadius: 8, background: '#1A1A1A', border: '1px solid #262626', color: T2,
            }}>
              <Icon name="plus" color={T4} size={13} />採用する
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: 30, padding: '0 26px', borderBottom: '1px solid #232323' }}>
            {COLS.map(([l, w], i) => (
              <span key={l as string} style={{
                width: (w as number) || undefined, flex: w ? undefined : 1, minWidth: 0,
                flexShrink: 0, color: T5, fontSize: 11, textAlign: i >= 4 ? 'right' : 'left',
              }}>{l}</span>
            ))}
          </div>

          {EMPLOYEES.map((e) => {
            const on = e.id === openId;
            return (
              <div key={e.id} className={on ? 'hit' : 'row'} {...pressable(() => setOpenId(e.id))} style={{
                display: 'flex', alignItems: 'center', height: 54, padding: '0 26px',
                borderBottom: '1px solid #161616', background: on ? '#0C0C0C' : undefined,
                boxShadow: on ? `inset 3px 0 0 ${AGENT_COLOR[e.color]}` : undefined,
              }}>
                <span style={{ width: COLS[0][1], flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Orb color={AGENT_COLOR[e.color]} size={26} seed={e.name.length * 7 + 3} dim={e.state !== '実行中'} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: on ? T1 : T2 }}>{e.name}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{e.role}</span>
                  </span>
                </span>
                <span style={{ width: COLS[1][1], flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: 999,
                    background: e.state === '要確認' ? '#E37400' : '#1E8E3E',
                  }} />
                  <span style={{ color: e.state === '要確認' ? AMBER_T : T3, fontSize: 12 }}>{e.state}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0, color: T2, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.now}
                </span>
                <span style={{ width: COLS[3][1], flexShrink: 0 }}>
                  <span style={{ display: 'block', width: 90, height: 5, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${e.load}%`, height: '100%', background: '#4A4A4A' }} />
                  </span>
                </span>
                <span style={{ width: COLS[4][1], flexShrink: 0, textAlign: 'right', color: T2 }} className="tnum">{e.tasks}</span>
                <span style={{ width: COLS[5][1], flexShrink: 0, textAlign: 'right', color: T2 }} className="tnum">{e.deliverables}</span>
              </div>
            );
          })}

          <div style={{ flex: 1 }} />

          {/* 統括AIからの提案。無ければこの行ごと出さない。「あとで」は置かない */}
          <div style={{ padding: `0 26px ${COMPOSER_H + 14}px` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8 }}>
              <Icon name="plus" color={T4} size={13} />
              <span style={{ color: T3 }}>統括AIからの提案</span>
              <div style={{ flex: 1 }} />
              <Link href="/hire" className="lnk" style={{ color: T4, fontSize: 12 }}>ほかの候補を見る ›</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Orb color={AGENT_COLOR.cyan} size={26} seed={11} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{HIRE_SUGGESTION.name}</span>
                <span style={{ color: T5, fontSize: 11 }}>{HIRE_SUGGESTION.reason}</span>
              </div>
              <div style={{ flex: 1 }} />
              <span className="solid" style={{
                display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
                borderRadius: 8, background: BLUE, color: '#fff',
              }}>採用する</span>
            </div>
          </div>
        </div>
        <Composer placeholder="この社員に頼む、または統括AIに聞く" />
      </Centre>

      {/* AI社員の設定。道具（capabilities）は社長に触らせない */}
      {sel && (
      <Pane width={430} icon="gear" title="AI社員の設定" onClose={() => setOpenId(null)}>
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
              <Link key={s.id} href={openHref('/skills', s.file)} className="row" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                borderBottom: i === SKILLS.length - 1 ? undefined : '1px solid #161616',
              }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.file}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><Toggle on={s.on} /></span>
              </Link>
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

          <ModelPick />

          <EffortPick />

          {/* 保存ボタンは置かない。一時停止は保存ではないので最後の行に */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            <span style={{ color: T3 }}>この社員を一時停止する</span>
            <div style={{ flex: 1 }} />
            <span className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
              borderRadius: 8, border: '1px solid #2A2A2A', color: T3, fontSize: 12,
            }}>一時停止</span>
          </div>
        </div>
      </Pane>
      )}
    </>
  );
}
