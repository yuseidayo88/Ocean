'use client';

import { Go as Link } from '@/components/ui/Go';

import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { pressable } from '@/lib/a11y';
import { BLUE, COMPOSER_H, DIM, GREEN, HAIR, MUTE, RULE, SEAM, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/** ⓪-c 事業の取り込み。あるものだけ渡せばいい。読み終わってから診断する */

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
  const [open, setOpen] = useOpen();
  const done = SOURCES.filter((s) => s.state === '完了').length;
  return (
    <>
      <Centre>
        <TopBar title="事業の取り込み" onPanel={() => setOpen(SOURCES[0].name)} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 680 }}>
            いまの事業のことを教えてください。<b>あるものだけで構いません。</b>
          </span>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 9, height: 128, borderRadius: 12, border: `1px dashed ${RULE}`,
          }} className="card">
            <Icon name="upload" color={T4} size={19} />
            <span style={{ color: T4, fontSize: 12.5 }}>サイトのURL、資料、売上の表をここへ</span>
            <span style={{ color: DIM, fontSize: 11 }}>PDF · 表 · 画像 · URL</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>取り込んだもの</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">· {SOURCES.length}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }} className="tnum">{done} / {SOURCES.length} 完了</span>
            </div>
            {/* 1件1行。種類は右に列として並べ、進み具合は棒で見せる（積まない） */}
            {SOURCES.map((s, i) => {
              const pct = s.state === '完了' ? 100 : s.state === '読込中' ? 34 : 0;
              return (
                <div key={s.name} className="row" {...pressable(() => setOpen(s.name))} style={{
                  display: 'flex', alignItems: 'center', gap: 14, height: 43,
                  borderBottom: i === SOURCES.length - 1 ? undefined : `1px solid ${HAIR}`,
                }}>
                  <Icon name={s.icon} color={s.state === '待機' ? `${DIM}` : T4} size={15} />
                  <span style={{
                    flex: 1, minWidth: 0, color: s.state === '待機' ? T4 : T1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.name}</span>
                  <span style={{
                    width: 140, flexShrink: 0, color: T5, fontSize: 11,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.note}</span>
                  <span style={{ width: 66, flexShrink: 0, height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: s.state === '完了' ? GREEN : MUTE }} />
                  </span>
                  <span style={{
                    width: 44, flexShrink: 0, textAlign: 'right', fontSize: 12,
                    color: s.state === '完了' ? T4 : s.state === '読込中' ? T2 : T5,
                  }}>{s.state}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: T5, fontSize: 12.5 }}>読み終わってから診断します</span>
            <div style={{ flex: 1 }} />
            <Link href="/diagnosis" className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff',
            }}>診断する</Link>
          </div>
        </div>
        <Composer placeholder="取り込みについて統括AIに聞く" />
      </Centre>

      {open && (
      <Pane onClose={() => setOpen(null)} width={400} icon="globe" title="nihongo-lesson.jp">
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: T5, fontSize: 12 }}>読み取り</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          {/* 取り込んだページの見た目。サムネイルは面と枠を持てる */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 9, height: 92, padding: '14px 16px',
            borderRadius: 10, background: '#0C0C0C', border: `1px solid ${SEAM}`,
          }}>
            <span style={{ height: 5, width: '62%', borderRadius: 2, background: '#242424' }} />
            <span style={{ height: 4, width: '86%', borderRadius: 2, background: SUNK }} />
            <div style={{ display: 'flex', gap: 9, paddingTop: 2 }}>
              {[0, 1, 2].map((k) => (
                <span key={k} style={{ flex: 1, height: 22, borderRadius: 5, background: '#151515' }} />
              ))}
            </div>
          </div>

          <PaneHead>読み取れたこと</PaneHead>
          {/* 名前が主役ではないので、事実は右に列として並べる */}
          {READ.map(([k, v], i) => (
            <div key={k} style={{
              display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 0',
              borderBottom: i === READ.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <span style={{ width: 80, flexShrink: 0, color: T5, fontSize: 12 }}>{k}</span>
              <span style={{ flex: 1, textAlign: 'right', color: T2, fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '11px 0' }}>
            <span style={{ width: 80, flexShrink: 0, color: T5, fontSize: 12 }}>見つからない</span>
            <span style={{ flex: 1, textAlign: 'right', color: T2, fontSize: 13 }}>解約率・継続率の記載</span>
          </div>
        </div>
      </Pane>
      )}
    </>
  );
}
