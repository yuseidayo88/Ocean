import { Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';

/** ⓪-c 事業の取り込み。サイト・資料・数字を渡す */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const GREEN_T = '#5BB974', BLUE = '#1A73E8';

const SOURCES = [
  { icon: 'globe',  name: 'kotonoha.jp', note: 'サイト · 12ページ', state: '完了' },
  { icon: 'deliv',  name: '事業計画_2026.pdf', note: 'PDF · 18ページ', state: '完了' },
  { icon: 'deliv',  name: '売上_2025.csv', note: '数字 · 24ヶ月', state: '読み込み中' },
] as const;

export default function ImportPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="事業の取り込み" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 680 }}>
          いまの事業を教えてください。<b>サイトのURLだけでも始められます。</b>
          資料と数字があるほど、診断が具体的になります。
        </span>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, height: 132, borderRadius: 12, border: '1px dashed #262626',
        }}>
          <Icon name="upload" color={T4} size={20} />
          <span style={{ color: T4, fontSize: 12.5 }}>資料・数字をここに落とす（PDF / CSV / .md）</span>
        </div>

        <div>
          <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>渡したもの</span>
          {SOURCES.map((s, i) => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', gap: 13, height: 46,
              borderBottom: i === SOURCES.length - 1 ? undefined : '1px solid #161616',
            }}>
              <Icon name={s.icon} color={T4} size={15} />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: T5, fontSize: 11 }}>{s.note}</span>
              </div>
              <div style={{ flex: 1 }} />
              {s.state === '完了'
                ? <Icon name="check" color={GREEN_T} size={13} width={2.2} />
                : <span style={{ color: T5, fontSize: 12 }}>読み込み中</span>}
            </div>
          ))}
        </div>

        <span style={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 34,
          padding: '0 16px', borderRadius: 8, background: BLUE, color: '#fff',
        }}>診断する</span>
      </div>
      <Composer placeholder="事業のことを書く、または URL を貼る" />
    </div>
  );
}
