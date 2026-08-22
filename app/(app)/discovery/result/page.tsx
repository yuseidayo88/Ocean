import { Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';

/**
 * ⓪-b 候補をくらべる。**採用しなかった候補も残す**
 * （なぜその道を選んだかは、選ばなかった道と並べて意味になる）。
 * 「この案ではじめる」を2か所に置かない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', GREEN_T = '#5BB974';

const CANDS = [
  { title: '韓国人向け 日本語学習サービス', lead: 'あなたの日本語教育と韓国語の経験が、そのまま差になります。在庫も要りません。',
    scores: [['市場', 86], ['得意との一致', 92], ['資金', 78]] as [string, number][], rec: true },
  { title: '日本語教師向けの教材テンプレ販売', lead: '作り置きが効きますが、買う人の数が読めません。',
    scores: [['市場', 54], ['得意との一致', 80], ['資金', 90]] as [string, number][], rec: false },
  { title: '韓国語↔日本語の翻訳代行', lead: 'すぐ売上になりますが、時間を売る形なので伸びません。',
    scores: [['市場', 72], ['得意との一致', 68], ['資金', 95]] as [string, number][], rec: false },
];

export default function DiscoveryResultPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb="何をやるか決める" title="候補" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px' }}>
        <span style={{ fontSize: 15, lineHeight: '25px', display: 'block', maxWidth: 700, paddingBottom: 18 }}>
          条件から3つ出しました。<b>上の1つをおすすめします。</b>選ばなかった案も残るので、あとで比べられます。
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CANDS.map((c) => (
            <div key={c.title} style={{
              display: 'flex', gap: 22, padding: '18px 20px', borderRadius: 12,
              background: c.rec ? '#0C0C0C' : 'transparent',
              border: `1px solid ${c.rec ? '#262626' : '#1A1A1A'}`,
              borderLeft: c.rec ? '3px solid #1A73E8' : '1px solid #1A1A1A',
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{c.title}</span>
                  {c.rec && <span style={{ color: GREEN_T, fontSize: 11 }}>おすすめ</span>}
                </div>
                <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{c.lead}</span>
              </div>
              <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 3 }}>
                {c.scores.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 84, color: T5, fontSize: 11 }}>{k}</span>
                    <span style={{ flex: 1, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${v}%`, height: '100%', background: c.rec ? '#4A6C9B' : '#333' }} />
                    </span>
                  </div>
                ))}
              </div>
              {c.rec && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', alignSelf: 'center', height: 34, padding: '0 16px',
                  borderRadius: 8, background: BLUE, color: '#fff', whiteSpace: 'nowrap',
                }}>この案ではじめる</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <Composer placeholder="条件を変えて出しなおす" />
    </div>
  );
}
