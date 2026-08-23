'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Ask, Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { startWork, type StartResult } from '@/app/actions/work';
import { DIM, HAIR, RED_T, T2, T5 } from '@/lib/design/tokens';

/**
 * ① 新しい Work。入力欄が主役なので中央に置く（floating=false）。
 *
 * 書いて送ると **統括AIが入れ物を決めて、質問し、社員を薦め、計画を引く**（Phase 5）。
 * 終わりが言えない依頼のときは、入れ物に入れずに**先に聞き返す**。
 */

const SUGGEST: [string, string][] = [
  ['LPに載せる価格表を作る', '日本語学習サービス · フェーズ2から'],
  ['韓国のSNS運用を月4本まで増やす', 'SNS運用の立ち上げ · フェーズ2から'],
  ['申込フォームの離脱を調べる', 'LPと申込フォーム のタスクとして'],
];

export default function NewWorkPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<StartResult | null>(null);
  /** 直前に書いたゴール。聞き返しに答えるとき、これに足して渡し直す */
  const [goal, setGoal] = useState('');

  const go = async (text: string) => {
    setBusy(true); setRes(null); setGoal(text);
    const r = await startWork(text);
    if (r.ok) { router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy(false); setRes(r);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="新しい Work" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <span style={{ fontSize: 26, lineHeight: '36px' }}>次は何をしますか？</span>

        {/* **返事を作らない。** 考えているあいだは、考えているとだけ出す */}
        {busy && <ExecStatus state="thinking" />}

        <Composer placeholder="やりたいことを、そのまま書いてください" floating={false}
          onSend={go} busy={busy}
          above={res && !res.ok && res.need === 'end'
            ? <Ask q={res.body} idx={1} total={1} free="自分の言葉で書く" busy={busy}
                   options={res.options.map((o) => ({ label: o.label, note: o.description }))}
                   /* **選んだら本当に進む。** 選んだ終わり方を足して、もう一度統括AIに渡す */
                   onPick={(label) => go(`${goal}\n終わりの決め方: ${label}`)}
                   onFree={(text) => go(`${goal}\n終わりの決め方: ${text}`)}
                   onSkip={() => setRes(null)} />
            : undefined} />

        {res && !res.ok && res.need === 'error' && (
          <span style={{ color: RED_T, fontSize: 12.5 }}>{res.message}</span>
        )}

        {!busy && (
        <div style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
          <span style={{ color: T5, fontSize: 11, paddingBottom: 6 }}>いま動いている仕事から</span>
          {SUGGEST.map(([t, sub], i) => (
            <button key={t} onClick={() => go(t)} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 48, borderRadius: 7,
              borderBottom: i === SUGGEST.length - 1 ? undefined : `1px solid ${HAIR}`, textAlign: 'left',
            }}>
              {/* どこから来た提案かは**右に列として**並べる。タイトルの下に積まない */}
              <span style={{ minWidth: 0, color: T2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 11, whiteSpace: 'nowrap' }}>{sub}</span>
              <Icon name="chev" color={DIM} size={13} />
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
