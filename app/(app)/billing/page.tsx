'use client';

import { useEffect, useState } from 'react';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { billing } from '@/app/actions/run';
import { COMPOSER_H, DIM, GREEN_T, HAIR, T1, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * 請求・プラン。**トークンの数字を出していいのはこの画面だけ**（→ CLAUDE.md）。
 * ふだんの画面には出さない — 数字を見て仕事を選ぶ製品にしない。
 *
 * 支払い（Stripe）はまだ繋がっていない。**繋がっていないものは、そう書く。**
 */

const fmt = (n: number) => n.toLocaleString('ja-JP');

/** 台帳の reason → 日本語 */
const REASON: Record<string, string> = { grant: 'トライアルの付与', consume: 'AI社員の実行', refund: '返金' };

export default function BillingPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof billing>> | null>(null);
  useEffect(() => { billing().then(setData); }, []);

  return (
    <Centre>
      <TopBar title="請求とプラン" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `26px 30px ${COMPOSER_H}px` }}>
        {/* ラベル（小）→ 数字（大）→ 図形。数字の下に説明文を置かない */}
        <div style={{ display: 'flex', gap: 24, maxWidth: 760 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, borderRight: `1px solid ${HAIR}` }}>
            <span style={{ color: T4, fontSize: 12 }}>プラン</span>
            <span style={{ fontSize: 24, lineHeight: '30px' }}>トライアル</span>
            <span style={{ color: T5, fontSize: 11 }}>7日間 · 1人1回</span>
          </div>
          <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: T4, fontSize: 12 }}>残りのトークン</span>
            {data === null ? (
              <span style={{ fontSize: 24, lineHeight: '30px', color: T5 }}>—</span>
            ) : data.balanceTokens === null ? (
              <>
                <span style={{ fontSize: 24, lineHeight: '30px' }}>上限なし</span>
                <span style={{ color: T5, fontSize: 11 }}>デモの環境では数えていません</span>
              </>
            ) : (
              <span style={{ fontSize: 24, lineHeight: '30px', color: data.balanceTokens <= 0 ? '#F28B82' : T1 }} className="tnum">
                {fmt(data.balanceTokens)}
              </span>
            )}
          </div>

          {/**
            * **きょう使ったぶん**（2026-08-25）。見ていないあいだも会社が進むようにした以上、
            * 「目を離しているうちにどこまで使うか」が見えていないと閉じられない。
            * 残高は「もう無い」の線、これは「きょうはここまで」の線 — 当たっても
            * あすまた動く（→ `lib/run/budget.ts`）。
            */}
          <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 5, borderLeft: `1px solid ${HAIR}`, paddingLeft: 24 }}>
            <span style={{ color: T4, fontSize: 12 }}>きょう使ったぶん</span>
            {data === null || data.todayTokens === null ? (
              <>
                <span style={{ fontSize: 24, lineHeight: '30px', color: T5 }}>—</span>
                {data && <span style={{ color: T5, fontSize: 11 }}>デモの環境では数えていません</span>}
              </>
            ) : (
              <>
                <span style={{ fontSize: 24, lineHeight: '30px' }} className="tnum">{fmt(data.todayTokens)}</span>
                {data.capTokens === null ? (
                  <span style={{ color: T5, fontSize: 11 }}>1日の上限なし</span>
                ) : (
                  <>
                    {/* 数で言えるものは図形にする。当たっていたら赤（＝止まっている） */}
                    <div style={{ height: 3, borderRadius: 2, background: HAIR, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.round((data.todayTokens / data.capTokens) * 100))}%`,
                        height: '100%',
                        background: data.todayTokens >= data.capTokens ? '#D93025' : T3,
                      }} />
                    </div>
                    <span style={{ color: data.todayTokens >= data.capTokens ? '#F28B82' : T5, fontSize: 11 }} className="tnum">
                      {data.todayTokens >= data.capTokens
                        ? `1日の上限 ${fmt(data.capTokens)} に達しました。あすまた動きます`
                        : `1日の上限 ${fmt(data.capTokens)}`}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/**
          * **閉じているあいだ、会社は進むのか**（2026-08-26）。
          *
          * 「見ていなくても会社が進む」がこの製品の売りで、それを本当にしているのは
          * 1時間ごとの Cron。**鍵が3つそろっていないと何もしない** —
          * つまり画面を開いているあいだしか進まない。それが今までどこにも出ていなかった。
          *
          * 上限（きょうはここまで）だけ出して、進むかどうかを出さないのは片側だけ言っている。
          * **点＋素の文字**で足りる（ふつうの状態なのでピルにしない）。
          */}
        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, maxWidth: 760, paddingTop: 22 }}>
            <span style={{
              width: 7, height: 7, borderRadius: 999, flexShrink: 0,
              background: data.awake ? GREEN_T : DIM,
            }} />
            <span style={{ color: T4, fontSize: 12.5 }}>
              {data.awake
                ? '閉じているあいだも、1時間ごとに会社が進みます'
                : '閉じているあいだは進みません — いまは画面を開いているときだけ動きます'}
            </span>
          </div>
        )}

        <div style={{ maxWidth: 640, paddingTop: 40 }}>
          <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>これまでの出入り</span>
          {data && data.rows.length === 0 && (
            <span style={{ color: T5, fontSize: 12.5 }}>まだありません。AI社員が動くと、実行ごとにここへ並びます。</span>
          )}
          {data?.rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 42,
              borderBottom: i === data.rows.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <span style={{ color: T1 }}>{REASON[r.reason] ?? r.reason}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: r.deltaTokens > 0 ? GREEN_T : T4, fontSize: 13 }} className="tnum">
                {r.deltaTokens > 0 ? '+' : ''}{fmt(r.deltaTokens)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ maxWidth: 640, paddingTop: 40 }}>
          <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>支払い</span>
          <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px' }}>
            まだ繋がっていません。トライアルのあいだ、支払いの設定は要りません。
          </span>
        </div>
      </div>

      {/* **入力欄は全画面で同じものを1つ。** 逃がす余白（`COMPOSER_H`）は取ってあったのに
          入力欄だけが無く、下に 108px の空きが残っていた（下の余白を放置しない） */}
      <Composer placeholder="統括AIに聞く" />
    </Centre>
  );
}
