import { Composer, TopBar } from '@/components/shell/Chrome';
import { Diamond, Icon } from '@/components/ui/Icon';

/**
 * ⓪-d 診断結果。**診断は必ず「次に何をするか（Work）」まで持つ。**
 * 見つけたことを並べて終わりにしない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER_T = '#FDD663', RED_T = '#F28B82', GREEN_T = '#5BB974';

const FINDINGS: [string, string, string, string][] = [
  ['high', '申込フォームで7割が離脱している', '入力が11項目あります', 'Work「LPと申込フォーム」'],
  ['high', '価格がどこにも書かれていない', '問い合わせページにだけあります', 'Work「日本語学習サービス」'],
  ['mid',  '検索から人が来ていない', '記事が3本しかありません', 'Work「SNS運用の立ち上げ」'],
  ['low',  'SNSが更新されていない', '最終投稿 3ヶ月前', 'Work「SNS運用の立ち上げ」'],
];

const COL: Record<string, string> = { high: RED_T, mid: AMBER_T, low: T5 };

export default function DiagnosisPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb="事業の取り込み" title="診断結果" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 700 }}>
          4つ見つけました。<span style={{ color: RED_T }}>上の2つが売上に直接効きます。</span>
          そのまま Work にできます。
        </span>

        <div>
          <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>見つけたこと</span>
          {FINDINGS.map(([lv, title, why, next], i) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0',
              borderBottom: i === FINDINGS.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ width: 3, height: 30, borderRadius: 2, background: COL[lv], opacity: lv === 'low' ? 0.4 : 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                <span style={{ color: T5, fontSize: 11.5 }}>{why}</span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ color: T4, fontSize: 12, whiteSpace: 'nowrap' }}>{next}</span>
            </div>
          ))}
        </div>

        <div>
          <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>次にやること</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 12,
            background: '#0C0C0C', border: '1px solid #262626', borderLeft: '3px solid #1A73E8',
          }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 16 }}>LPと申込フォーム</span>
              <span style={{ color: T2, fontSize: 13 }}>
                入力を4項目に減らし、価格を出します。3フェーズ・およそ4週。AI社員は2体。
              </span>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff', whiteSpace: 'nowrap',
            }}>この Work をはじめる</span>
          </div>
        </div>
      </div>
      <Composer placeholder="診断について統括AIに聞く" />
    </div>
  );
}
