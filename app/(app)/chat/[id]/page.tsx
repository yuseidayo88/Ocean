'use client';

import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { Card } from '@/components/chat/Cards';
import { Orb } from '@/components/ui/Orb';
import { threadGet } from '@/app/actions/live';
import { chatSend, chatTargets } from '@/app/actions/chat';
import type { ChatMsg } from '@/lib/store';
import { useEffect, useRef, useState } from 'react';

import { EXEC, T1, T2 } from '@/lib/design/tokens';
/**
 * チャット＝2ペインの会話（参考: ChatGPT）。**右ペインは出さない** —
 * 候補も診断も質問も、**会話の中のカード**として出る。
 *
 * ここが**入口でもある**（2026-08-24 の作り直し）。
 * 「まだ決まっていない」「すでに事業がある」も、別の画面ではなくこの会話で進む。
 *
 * **1チャット = 1 Work。** Work は勝手に作られず、カードの「作る」を押したときだけできる。
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
  /** この会話が宛てている先（入力欄のラベル）。Work に紐づいていればその名前 */
  const [to, setTo] = useState('新しいチャット');
  const foot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fresh) return;
    let on = true;
    threadGet(id).then((r) => {
      if (!on) return;
      if (!r) { setGone(true); return; }
      setMsgs(r.messages);
      setTitle(r.thread.title);
      const wid = r.thread.workId;
      if (!wid) { setTo('新しいチャット'); return; }
      chatTargets().then((ws) => { if (on) setTo(ws.find((w) => w.id === wid)?.title ?? '新しいチャット'); });
    });
    return () => { on = false; };
  }, [id, fresh]);

  // 送るたび・返るたびに、いちばん下へ（会話は下が現在）
  useEffect(() => { foot.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, pending]);

  const send = (text: string) => {
    setPending(text);
    void chatSend(fresh ? null : id, text).then((r) => {
      if (!r.ok || !('threadId' in r) || !r.threadId) { setPending(null); return; }
      if (fresh) { router.replace(`/chat/${r.threadId}` as Route); return; }
      threadGet(id).then((t) => {
        setPending(null);
        if (t) { setMsgs(t.messages); setTitle(t.thread.title); }
      });
    });
  };

  const empty = !pending && msgs.length === 0;
  // **動くのはいちばん新しいカードだけ。** 会話が先に進んだら、古いカードは読むだけ
  const lastCard = msgs.reduce((at, m, i) => (m.card ? i : at), -1);

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title={title || (gone ? '見つかりません' : '…')} />

      {empty ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Orb color={EXEC} size={72} seed={7} />
            <span style={{ fontSize: 20 }}>{gone ? 'このチャットは見つかりませんでした' : '何を相談しますか？'}</span>
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
                  {m.body && <Body text={m.body} />}
                  {m.card && <Card card={m.card} live={i === lastCard} threadId={id} onSend={send} />}
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
          <div ref={foot} style={{ height: 1, flexShrink: 0 }} />
        </div>
      )}

      <Composer placeholder="統括AIに書く" mode={to} local onSend={send} busy={pending !== null} />
    </div>
  );
}
