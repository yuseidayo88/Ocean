import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Diamond, Icon } from '@/components/ui/Icon';
import { DECISIONS, work } from '@/lib/dummy';

/**
 * 決定事項＝台帳タイムライン。**追記のみ**（決め直しは新しい行＋supersedes）。
 * 質問はここに出さない。事業判断だけが昇格する。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

export default function DecisionsPage() {
  const open = DECISIONS.find((d) => d.state === '判断待ち')!;

  return (
    <>
      <Centre>
        <TopBar title="決定事項" right={
          <span style={{ color: T5, fontSize: 12 }} className="tnum">{DECISIONS.length}件</span>
        } />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px' }}>
          <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>決めたこと</span>
          {DECISIONS.map((d, i) => {
            const wait = d.state === '判断待ち';
            return (
              <div key={d.id} style={{ display: 'flex', gap: 14, paddingTop: 16 }}>
                <div style={{ width: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {wait ? <Diamond size={9} />
                        : <span style={{ width: 8, height: 8, borderRadius: 999, background: '#2E2E2E', marginTop: 5 }} />}
                  {i < DECISIONS.length - 1 && <div style={{ flex: 1, width: 1, background: '#1A1A1A' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 16, borderBottom: i === DECISIONS.length - 1 ? undefined : '1px solid #161616' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ color: wait ? AMBER_T : T1 }}>{d.question}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ color: T5, fontSize: 11 }}>{work(d.workId).title} · {d.when}</span>
                  </div>
                  {d.chosen && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 7 }}>
                      <Icon name="check" color={GREEN_T} size={12} width={2.2} />
                      <span style={{ color: T2, fontSize: 13 }}>{d.chosen}</span>
                    </div>
                  )}
                  <span style={{ display: 'block', color: T5, fontSize: 12, lineHeight: '19px', paddingTop: 6 }}>{d.rationale}</span>
                </div>
              </div>
            );
          })}
        </div>
        <Composer placeholder="決めたことについて統括AIに聞く" />
      </Centre>

      {/* 選択肢は「見出し＋1行の説明＋番号キー」。推奨に緑の印をつけ、いちばん上に置く */}
      <Pane width={430} tabs={[{ label: '価格モデルの決定', dot: AMBER }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0' }}>
          <span style={{ color: T2, fontSize: 13.5, lineHeight: '22px' }}>{open.rationale}</span>
          <div style={{ height: 1, background: '#161616', margin: '16px 0 4px' }} />
          {open.options!.map((o, i) => (
            <div key={o.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 0',
              borderBottom: i === open.options!.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 5, background: '#1C1C1C', color: T4, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>{o.key}</span>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {o.label}
                  {o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>おすすめ</span>}
                </span>
                <span style={{ color: T5, fontSize: 12, lineHeight: '18px' }}>{o.note}</span>
              </div>
            </div>
          ))}
          <div style={{ paddingTop: 18 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px',
              borderRadius: 8, background: '#1A73E8', color: '#fff',
            }}>これで決める</span>
          </div>
        </div>
      </Pane>
    </>
  );
}
