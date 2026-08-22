import { Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Centre } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';

/**
 * ⓪-b 候補をくらべる。**採用しなかった候補も残す**
 * （なぜその道を選んだかは、選ばなかった道と並べて意味になる）。
 * 「この案ではじめる」を2か所に置かない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', GREEN_T = '#5BB974';

const COND: [string, string][] = [
  ['使える時間', '週10時間'], ['元手', '〜50万円'], ['強み', '日本語教育'], ['形', '在庫を持たない'],
];

const AXES = ['立ち上がりの速さ', '初期費用の低さ', '強みとの相性'];

const CANDS = [
  { title: '韓国人向け 日本語学習サービス', rec: true,
    lead: 'あなたの日本語教育と韓国語の経験が、そのまま差になります。在庫も要りません。',
    scores: [86, 92, 94] },
  { title: '日本語教師むけ 教材の販売', rec: false,
    lead: '作れば売れ続けますが、最初の1本を作り切るまでが長い。',
    scores: [42, 88, 70] },
  { title: '企業むけ ビジネス日本語研修', rec: false,
    lead: '単価は高いが、営業に人前へ出る時間が要ります。',
    scores: [64, 76, 48] },
];

export default function DiscoveryResultPage() {
  return (
    <>
      <Centre>
        <TopBar crumb="何をやるか決める" title="候補" />

        {/* 集めた条件は上に貼る。答え終わったものだけ */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18,
          padding: '0 26px', height: 44, borderBottom: '1px solid #161616',
        }}>
          {COND.map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name="check" color={GREEN_T} size={11} width={2.4} />
              <span style={{ color: T5, fontSize: 11 }}>{k}</span>
              <span style={{ color: T2, fontSize: 12 }}>{v}</span>
            </span>
          ))}
          <span style={{ color: '#3A3A3A', fontSize: 11 }}>期限 未定</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: T4, fontSize: 12 }}>条件を変える</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px' }}>
          <span style={{ fontSize: 15, lineHeight: '25px', display: 'block', paddingBottom: 18 }}>
            条件に合う道を3つ。<b>いちばん上をおすすめします。</b>
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CANDS.map((c) => (
              <div key={c.title} style={{
                display: 'flex', gap: 24, padding: '18px 20px', borderRadius: 12,
                background: c.rec ? '#0C0C0C' : 'transparent',
                border: `1px solid ${c.rec ? '#262626' : '#1A1A1A'}`,
                borderLeft: c.rec ? `3px solid ${BLUE}` : '1px solid #1A1A1A',
              }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{c.title}</span>
                    {c.rec && <span style={{ color: GREEN_T, fontSize: 11 }}>おすすめ</span>}
                  </div>
                  <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{c.lead}</span>
                </div>
                <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  {AXES.map((a, i) => (
                    <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 92, color: T5, fontSize: 11 }}>{a}</span>
                      <span style={{ flex: 1, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${c.scores[i]}%`, height: '100%', background: c.rec ? '#4A6C9B' : '#333' }} />
                      </span>
                    </div>
                  ))}
                </div>
                <span style={{
                  alignSelf: 'center', display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
                  borderRadius: 8, whiteSpace: 'nowrap',
                  background: c.rec ? BLUE : 'transparent',
                  border: c.rec ? undefined : '1px solid #2A2A2A',
                  color: c.rec ? '#fff' : T3,
                }}>{c.rec ? 'この案ではじめる' : 'この案にする'}</span>
              </div>
            ))}
          </div>
        </div>

        <Composer placeholder="候補について統括AIに聞く" />
      </Centre>

      <Pane width={420} tabs={[{ label: 'この案をすすめる理由' }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0' }}>
          <span style={{ fontSize: 15, display: 'block' }}>韓国人向け 日本語学習サービス</span>
          <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['あなたの経験（日本語教育・韓国語）が、そのまま他社との差になります',
              '在庫を持たないので、外したときの損が小さい',
              '週10時間で、最初の形まで2ヶ月の見込み'].map((t) => (
              <span key={t} style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>・{t}</span>
            ))}
          </div>

          <PaneHead>選ばなかった理由も残します</PaneHead>
          {[['教材の販売', '最初の1本が長く、途中で判断材料が出ない'],
            ['ビジネス日本語研修', '「人前に出る」を外したいという条件に反する']].map(([k, v], i) => (
            <div key={k} style={{
              display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 0',
              borderBottom: i === 0 ? '1px solid #161616' : undefined,
            }}>
              <span style={{ color: T3, fontSize: 12.5 }}>{k}</span>
              <span style={{ color: T5, fontSize: 12, lineHeight: '19px' }}>{v}</span>
            </div>
          ))}
        </div>
      </Pane>
    </>
  );
}
