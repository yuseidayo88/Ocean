'use client';

import { Go as Link } from '@/components/ui/Go';

import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';

import { pressable } from '@/lib/a11y';
import { AMBER_T, BLUE, COMPOSER_H, HAIR, MUTE, RED_T, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪-d 診断結果。**診断は必ず「次に何をするか（Work）」まで持つ。**
 * 見つけたことを並べて終わりにしない。数はラベル（小）→数字（大）→補足。
 */

const FACTS: [string, string, string, string?][] = [
  ['月の売上', '¥412,000', '12ヶ月で +8%'],
  ['生徒数', '23人', '新規 4 / 解約 3'],
  ['継続率', '—', '測れていません', RED_T],
  ['サイト来訪', '1,840', '月 · 申込 12'],
];

const FINDINGS: [string, string, string, string][] = [
  ['重い', '継続率を測れていない',   '解約の記録がどこにも残っていない',          'Work「継続率を見えるようにする」'],
  ['重い', '申込までの導線が長い',   'サイト来訪1,840に対して申込12（0.65%）',    'Work「申込フォームの作り直し」'],
  ['中くらい', '単価が競合より低い', '1回¥3,500。同条件の競合は¥4,200〜',         'Work「価格の見直し」'],
  ['軽い', 'SNSが更新されていない',  '最終投稿 3ヶ月前',                          'Work「SNS運用の立ち上げ」'],
];

const WEIGHT: Record<string, string> = { '重い': RED_T, '中くらい': AMBER_T, '軽い': MUTE };

export default function DiagnosisPage() {
  // 右は閉じた状態から始まる。見つかったことの1行を押すと開く
  const [open, setOpen] = useOpen();
  return (
    <>
      <Centre>
        <TopBar title="診断結果" onPanel={() => setOpen(FINDINGS[0][1])} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 720 }}>
            いちばん効くのは、<b>継続率を測れていないこと。</b>ここが見えないと、他の改善の効果も測れません。
          </span>

          {/* ラベル（小）→ 数字（大）→ 補足。説明文は置かない */}
          <div style={{ display: 'flex', gap: 26 }}>
            {FACTS.map(([k, v, sub, c], i) => (
              <div key={k} style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                borderRight: i === FACTS.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                <span style={{ fontSize: 24, lineHeight: '30px', color: c ?? T1 }} className="tnum">{v}</span>
                <span style={{ color: c ?? T5, fontSize: 11 }}>{sub}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>見つかったこと</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">· {FINDINGS.length}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>効きそうな順</span>
            </div>
            {FINDINGS.map(([w, title, why, next], i) => (
              <div key={title} className="row" {...pressable(() => setOpen(title))} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0',
                borderBottom: i === FINDINGS.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ width: 3, height: 30, borderRadius: 2, background: WEIGHT[w], flexShrink: 0 }} />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                  <span style={{ color: T5, fontSize: 11.5 }}>{why}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ width: 56, textAlign: 'right', color: WEIGHT[w], fontSize: 11.5 }}>{w}</span>
                <span style={{ width: 220, textAlign: 'right', color: T4, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {next}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: T3, fontSize: 13 }}>上の3つから Work を立てます</span>
            <div style={{ flex: 1 }} />
            <Link href="/work/w-japanese/plan" className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff',
            }}>この3つを始める</Link>
          </div>
        </div>
        <Composer placeholder="診断について統括AIに聞く" />
      </Centre>

      {open && (
      <Pane onClose={() => setOpen(null)} width={420} icon="dec" title="継続率を測れていない">
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
            background: 'rgba(217,48,37,0.18)', color: RED_T, fontSize: 12,
          }}>重い</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <span style={{ fontSize: 15, display: 'block' }}>継続率を測れていない</span>
          <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '12px 0 0' }}>
            解約がいつ・なぜ起きたかの記録がありません。いまの「新規4・解約3」は月次の差分から逆算した数字で、
            誰がいつ辞めたかは分かりません。
          </p>

          <PaneHead>根拠</PaneHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {['2025年の売上.xlsx に解約日の列がない',
              'サイトに解約フォームがなく、メール対応',
              'Analytics に会員IDが渡っていない'].map((t) => (
              <span key={t} style={{ color: T2, fontSize: 12.5, lineHeight: '20px' }}>・{t}</span>
            ))}
          </div>

          <PaneHead>提案する Work</PaneHead>
          {/* ここは押せるもの（下の「この Work を立てる」の対象）なので面を持てる */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', borderRadius: 10, background: '#131313' }}>
            <span style={{ fontSize: 14 }}>継続率を見えるようにする</span>
            <span style={{ color: T5, fontSize: 12 }}>3フェーズ · およそ3週 · AI社員2人</span>
          </div>
        </div>
        <PaneFooter primary="この Work を立てる" secondary="あとで" reverse />
      </Pane>
      )}
    </>
  );
}
