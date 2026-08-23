'use client';

import { useEffect, useState } from 'react';
import { Centre, TopBar } from '@/components/shell/Chrome';
import { billing } from '@/app/actions/run';
import { COMPOSER_H, GREEN_T, HAIR, T1, T3, T4, T5 } from '@/lib/design/tokens';

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
        <div style={{ display: 'flex', gap: 24, maxWidth: 640 }}>
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
        </div>

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
    </Centre>
  );
}
