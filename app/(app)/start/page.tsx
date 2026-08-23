'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { Ask, Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { startWork, type StartResult } from '@/app/actions/work';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';

import { DIM, EXEC, RED_T, SEAM, T2, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪ はじめての画面。入口は3つに分かれる。
 * 入力欄が主役なので中央に置く（floating=false）。**偽の中身を置かない。**
 *
 * ・**やりたいことがある**（Case A）→ そのまま書く。統括AIが計画まで引く
 * ・まだ決まっていない（Case B）→ 条件を集める
 * ・すでに事業がある（Case D）→ 取り込んで診断する
 */

const CHOICES = [
  { href: '/discovery', icon: 'search', title: 'まだ決まっていない', sub: '条件から一緒に決めます' },
  { href: '/import',    icon: 'globe',  title: 'すでに事業がある',   sub: '取り込んで、診断します' },
] as const;

export default function StartPage() {
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
      <TopBar title="はじめまして" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <Orb color={EXEC} size={104} seed={7} />
        <span style={{ fontSize: 26, lineHeight: '36px' }}>何をはじめますか？</span>
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
        {!busy && <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 748 }}>
          {CHOICES.map((c) => (
            <Link key={c.href} href={c.href} className="card" style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
              borderRadius: 12, background: '#0B0B0B', border: `1px solid ${SEAM}`,
            }}>
              <Icon name={c.icon} color={T4} size={16} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: T2 }}>{c.title}</span>
                <span style={{ color: T5, fontSize: 11.5 }}>{c.sub}</span>
              </div>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color={DIM} size={13} />
            </Link>
          ))}
        </div>}
      </div>
    </div>
  );
}
