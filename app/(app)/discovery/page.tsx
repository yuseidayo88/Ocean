import { Ask, Chips, Composer, TopBar } from '@/components/shell/Chrome';
import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';

/** ⓪-a 条件を集める。構造で集めて、候補3つの比較へつなぐ */

const T1 = '#EDEDED', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663';

export default function DiscoveryPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb="チャット" title="何をやるか決める" right={
        <span style={{ color: T5, fontSize: 12 }} className="tnum">条件 3 / 5</span>
      } />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '22px 24px 0', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 748, display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>
            何をやればいいか、まだ決まっていない
          </span>
        </div>
        <div style={{ width: '100%', maxWidth: 748, display: 'flex', gap: 13 }}>
          <Orb color="#D2D2D2" size={26} seed={7} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T5, fontSize: 12 }}>
              8秒 考えました<Icon name="chev" color={T5} size={11} />
            </span>
            <span style={{ fontSize: 15, lineHeight: '26px' }}>
              先に条件だけ教えてください。<b>全部でなくて構いません。</b>足りない分はこちらで仮に置いて、候補を3つ出します。
            </span>
          </div>
        </div>
        <Chips items={[['時間', '週10時間'], ['資金', '〜50万円'], ['得意', '日本語教育 · 韓国語 · SNS運用']]} />
        <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Dot color={AMBER} size={7} />
          <span style={{ color: AMBER_T, fontSize: 12.5 }}>確認したいことがあります</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <Composer placeholder="条件を足す、または「もう出して」"
        above={<Ask q="やりたくないことはありますか？" idx={3} total={5}
          options={[
            { label: '在庫を持つ', note: '仕入れと保管が要る案を外します' },
            { label: '人前に出る', note: '営業や撮影が要る案を外します' },
            { label: '夜間の対応', note: '時差のある顧客を外します' },
          ]} free="とくにない、または自分で書く" />} />
    </div>
  );
}
