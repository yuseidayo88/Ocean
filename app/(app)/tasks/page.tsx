import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon, type IconName } from '@/components/ui/Icon';
import { TASKS, TASK_BODY, employee, work, type State } from '@/lib/dummy';

/**
 * タスク＝ふつうの1枚の表（参考: Linear）。**Workごとにグループ分けしない**
 * （帯が入るたび読みが止まる）。どの Work かは Work列で示す。
 * 状態はタイトル前のアイコン（状態の列は置かない）。並びは放っておけない順。
 * 「追加」ボタンは置かない。タスクは統括AIとの会話から作られる。
 */

const T1 = '#EDEDED', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

/** 見出しの幅。タイトルだけ伸び縮みさせる（右ペインが開いても列が落ちない） */
const W = { mark: 16, prog: 92, work: 136, who: 80, due: 72 };

function Mark({ s }: { s: State }) {
  if (s === '判断待ち') return <Diamond size={9} />;
  if (s === '要確認') return <Icon name="deliv" color={AMBER_T} size={13} />;
  if (s === '実行中') return <span style={{ width: 8, height: 8, borderRadius: 999, background: '#6E6E6E', display: 'inline-block' }} />;
  if (s === '完了') return <Icon name="check" color="#3A3A3A" size={12} width={2} />;
  return <span style={{ width: 8, height: 8, borderRadius: 999, border: '1px solid #333', display: 'inline-block' }} />;
}

export default function TasksPage() {
  const open = TASKS.filter((t) => t.state !== '完了').length;
  const gates = TASKS.filter((t) => t.state === '判断待ち').length;

  return (
    <>
    <Centre>
      <TopBar title="タスク" right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: AMBER_T, fontSize: 12 }}>
          <Dot color={AMBER} size={7} />判断待ち <span className="tnum">{gates}</span>
        </span>
      } />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '18px 26px 112px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 12 }}>
          <span style={{ color: T3 }}>やること</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{open}件</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T5, fontSize: 12 }}>
            <Icon name="bars" color={T4} size={13} />絞り込み
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 30, borderBottom: '1px solid #232323' }}>
          <span style={{ width: W.mark, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, color: T5, fontSize: 11 }}>タイトル</span>
          <span style={{ width: W.prog, flexShrink: 0, color: T5, fontSize: 11 }}>進捗</span>
          <span style={{ width: W.work, flexShrink: 0, color: T5, fontSize: 11 }}>Work</span>
          <span style={{ width: W.who,  flexShrink: 0, color: T5, fontSize: 11 }}>担当</span>
          <span style={{ width: W.due,  flexShrink: 0, textAlign: 'right', color: T5, fontSize: 11 }}>期限</span>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {TASKS.map((t) => {
            const done = t.state === '完了';
            const who = t.owner === 'me' ? 'あなた' : employee(t.owner).name;
            return (
              <div key={t.title} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 42, borderBottom: '1px solid #161616',
                background: t.title === TASK_BODY.title ? '#0C0C0C' : undefined,
              }}>
                <span style={{ width: W.mark, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  <Mark s={t.state} />
                </span>
                <span style={{
                  flex: 1, minWidth: 0, color: done ? T5 : T1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t.title}</span>
                <span style={{ width: W.prog, flexShrink: 0 }}>
                  <span style={{ display: 'block', width: 74, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', width: `${t.progress}%`, height: '100%', borderRadius: 2,
                      background: t.state === '判断待ち' || t.state === '要確認' ? AMBER : done ? '#2E2E2E' : '#6E6E6E',
                    }} />
                  </span>
                </span>
                <span style={{ width: W.work, flexShrink: 0, color: T4, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {work(t.workId).title}
                </span>
                <span style={{ width: W.who, flexShrink: 0, color: t.owner === 'me' ? AMBER_T : T4, fontSize: 12 }}>{who}</span>
                <span style={{ width: W.due, flexShrink: 0, textAlign: 'right', color: done ? '#3A3A3A' : T5, fontSize: 12 }} className="tnum">
                  {t.due}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Composer placeholder="統括AIに頼む" />
    </Centre>

    <TaskPane />
    </>
  );
}

/** 表の1行を開いた先。判断待ちなので、最後は「判断する」に着地する */
function TaskPane() {
  const b = TASK_BODY;
  return (
    <Pane width={420} tabs={[{ label: b.title, dot: AMBER }, { label: '履歴' }, { label: '資料' }]}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px' }}>
        <PaneHead top>フィールド</PaneHead>
        {b.fields.map((f) => (
          <Row key={f.label} icon={f.icon} label={f.label}>
            {'pill' in f && f.pill && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12,
              }}>{f.pill}</span>
            )}
            {'bar' in f && f.bar !== undefined && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'block', width: 74, height: 4, borderRadius: 2, background: '#1A1A1A' }}>
                  <span style={{ display: 'block', width: `${f.bar}%`, height: '100%', borderRadius: 2, background: AMBER }} />
                </span>
                <span style={{ color: T1, fontSize: 12.5 }} className="tnum">{f.bar}%</span>
              </span>
            )}
            {'value' in f && f.value && <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>}
          </Row>
        ))}

        <PaneHead>システム</PaneHead>
        {b.system.map((f) => (
          <Row key={f.label} icon={f.icon} label={f.label}>
            <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>
          </Row>
        ))}

        <PaneHead>内容</PaneHead>
        <span style={{ display: 'block', color: T3, fontSize: 12.5, lineHeight: '21px', padding: '4px 0 16px' }}>
          {b.lead}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24 }}>
          <span style={{ width: 28, color: T5, fontSize: 11 }}>{b.cols[0]}</span>
          <span style={{ flex: 1, color: T5, fontSize: 11 }}>{b.cols[1]}</span>
          <span style={{ color: T5, fontSize: 11 }}>{b.cols[2]}</span>
        </div>
        {b.rows.map((r) => (
          <div key={r.k} style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 35, padding: '0 9px', margin: '0 -9px',
            borderRadius: 7, borderTop: '1px solid #161616',
            background: r.on ? 'rgba(30,142,62,0.10)' : undefined,
          }}>
            <span style={{ width: 28, color: r.on ? T1 : T4, fontSize: 12.5 }}>{r.k}</span>
            <span style={{ flex: 1, color: r.on ? T1 : T4, fontSize: 12.5 }} className="tnum">{r.v}</span>
            <span style={{ color: r.on ? GREEN_T : T5, fontSize: 12.5 }} className="tnum">{r.pct}</span>
          </div>
        ))}
      </div>
      <PaneFooter primary="判断する" secondary="表示" />
    </Pane>
  );
}

/** ペインのフィールド1行。アイコンは裸で置く */
function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34 }}>
      <Icon name={icon} color="#3A3A3A" size={13} />
      <span style={{ width: 62, color: T5, fontSize: 12.5 }}>{label}</span>
      {children}
    </div>
  );
}
