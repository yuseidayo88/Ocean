import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { DELIVERABLES, employee, work } from '@/lib/dummy';

/**
 * 成果物＝グリッド（参考: Craft / Frame）。
 * **プレビューは中身を出す。** 灰色の棒ではなく、実際の書き出し2〜3行を小さく出す。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER_T = '#FDD663', GREEN_T = '#5BB974';

export default function DeliverablesPage() {
  const need = DELIVERABLES.filter((d) => d.state === '要確認');
  const top = DELIVERABLES[0];

  return (
    <>
      <Centre>
        <TopBar title="成果物" right={
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{DELIVERABLES.length}件</span>
        } />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 14 }}>
            <span style={{ color: T3 }}>できたもの</span>
            {need.length > 0 && <span style={{ color: AMBER_T, fontSize: 12 }} className="tnum">要確認 {need.length}件</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            {DELIVERABLES.map((d) => (
              <div key={d.id} style={{
                display: 'flex', flexDirection: 'column', borderRadius: 12,
                background: '#0B0B0B', border: `1px solid ${d.state === '要確認' ? 'rgba(227,116,0,0.30)' : '#1C1C1C'}`,
                overflow: 'hidden',
              }}>
                {/* サムネイルに実際の書き出しを出す */}
                <div style={{ padding: '14px 15px 12px', display: 'flex', flexDirection: 'column', gap: 5, height: 92, overflow: 'hidden' }}>
                  {d.preview.map((l, i) => (
                    <span key={i} style={{ color: i === 0 ? T2 : T5, fontSize: 11.5, lineHeight: '17px' }}>{l}</span>
                  ))}
                </div>
                <div style={{ height: 1, background: '#1A1A1A' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px' }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{employee(d.by).name} · {d.when} · {work(d.workId).title}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {d.state === '要確認'
                    ? <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                        background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12, whiteSpace: 'nowrap',
                      }}>要確認</span>
                    : <span style={{ color: GREEN_T, fontSize: 12, whiteSpace: 'nowrap' }}>承認済</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Composer placeholder="成果物について統括AIに聞く" />
      </Centre>

      <Pane width={430} tabs={[{ label: '競合分析レポート v1.0', dot: '#E37400' }, { label: '決定事項' }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {top.preview.map((l, i) => (
              <span key={i} style={{ color: i === 0 ? T1 : T2, fontSize: 13.5, lineHeight: '22px' }}>{l}</span>
            ))}
          </div>
          <div style={{ height: 1, background: '#161616', margin: '20px 0 16px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['作った社員', employee(top.by).name], ['Work', work(top.workId).title], ['できたとき', top.when], ['出典', '3件']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: T2, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 22 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px',
              borderRadius: 8, background: '#1A73E8', color: '#fff',
            }}>承認する</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px',
              borderRadius: 8, color: T3,
            }}>直してもらう</span>
          </div>
        </div>
      </Pane>
    </>
  );
}
