'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { chatStart } from '@/app/actions/chat';
import type { Entry } from '@/lib/exec/openers';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';

import { DIM, EXEC, RED_T, SEAM, T2, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪ はじめての画面。**入口は3つとも、チャットになる**（2026-08-24 の作り直し）。
 *
 * 前は「まだ決まっていない」「すでに事業がある」が別の画面へ飛んでいた。
 * いまは**どれも新しいチャットを1本作って**、そこで統括AIが聞いていく。
 * 会話の置き場が1つになるので、あとから「あのとき何を話したか」を探せる。
 *
 * 入力欄が主役なので中央に置く（floating=false）。**偽の中身を置かない。**
 */

/**
 * **何を頼めるのかを、押せる形で見せる**（2026-08-25）。
 *
 * ここは入力欄が1つあるだけだった。**やりたいことが言葉になっている人**しか
 * 先へ進めない画面で、いちばん最初につまずくところ。
 *
 * 説明のコピーではなく**提案**にする — 押すとその言葉で会話が始まり、
 * 統括AIが聞き返してくる。押しただけでは Work にならないので、覗くのは安全。
 * 選んだ4つは、**一人社長が実際に社員に頼むこと**（名簿の7人に素直に割り振れる形）。
 */
const EXAMPLES = [
  // **3つで1行に収める。** 4つだと折り返して1つだけ次の行に落ち、並びが崩れる。
  // 作る / 決める / 調べる を1つずつ — 会社に何を頼めるかの幅が、これで伝わる
  'オンライン講座をはじめたい',
  'いまの価格を決め直したい',
  '競合を調べて勝てる場所を探したい',
];

const CHOICES: { entry: Entry; icon: IconName; title: string; sub: string }[] = [
  { entry: 'discovery', icon: 'search', title: 'まだ決まっていない', sub: '条件から一緒に決めます' },
  { entry: 'import', icon: 'globe', title: 'すでに事業がある', sub: '取り込んで、診断します' },
];

export default function StartPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  /** **どの入口も、新しいチャットを1本作る。** 行き先は必ずその会話 */
  const open = async (entry: Entry, text?: string) => {
    if (busy) return;
    setBusy(true); setFail('');
    const r = await chatStart(entry, text);
    if (r.ok) { router.push(`/chat/${r.threadId}` as Route); return; }
    setBusy(false); setFail(r.message);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="はじめまして" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <Orb color={EXEC} size={104} seed={7} />
        <span style={{ fontSize: 26, lineHeight: '36px' }}>何をはじめますか？</span>
        {busy && <ExecStatus state="thinking" />}
        <Composer placeholder="やりたいことを、そのまま書いてください" floating={false}
          onSend={(t) => open('goal', t)} busy={busy} />
        {fail && <span style={{ color: RED_T, fontSize: 12.5 }}>{fail}</span>}
        {!busy && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8,
            width: '100%', maxWidth: 748,
          }}>
            {EXAMPLES.map((t) => (
              <button key={t} onClick={() => open('goal', t)} className="btn" style={{
                height: 30, padding: '0 12px', borderRadius: 8,
                border: `1px solid ${SEAM}`, color: T4, fontSize: 12.5,
              }}>{t}</button>
            ))}
          </div>
        )}
        {!busy && <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 748 }}>
          {CHOICES.map((c) => (
            <button key={c.entry} onClick={() => open(c.entry)} className="card" style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
              borderRadius: 12, background: '#0B0B0B', border: `1px solid ${SEAM}`, textAlign: 'left',
            }}>
              <Icon name={c.icon} color={T4} size={16} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: T2 }}>{c.title}</span>
                <span style={{ color: T5, fontSize: 11.5 }}>{c.sub}</span>
              </span>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color={DIM} size={13} />
            </button>
          ))}
        </div>}
      </div>
    </div>
  );
}
