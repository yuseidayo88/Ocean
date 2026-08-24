'use client';

import { usePathname } from 'next/navigation';
import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { Composer, Pane } from '@/components/shell/Chrome';
import { CHAT_W, useShell } from '@/components/shell/Shell';
import { Orb } from '@/components/ui/Orb';
import { threadGet, threadsList } from '@/app/actions/live';
import type { ChatMsg } from '@/lib/store';
import { useEffect, useState } from 'react';

import { EXEC, RED_T, SEAM, T2, T4, T5 } from '@/lib/design/tokens';
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
 * **中身はチャットの画面とまったく同じ統括AI**（`chatSay` → `/api/chat`）。
 * 前はここだけ道具を持たない別の返事だったので、同じことを聞いても形が違った。
 * 本文は**流れてくる**ので、書けたそばから読める。
 * 鍵の無い環境は「仮の返事」と名乗って返す — 偽の会話を作らない。
 *
 * **カードはここでは開かない。** 質問・候補・診断・Work の提案は会話の中で答えるものなので、
 * 「◯◯があります · 開く」の1行だけ置いて、チャットの画面へ渡す（狭い器に押し込まない）。
 */

export function ChatPane() {
  const path = usePathname();
  const { chat, closeChat, fresh } = useShell();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [title, setTitle] = useState('新しいチャット');

  const id = chat.thread;
  const rev = chat.rev;

  // スレッドが外れたら空に戻す。**描いている途中で直す**（effect にすると1回ずれて見える）
  const [seen, setSeen] = useState<string | null>(id);
  if (seen !== id) { setSeen(id); if (!id) { setMsgs([]); setTitle('新しいチャット'); } }

  // スレッドの中身。送るたび（rev）と、スレッドが変わるたびに読み直す
  useEffect(() => {
    if (!id) return;
    let on = true;
    threadGet(id).then((r) => {
      if (!on || !r) return;
      setMsgs(r.messages);
      setTitle(r.thread.title);
    });
    return () => { on = false; };
  }, [id, rev]);

  // Work の画面で会話を開いたら、その Work のスレッドに寄せる（あれば）
  useEffect(() => {
    if (id || !chat.on) return;
    const m = path.match(/^\/work\/([^/]+)$/);
    if (!m) return;
    let on = true;
    threadsList().then((ts) => {
      if (!on) return;
      const t = ts.find((x) => x.workId === m[1]);
      if (t) threadGet(t.id).then((r) => {
        if (on && r) { setMsgs(r.messages); setTitle(r.thread.title); }
      });
    });
    return () => { on = false; };
  }, [id, chat.on, path]);

  // チャット画面では会話そのものが主役なので、右に出さない
  if (!chat.on || path.startsWith('/chat')) return null;

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
        {msgs.map((m, i) => (
          m.role === 'user'
            ? <Said key={i}>{m.body}</Said>
            : (
              <span key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.body && <Exec>{m.body}</Exec>}
                {m.card && id && <CardLink kind={m.card.kind} href={`/chat/${id}` as Route} />}
              </span>
            )
        ))}

        {msgs.length === 0 && chat.said.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12,
          }}>
            <Orb color={EXEC} size={44} seed={7} />
            <span style={{ color: T5, fontSize: 12.5 }}>何を相談しますか？</span>
          </div>
        )}

        {/* いま送っている途中のぶん（楽観表示。書き終わると msgs に入って消える） */}
        {chat.said.map((t, i) => <Said key={`s${i}`}>{t}</Said>)}

        {/* 返している間の姿。**印はずっと出したまま**、その下に本文が流れる */}
        {chat.busy && (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 2 }}>
              <Orb color={EXEC} size={22} seed={7} />
              <span className="sh" style={{ fontSize: 12.5 }}>{chat.stage || '考えています'}</span>
            </span>
            {chat.live && <Exec>{chat.live}<span className="caret" /></Exec>}
          </span>
        )}

        {/* 倒れたときは理由を出す（黙って終わらせない） */}
        {!chat.busy && chat.fail && (
          <span style={{ color: RED_T, fontSize: 12.5 }}>{chat.fail}</span>
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
      maxWidth: '86%', padding: '8px 13px', borderRadius: 15, whiteSpace: 'pre-wrap',
      background: '#24354A', color: '#DCE7F5', fontSize: 13.5, lineHeight: '21px',
    }}>{children}</span>
  </div>
);

/**
 * カードは会話の中で答えるもの。**ここでは開かず、行き先だけ出す。**
 * 「何か出たのに、どこにも無い」を作らない。
 */
const CARD_WORDS: Record<string, string> = {
  ask: '聞きたいことがあります', candidates: '条件に合う道を出しました',
  diagnosis: '診断が出ました', work: 'Work の提案があります',
};
const CardLink = ({ kind, href }: { kind: string; href: Route }) => (
  <Link href={href} className="row" style={{
    display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 11px',
    borderRadius: 8, border: `1px solid ${SEAM}`, color: T2, fontSize: 12.5,
  }}>
    {CARD_WORDS[kind] ?? '続きがあります'}
    <span style={{ flex: 1 }} />
    <span style={{ color: T5, fontSize: 11.5 }}>チャットで開く</span>
  </Link>
);

const Exec = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: T2, fontSize: 13.5, lineHeight: '22px', whiteSpace: 'pre-wrap' }}>{children}</span>
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
