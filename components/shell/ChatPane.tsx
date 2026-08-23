'use client';

import { usePathname } from 'next/navigation';
import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { Composer, ExecStatus, Pane } from '@/components/shell/Chrome';
import { CHAT_W, useShell } from '@/components/shell/Shell';
import { Orb } from '@/components/ui/Orb';
import { CHATS, THREADS, WORKS } from '@/lib/dummy';

import { EXEC, T2, T4, T5 } from '@/lib/design/tokens';
/**
 * **どの画面からでも統括AIと話せる。**
 * 中央の入力欄に書いて送ると、右ペインがその会話になって開き、入力欄はその中へ移る。
 *
 * 参考にしたもの（Mobbin）: ClickUp Brain / Fabric / HoneyBook / Customer.io。
 * 右にAIパネルを出すアプリは**例外なく入力欄もパネルの中**に置いている。
 * 会話を読む目と、書く手が、同じ場所にあるほうがいい。
 *
 * **右ペインの3つめの形は作らない。** これはパネル（画面そのものの付き添い）の一種で、
 * 見出し ＋ ✕ という作法は変えない。持ち出して読み比べるものではないのでタブにもしない。
 *
 * **返事は作らない。** 書いたものは出るが、統括AIは「考えています」で止まる（会話で答えるのは Phase 7 から）。
 */

/** その画面に紐づいたスレッド。Work の画面ならその Work のスレッド */
function threadFor(path: string) {
  const w = WORKS.find((x) => path.startsWith(`/work/${x.id}`));
  return (w && THREADS.find((t) => t.workId === w.id)?.id) ?? null;
}

export function ChatPane() {
  const path = usePathname();
  const { chat, closeChat, fresh } = useShell();

  // チャット画面では会話そのものが主役なので、右に出さない
  if (!chat.on || path.startsWith('/chat')) return null;

  const id = chat.thread ?? threadFor(path);
  const th = id ? THREADS.find((t) => t.id === id) : undefined;
  const past = id ? CHATS[id]?.turns ?? [] : [];
  const title = th?.title ?? '新しいチャット';

  return (
    <Pane chat width={CHAT_W} title={title} onClose={closeChat} right={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <button onClick={fresh} className="icob" title="新しいチャット"
                style={{ display: 'inline-flex', padding: 5 }}>
          <PlusMark />
        </button>
        {id && (
          <Link href={`/chat/${id}` as Route} className="icob" title="チャット画面へ"
                style={{ display: 'inline-flex', padding: 5 }}>
            <OpenMark />
          </Link>
        )}
      </span>
    }>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 8px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* これまでの会話。**要約しない**（同じスレッドの続きなので、そのまま出す） */}
        {past.map((t, i) => (
          t.who === 'you'
            ? <Said key={i}>{t.text}</Said>
            : <Exec key={i}>{t.lead.replace(/\*\*/g, '')}</Exec>
        ))}

        {past.length === 0 && chat.said.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12,
          }}>
            <Orb color={EXEC} size={44} seed={7} />
            <span style={{ color: T5, fontSize: 12.5 }}>何を相談しますか？</span>
          </div>
        )}

        {/* いま書いたぶん */}
        {chat.said.map((t, i) => <Said key={`s${i}`}>{t}</Said>)}

        {/* **嘘の返事を出さない。** まだ繋がっていないので、そう見せる */}
        {chat.said.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 2 }}>
            <Orb color={EXEC} size={22} seed={7} />
            <ExecStatus state="thinking" />
          </div>
        )}
      </div>

      {/* 入力欄はここへ移る。全画面で1つ、という決まりは変わらない */}
      <Composer placeholder="統括AIに書く" floating={false} inPane />
    </Pane>
  );
}

const Said = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <span style={{
      maxWidth: '86%', padding: '8px 13px', borderRadius: 15,
      background: '#24354A', color: '#DCE7F5', fontSize: 13.5, lineHeight: '21px',
    }}>{children}</span>
  </div>
);

const Exec = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: T2, fontSize: 13.5, lineHeight: '22px' }}>{children}</span>
);

const PlusMark = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2.5v9M2.5 7h9" stroke={T4} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const OpenMark = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M5.5 2.5h6v6M11.5 2.5 6 8M9 11.5H2.5V5" stroke={T4} strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
