import Link from 'next/link';
import { Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';

/** ① 新しい Work。入力欄が主役なので中央に置く（floating=false） */

const T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';

const SUGGEST: [string, string][] = [
  ['LPに載せる価格表を作る', '日本語学習サービス · フェーズ2から'],
  ['韓国のSNS運用を月4本まで増やす', 'SNS運用の立ち上げ · フェーズ2から'],
  ['申込フォームの離脱を調べる', 'LPと申込フォーム のタスクとして'],
];

export default function NewWorkPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="新しい Work" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <span style={{ fontSize: 26, lineHeight: '36px' }}>次は何をしますか？</span>
        <Composer placeholder="やりたいことを、そのまま書いてください" floating={false} />

        <div style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
          <span style={{ color: T5, fontSize: 11, paddingBottom: 6 }}>いま動いている仕事から</span>
          {SUGGEST.map(([t, sub], i) => (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 48,
              borderBottom: i === SUGGEST.length - 1 ? undefined : '1px solid #161616',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ color: T2 }}>{t}</span>
                <span style={{ color: T5, fontSize: 11 }}>{sub}</span>
              </div>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color="#3A3A3A" size={13} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
