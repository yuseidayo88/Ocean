import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Diamond, Icon } from '@/components/ui/Icon';
import { TASKS, employee, work, type State } from '@/lib/dummy';

/**
 * タスク＝ふつうの1枚の表（参考: Linear）。**Workごとにグループ分けしない**
 * （帯が入るたび読みが止まる）。どの Work かは Work列で示す。
 * 状態はタイトル前のアイコン（状態の列は置かない）。並びは放っておけない順。
 * 「追加」ボタンは置かない。タスクは統括AIとの会話から作られる。
 */

const T1 = '#EDEDED', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

const W = [16, 300, 108, 152, 96, 84];

function Mark({ s }: { s: State }) {
  if (s === '判断待ち') return <Diamond size={9} />;
  if (s === '要確認') return <Icon name="deliv" color={AMBER_T} size={13} />;
  if (s === '実行中') return <span style={{ width: 8, height: 8, borderRadius: 999, background: '#6E6E6E', display: 'inline-block' }} />;
  if (s === '完了') return <Icon name="check" color="#3A3A3A" size={12} width={2} />;
  return <span style={{ width: 8, height: 8, borderRadius: 999, border: '1px solid #333', display: 'inline-block' }} />;
}

export default function TasksPage() {
  const open = TASKS.filter((t) => t.state !== '完了').length;

  return (
    <Centre border={false}>
      <TopBar title="タスク" right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T5, fontSize: 12 }}>
          <Icon name="bars" color={T4} size={13} />絞り込み
        </span>
      } />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '18px 26px 112px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 12 }}>
          <span style={{ color: T3 }}>やること</span>
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{open}件</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 30, borderBottom: '1px solid #232323' }}>
          <span style={{ width: W[0], flexShrink: 0 }} />
          <span style={{ width: W[1], flexShrink: 0, color: T5, fontSize: 11 }}>タイトル</span>
          <span style={{ width: W[2], flexShrink: 0, color: T5, fontSize: 11 }}>進捗</span>
          <span style={{ width: W[3], flexShrink: 0, color: T5, fontSize: 11 }}>Work</span>
          <span style={{ width: W[4], flexShrink: 0, color: T5, fontSize: 11 }}>担当</span>
          <div style={{ flex: 1 }} />
          <span style={{ width: W[5], flexShrink: 0, textAlign: 'right', color: T5, fontSize: 11 }}>期限</span>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {TASKS.map((t) => {
            const done = t.state === '完了';
            const who = t.owner === 'me' ? 'あなた' : employee(t.owner).name;
            return (
              <div key={t.title} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 42, borderBottom: '1px solid #161616',
              }}>
                <span style={{ width: W[0], flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  <Mark s={t.state} />
                </span>
                <span style={{
                  width: W[1], flexShrink: 0, color: done ? T5 : T1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t.title}</span>
                <span style={{ width: W[2], flexShrink: 0 }}>
                  <span style={{ display: 'block', width: 84, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', width: `${t.progress}%`, height: '100%', borderRadius: 2,
                      background: t.state === '判断待ち' || t.state === '要確認' ? AMBER : done ? '#2E2E2E' : '#6E6E6E',
                    }} />
                  </span>
                </span>
                <span style={{ width: W[3], flexShrink: 0, color: T4, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {work(t.workId).title}
                </span>
                <span style={{ width: W[4], flexShrink: 0, color: t.owner === 'me' ? AMBER_T : T4, fontSize: 12 }}>{who}</span>
                <div style={{ flex: 1 }} />
                <span style={{ width: W[5], flexShrink: 0, textAlign: 'right', color: done ? '#3A3A3A' : T5, fontSize: 12 }} className="tnum">
                  {t.due}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Composer placeholder="統括AIに頼む" />
    </Centre>
  );
}
