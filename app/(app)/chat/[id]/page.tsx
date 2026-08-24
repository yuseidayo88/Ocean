'use client';

import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { Orb } from '@/components/ui/Orb';
import { sendChat, threadGet } from '@/app/actions/live';
import type { ChatMsg } from '@/lib/store';
import { useEffect, useState } from 'react';

import { EXEC, T1, T2, T5 } from '@/lib/design/tokens';
/**
 * チャット＝2ペインの会話（ChatGPT と同じ。右ペインなし）。
 * **会話はここに一本化する。** Work は会話を持たない。
 *
 * 返事は本物 — 送ると統括AIが fast の1往復で返す（鍵の無い環境は「仮の返事」と名乗る）。
 * まだ何も話していなければ、何も無いと出す。
 */

const You = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '100%', maxWidth: 748, display: 'flex', justifyContent: 'flex-end' }}>
    <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>
      {children}
    </span>
  </div>
);

/** 本文。改行と **強調** だけ通す（マークダウンは持ち込まない） */
function Body({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 15, lineHeight: '26px', color: T1 }}>
      {text.split('\n').map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}
        </span>
      ))}
    </span>
  );
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fresh = id === 'new';
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [title, setTitle] = useState(fresh ? '新しいチャット' : '');
  const [pending, setPending] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (fresh) return;
    let on = true;
    threadGet(id).then((r) => {
      if (!on) return;
      if (!r) { setGone(true); return; }
      setMsgs(r.messages);
      setTitle(r.thread.title);
    });
    return () => { on = false; };
  }, [id, fresh]);

  /** この画面が書いたものは、この画面の会話として続く（右ペインを開かない） */
  const send = (text: string) => {
    setPending(text);
    void sendChat(fresh ? null : id, text).then((r) => {
      if (!r.ok || !r.threadId) { setPending(null); return; }
      if (fresh) { router.replace(`/chat/${r.threadId}` as Route); return; }
      threadGet(id).then((t) => {
        setPending(null);
        if (t) { setMsgs(t.messages); setTitle(t.thread.title); }
      });
    });
  };

  const empty = !pending && msgs.length === 0;

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb={fresh ? undefined : 'チャット'} title={title || (gone ? '見つかりません' : '…')} />

      {empty ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Orb color={EXEC} size={72} seed={7} />
            <span style={{ fontSize: 20 }}>{gone ? 'このチャットは見つかりませんでした' : '何を相談しますか？'}</span>
            {!gone && <span style={{ color: T5, fontSize: 12.5 }}>待っています</span>}
            {gone && <Link href="/chat/new" style={{ color: T2, fontSize: 13 }}>新しいチャットを始める</Link>}
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 22, padding: '22px 24px 0', overflowY: 'auto',
        }}>
          {msgs.map((m, i) => (
            m.role === 'user'
              ? <You key={i}>{m.body}</You>
              : (
                <div key={i} style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Body text={m.body} />
                </div>
              )
          ))}
          {pending && <You>{pending}</You>}
          {pending && (
            <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Orb color={EXEC} size={22} seed={7} />
              <ExecStatus state="thinking" />
            </div>
          )}
          <div style={{ flex: 1 }} />
        </div>
      )}

      <Composer placeholder="統括AIに書く" local onSend={send} busy={pending !== null} />
    </div>
  );
}
