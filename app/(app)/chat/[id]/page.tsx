'use client';

import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { COMPOSER_H, Composer, NEW_CHAT, TopBar } from '@/components/shell/Chrome';
import { Card } from '@/components/chat/Cards';
import { Orb } from '@/components/ui/Orb';
import { threadGet } from '@/app/actions/live';
import { chatSay, chatTargets } from '@/app/actions/chat';
import { streamReply } from '@/lib/chat/stream';
import type { ChatMsg } from '@/lib/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EXEC, RED_T, T1, T2, T4, T5 } from '@/lib/design/tokens';
/**
 * チャット＝2ペインの会話（参考: ChatGPT）。**右ペインは出さない** —
 * 候補も診断も質問も、**会話の中のカード**として出る。
 *
 * ここが**入口でもある**（2026-08-24 の作り直し）。
 * 「まだ決まっていない」「すでに事業がある」も、別の画面ではなくこの会話で進む。
 *
 * **返事は書けたそばから流れてくる**（`/api/chat`）。モデルが考えている数秒を
 * 黙って待たせない。カードは往復の終わりにしか揃わないので、
 * 流し終わってからスレッドを読み直して、本文ごとカードに差し替える。
 *
 * **1チャット = 1 Work。** Work は勝手に作られず、カードの「作る」を押したときだけできる。
 */

const You = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '100%', maxWidth: 748, display: 'flex', justifyContent: 'flex-end' }}>
    {/* 改行をそのまま出す（答えた条件は「質問 / → 答え」の2行で来る） */}
    <span style={{
      maxWidth: '78%', padding: '9px 16px', borderRadius: 18,
      background: '#24354A', color: '#DCE7F5', whiteSpace: 'pre-wrap', lineHeight: '22px',
    }}>
      {children}
    </span>
  </div>
);

/** **強調**だけ拾う */
const marks = (s: string) =>
  s.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part));

/**
 * 本文。**マークダウンは持ち込まない**が、モデルは書いてくる —
 * 見出しの `#`、箇条書きの `-`、強調の `**` は、そのまま出すと記号が地の文に混ざる。
 * ここで**3つだけ**受けて、あとは素の文にする。
 */
function Body({ text }: { text: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 15, lineHeight: '26px', color: T1 }}>
      {text.split('\n').map((raw, i) => {
        const head = /^#{1,6}\s+/.test(raw);
        const item = /^\s*[-*・]\s+/.test(raw);
        const body = raw.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*・]\s+/, '');
        if (!body.trim()) return <span key={i} style={{ height: 8 }} />;
        return (
          <span key={i} style={{ display: 'flex', gap: item ? 8 : 0 }}>
            {item && <span style={{ color: T5, flexShrink: 0 }}>・</span>}
            <span>{head ? <b>{marks(body)}</b> : marks(body)}</span>
          </span>
        );
      })}
    </span>
  );
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fresh = id === 'new';
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [title, setTitle] = useState(fresh ? NEW_CHAT : '');
  /** 送っている途中の、社長の発言（楽観表示） */
  const [pending, setPending] = useState<string | null>(null);
  /** 返事を待っている／流れてきている */
  const [wait, setWait] = useState(false);
  /** いま流れてきている本文（書き終わると msgs に入る） */
  const [live, setLive] = useState('');
  /** **いま何をしているか**（「〇〇しています」）。返している間ずっと出す */
  const [stage, setStage] = useState('');
  const [fail, setFail] = useState('');
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
   *
   * 途中で画面を閉じても、**サーバー側は書き終わってから保存する** — 戻ってくれば返事がある。
   * （止める道は作らない。返事は数行なので、止めるより読み終わるほうが早い）
   */
  const reply = useCallback(async (tid: string) => {
    setWait(true); setFail(''); setLive(''); setStage('会話を読んでいます');
    let got = '';
    const bad = await streamReply(tid, (t) => {
      got += t;
      if (!got.trim()) return;
      setLive(got); setStage('書いています');
    }, setStage);
    if (bad) setFail(bad);
    // **読み直してから**流れていた文を下ろす（本文が一瞬消えるのを避ける）
    const r = await threadGet(tid);
    if (r) apply(r);
    setLive(''); setStage(''); setPending(null); setWait(false);
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
   * 描き終わったあとから中身が高くなる。だから中身を測っておいて、**伸びたら貼り直す** —
   * 流れている本文が1行ずつ伸びるあいだも、これが効いている。
   * ただし社長が上を読んでいるあいだは動かさない（下の近くにいるときだけ）。
   */
  useEffect(() => {
    const el = box.current, kid = inner.current;
    if (!el || !kid) return;
    let stick = true;
    const pin = () => { if (stick) el.scrollTop = el.scrollHeight; };
    const watch = () => { stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    pin();
    el.addEventListener('scroll', watch, { passive: true });
    const ro = new ResizeObserver(pin);
    ro.observe(kid);
    return () => { el.removeEventListener('scroll', watch); ro.disconnect(); };
  }, [msgs.length, pending, wait, stage]);

  const send = (text: string) => {
    setPending(text); setFail('');
    void chatSay(fresh ? null : id, text).then((r) => {
      if (!r.ok) { setPending(null); setFail(r.message); return; }
      /**
       * 新しいチャットは、書けた時点でその会話へ移る。
       * **返事は移った先が取りに行く**（開いた会話の最後が社長の発言なら1回だけ頼む）。
       * ここで `asked` に印を付けない — いまは行き先が変わると器ごと作り直されるので
       * 印は消えるが、**消えなかったときに誰も返さなくなる**。頼りにしない。
       */
      if (fresh) { setPending(null); router.replace(`/chat/${r.threadId}` as Route); return; }
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

          {/* 流れてきている本文。**印は会話の中に置かない**（下に貼り付けてある） */}
          {wait && live && (
            <div style={{ width: '100%', maxWidth: 748 }}>
              <Body text={live} /><span className="caret" />
            </div>
          )}

          {/* 倒れたときは、理由と**もう一度**を出す（黙って終わらせない） */}
          {fail && !wait && (
            <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: RED_T, fontSize: 12.5 }}>{fail}</span>
              <button onClick={() => reply(id)} className="btn" style={{
                display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
                borderRadius: 8, color: T4, fontSize: 12,
              }}>もう一度</button>
            </div>
          )}
        </div>
        </div>
      )}

      {/**
        * **考えているあいだ、ずっと見えるところに出す**（参考: Claude の「〇〇中…」）。
        * 会話の中に置くと、下まで送られていないときに**入力欄の裏に隠れて見えない** —
        * 実際そうなって「動いているのか止まっているのか分からない」になった。
        * だから**流れない場所**（入力欄のすぐ上）に貼る。
        * 中身は道具の名前から来る**事実**だけ。分からないあいだは「考えています」。
        */}
      {(wait || pending !== null) && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: COMPOSER_H - 16, zIndex: 2,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9,
            padding: '0 2px',
          }}>
            <Orb color={EXEC} size={20} seed={7} />
            <span className="sh" style={{ fontSize: 12.5 }}>{stage || '考えています'}</span>
          </div>
        </div>
      )}

      <Composer placeholder="統括AIに書く" mode={to} local onSend={send} busy={pending !== null || wait} />
    </div>
  );
}
