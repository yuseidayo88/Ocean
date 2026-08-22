'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useOpen } from '@/lib/use-open';import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon, type IconName } from '@/components/ui/Icon';
import { TASKS, TASK_BODY, employee, work, type State, type Task } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';

/**
 * タスク＝ふつうの1枚の表（参考: Linear）。**Workごとにグループ分けしない**
 * （帯が入るたび読みが止まる）。どの Work かは Work列で示す。
 * 状態はタイトル前のアイコン（状態の列は置かない）。並びは放っておけない順。
 * 「追加」ボタンは置かない。タスクは統括AIとの会話から作られる。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
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
  const todo = TASKS.filter((t) => t.state !== '完了').length;
  const gates = TASKS.filter((t) => t.state === '判断待ち').length;
  // **右は閉じた状態から始まる。** 行を押すと、その行のぶんだけ開く
  const [openId, setOpen] = useOpen();
  const open = TASKS.find((t) => t.id === openId) ?? null;

  return (
    <>
    <Centre>
      <TopBar title="タスク"
        onPanel={() => setOpen(open ? null : TASKS[0].id)} panelOn={!!open}
        right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: AMBER_T, fontSize: 12 }}>
          <Dot color={AMBER} size={7} />判断待ち <span className="tnum">{gates}</span>
        </span>
      } />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '18px 26px 112px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 12 }}>
          <span style={{ color: T3 }}>やること</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{todo}件</span>
          <div style={{ flex: 1 }} />
          <span className="btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 8px',
            borderRadius: 7, color: T5, fontSize: 12,
          }}>
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
              <div key={t.title} className="row" {...pressable(() => setOpen(t.id))} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 42, borderBottom: '1px solid #161616',
                background: t.id === openId ? '#0C0C0C' : undefined,
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
                {/* 行は開く、中のリンクは別の画面へ。食い合わないように止める */}
                <Link href={`/work/${t.workId}`} onClick={(e) => e.stopPropagation()} className="lnk"
                  style={{ width: W.work, flexShrink: 0, color: T4, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {work(t.workId).title}
                </Link>
                {t.owner === 'me'
                  ? <span style={{ width: W.who, flexShrink: 0, color: AMBER_T, fontSize: 12 }}>{who}</span>
                  : <Link href={openHref('/team', t.owner)} onClick={(e) => e.stopPropagation()} className="lnk"
                      style={{ width: W.who, flexShrink: 0, color: T4, fontSize: 12 }}>{who}</Link>}
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

    {open && <TaskPane t={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * 表の1行を開いた先。**押した行のものを出す。**
 * フィールドとシステムはどの行にもあるが、案の比較は判断待ちの行にしかない。
 */
function TaskPane({ t, onClose }: { t: Task; onClose: () => void }) {
  const b = TASK_BODY;
  const gate = t.state === '判断待ち';
  const who = t.owner === 'me' ? 'あなた' : employee(t.owner).name;
  const barColor = gate || t.state === '要確認' ? AMBER : t.state === '完了' ? '#1E8E3E' : '#6E6E6E';
  const fields = [
    { icon: 'task' as const, label: '期限', value: t.due },
    { icon: 'check' as const, label: '状態', pill: t.state },
    { icon: 'bars' as const, label: '進捗', bar: t.progress },
    { icon: 'team' as const, label: '担当', value: who },
    { icon: 'work' as const, label: 'Work', value: work(t.workId).title },
  ];
  // 値のない行は出さない（「—」で埋めない）
  const system = [
    ...(gate ? [{ icon: 'plus' as const, label: '作成', value: b.created }] : []),
    { icon: 'roadmap' as const, label: 'フェーズ', value: t.phase },
  ];
  return (
    <Pane width={420} onClose={onClose}
      dot={gate || t.state === '要確認' ? AMBER : t.state === '完了' ? '#1E8E3E' : '#5F5F5F'}
      title={t.title}
      right={gate ? <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>{b.created}に作成</span> : undefined}>
      {/* 1つのタスクの中の行き先。**開いた文書ではない**ので、タブではなく選ぶ列 */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 4, padding: '10px 16px 0' }}>
        {(['概要', '履歴', '資料'] as const).map((t, i) => (
          <span key={t} className={i === 0 ? 'hit' : 'btn'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 11px',
            borderRadius: 8, background: i === 0 ? '#1A1A1A' : undefined, color: i === 0 ? T1 : T4, fontSize: 12.5,
          }}>
            <Icon name={i === 0 ? 'home' : i === 1 ? 'history' : 'deliv'} color={i === 0 ? T2 : '#3A3A3A'} size={12} />{t}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px' }}>
        <PaneHead top>フィールド</PaneHead>
        {fields.map((f) => (
          <Row key={f.label} icon={f.icon} label={f.label}>
            {'pill' in f && f.pill && (
              gate || f.pill === '要確認' ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                  background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12,
                }}>{f.pill}</span>
              ) : <span style={{ color: T1, fontSize: 12.5 }}>{f.pill}</span>
            )}
            {'bar' in f && f.bar !== undefined && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'block', width: 74, height: 4, borderRadius: 2, background: '#1A1A1A' }}>
                  <span style={{ display: 'block', width: `${f.bar}%`, height: '100%', borderRadius: 2, background: barColor }} />
                </span>
                <span style={{ color: T1, fontSize: 12.5 }} className="tnum">{f.bar}%</span>
              </span>
            )}
            {'value' in f && f.value && <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>}
          </Row>
        ))}

        <PaneHead>システム</PaneHead>
        {system.map((f) => (
          <Row key={f.label} icon={f.icon} label={f.label}>
            <span style={{ color: T1, fontSize: 12.5 }}>{f.value}</span>
          </Row>
        ))}

        {gate && <>
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
          <div key={r.k} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 35, padding: '0 9px', margin: '0 -9px',
            borderRadius: 7, borderTop: '1px solid #161616',
            background: r.on ? 'rgba(30,142,62,0.10)' : undefined,
          }}>
            <span style={{ width: 28, color: r.on ? T1 : T4, fontSize: 12.5 }}>{r.k}</span>
            <span style={{ flex: 1, color: r.on ? T1 : T4, fontSize: 12.5 }} className="tnum">{r.v}</span>
            <span style={{ color: r.on ? GREEN_T : T5, fontSize: 12.5 }} className="tnum">{r.pct}</span>
          </div>
        ))}
        </>}
      </div>
      <PaneFooter primary={gate ? '判断する' : '開く'} secondary="表示" />
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
