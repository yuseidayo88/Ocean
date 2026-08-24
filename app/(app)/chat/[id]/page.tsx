'use client';

import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { COMPOSER_H, Composer, ExecStatus, NEW_CHAT, TopBar } from '@/components/shell/Chrome';
import { Card } from '@/components/chat/Cards';
import { Orb } from '@/components/ui/Orb';
import { threadGet } from '@/app/actions/live';
import { chatReply, chatSay, chatTargets } from '@/app/actions/chat';
import type { ChatMsg } from '@/lib/store';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [title, setTitle] = useState(fresh ? NEW_CHAT : '');
  const [pending, setPending] = useState<string | null>(null);
  /** 返事を取りに行っているあいだ（社長の発言はもう会話の中にある） */
  const [wait, setWait] = useState(false);
  const [gone, setGone] = useState(false);
  /** この会話が宛てている先（入力欄のラベル）。Work に紐づいていればその名前 */
  const [to, setTo] = useState(NEW_CHAT);
  /** 送るところ（外が動く器・中が中身）。中身が伸びたら下に貼り直す */
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  /** 返事を頼んだスレッド。開き直しで二度頼まない */
  const asked = useRef<string | null>(null);

  /** 読んだものを画面に写す */
  const apply = useCallback((r: NonNullable<Awaited<ReturnType<typeof threadGet>>>) => {
    setMsgs(r.messages);
    setTitle(r.thread.title);
    const wid = r.thread.workId;
    if (!wid) { setTo(NEW_CHAT); return; }
    chatTargets().then((ws) => setTo(ws.find((w) => w.id === wid)?.title ?? NEW_CHAT));
  }, []);

  /**
   * 統括AIに返してもらう。**書くのはもう終わっている**ので、待つのはここだけ。
   * 入口から来たときも同じ道を通る（社長の一言だけが入った会話が開き、そのまま返事が来る）。
   */
  const reply = useCallback(async (tid: string) => {
    setWait(true);
    await chatReply(tid);
    // **読み直してから**楽観表示を下ろす（自分の発言が一瞬消えるのを避ける）
    const r = await threadGet(tid);
    if (r) apply(r);
    setPending(null);
    setWait(false);
  }, [apply]);

  useEffect(() => {
    if (fresh) return;
    let on = true;
    threadGet(id).then((r) => {
      if (!on) return;
      if (!r) { setGone(true); return; }
      apply(r);
      // **返事がまだ来ていない会話**（入口から作られた直後）は、開いた側から取りに行く
      const last = r.messages[r.messages.length - 1];
      if (last?.role === 'user' && asked.current !== id) { asked.current = id; void reply(id); }
    });
    return () => { on = false; };
  }, [id, fresh, apply, reply]);

  /**
   * 送るたび・返るたびに、いちばん下へ（会話は下が現在）。
   *
   * **1回では届かない。** 書体が届いたりカードの中が伸びたりして、
   * 描き終わったあとから中身が高くなる（前は最初の1回で終わっていたので、
   * 長い会話を開くといちばん下の発言が見えないままだった）。
   * だから中身を測っておいて、**伸びたら貼り直す** — ただし
   * 社長が上を読んでいるあいだは動かさない（下の近くにいるときだけ）。
   */
  useEffect(() => {
    const el = box.current, kid = inner.current;
    if (!el || !kid) return;
    // **上を読んでいるあいだは動かさない。** 自分で送ったら（＝下にいるなら）ついていく
    let stick = true;
    const pin = () => { if (stick) el.scrollTop = el.scrollHeight; };
    const watch = () => { stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    pin();
    el.addEventListener('scroll', watch, { passive: true });
    const ro = new ResizeObserver(pin);
    ro.observe(kid);
    return () => { el.removeEventListener('scroll', watch); ro.disconnect(); };
  }, [msgs.length, pending, wait]);

  const send = (text: string) => {
    setPending(text);
    void chatSay(fresh ? null : id, text).then((r) => {
      if (!r.ok) { setPending(null); return; }
      // 新しいチャットは、書けた時点でその会話へ移る（返事は移った先が取りに行く）
      if (fresh) { asked.current = r.threadId; router.replace(`/chat/${r.threadId}` as Route); return; }
      void reply(id);
    });
  };

  const empty = !pending && !wait && msgs.length === 0;
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
        <div ref={box} className="sy" style={{ flex: 1, minHeight: 0 }}>
        <div ref={inner} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          // **いちばん下の発言を入力欄の裏に潜らせない**（`COMPOSER_H` ぶん逃がす）
          gap: 22, padding: `22px 24px ${COMPOSER_H}px`,
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
          {(pending || wait) && (
            <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Orb color={EXEC} size={22} seed={7} />
              <ExecStatus state="thinking" />
            </div>
          )}
        </div>
        </div>
      )}

      <Composer placeholder="統括AIに書く" mode={to} local onSend={send} busy={pending !== null || wait} />
    </div>
  );
}
