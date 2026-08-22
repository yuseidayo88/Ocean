import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Icon, type IconName } from '@/components/ui/Icon';

/** ⓪-c 事業の取り込み。あるものだけ渡せばいい。読み終わってから診断する */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', GREEN_T = '#5BB974';

const SOURCES: { icon: IconName; name: string; note: string; state: '完了' | '読込中' | '待機' }[] = [
  { icon: 'globe', name: 'nihongo-lesson.jp',        note: 'サイト · 12ページ',   state: '完了' },
  { icon: 'deliv', name: '2025年の売上.xlsx',        note: 'スプレッドシート · 3シート', state: '完了' },
  { icon: 'deliv', name: '事業計画_2025.pdf',        note: 'PDF · 18ページ',      state: '完了' },
  { icon: 'bars',  name: 'Google Analytics',         note: '直近12ヶ月',          state: '読込中' },
  { icon: 'chat',  name: 'Instagram @nihongo_lesson', note: '投稿 240件',          state: '待機' },
];

const READ: [string, string][] = [
  ['売っているもの', 'オンライン日本語レッスン（マンツーマン）'],
  ['対象', '韓国・台湾の社会人'],
  ['価格', '1回 ¥3,500 / 月8回 ¥25,000'],
];

export default function ImportPage() {
  const done = SOURCES.filter((s) => s.state === '完了').length;
  return (
    <>
      <Centre>
        <TopBar title="事業の取り込み" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 680 }}>
            いまの事業のことを教えてください。<b>あるものだけで構いません。</b>
          </span>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 9, height: 128, borderRadius: 12, border: '1px dashed #262626',
          }}>
            <Icon name="upload" color={T4} size={19} />
            <span style={{ color: T4, fontSize: 12.5 }}>サイトのURL、資料、売上の表をここへ</span>
            <span style={{ color: '#3A3A3A', fontSize: 11 }}>PDF · 表 · 画像 · URL</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>取り込んだもの</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">· {SOURCES.length}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }} className="tnum">{done} / {SOURCES.length} 完了</span>
            </div>
            {SOURCES.map((s, i) => (
              <div key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 13, height: 48,
                borderBottom: i === SOURCES.length - 1 ? undefined : '1px solid #161616',
              }}>
                <Icon name={s.icon} color={s.state === '待機' ? '#3A3A3A' : T4} size={15} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                  <span style={{ color: s.state === '待機' ? T4 : T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                  <span style={{ color: T5, fontSize: 11 }}>{s.note}</span>
                </div>
                <div style={{ flex: 1 }} />
                {s.state === '完了'
                  ? <Icon name="check" color={GREEN_T} size={13} width={2.2} />
                  : <span style={{ color: T5, fontSize: 12 }}>{s.state}</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: T5, fontSize: 12.5 }}>読み終わってから診断します</span>
            <div style={{ flex: 1 }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff',
            }}>診断する</span>
          </div>
        </div>
        <Composer placeholder="取り込みについて統括AIに聞く" />
      </Centre>

      <Pane width={400} tabs={[{ label: 'nihongo-lesson.jp' }]}>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: T5, fontSize: 12 }}>読み取り</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <PaneHead top>読み取れたこと</PaneHead>
          {READ.map(([k, v], i) => (
            <div key={k} style={{
              display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 0',
              borderBottom: i === READ.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ color: T5, fontSize: 11 }}>{k}</span>
              <span style={{ color: T2, fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <PaneHead>見つからない</PaneHead>
          <span style={{ color: '#F28B82', fontSize: 13 }}>解約率・継続率の記載</span>
        </div>
      </Pane>
    </>
  );
}
