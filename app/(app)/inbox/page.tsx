import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { NOTICES } from '@/lib/dummy';

/**
 * 通知＝時系列フィード（参考: Asana / Zendesk）。
 * **まとめて届くものは1件にして中身をぶら下げる。**
 * 未読は左の帯＋青い点だけで示す（面を塗らない）。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

function Mark({ kind }: { kind: string }) {
  if (kind === '判断待ち') return <Diamond size={9} />;
  if (kind === '要確認') return <Icon name="deliv" color={AMBER_T} size={14} />;
  if (kind === '完了') return <Icon name="check" color={GREEN_T} size={13} width={2.2} />;
  if (kind === '採用') return <Icon name="team" color={T4} size={14} />;
  return <Dot color="#6E6E6E" size={8} />;
}

export default function InboxPage() {
  const unread = NOTICES.filter((n) => n.unread).length;
  return (
    <Centre border={false}>
      <TopBar title="通知" right={
        unread > 0 ? <span style={{ color: T5, fontSize: 12 }} className="tnum">未読 {unread}</span> : undefined
      } />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px' }}>
        <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>届いたこと</span>
        {NOTICES.map((n) => (
          <div key={n.id} style={{
            display: 'flex', gap: 13, padding: '13px 0 13px 12px', borderBottom: '1px solid #161616',
            borderLeft: `2px solid ${n.unread ? BLUE : 'transparent'}`,
          }}>
            <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', paddingTop: 2 }}>
              <Mark kind={n.kind} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ color: n.unread ? T1 : T2 }}>{n.title}</span>
                <div style={{ flex: 1 }} />
                {n.unread && <Dot color={BLUE} size={6} />}
                <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>{n.by} · {n.when}</span>
              </div>
              {n.children && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 8 }}>
                  {n.children.map((c) => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Dot color="#2E2E2E" size={5} />
                      <span style={{ color: T5, fontSize: 12 }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Composer placeholder="統括AIに聞く" />
    </Centre>
  );
}
