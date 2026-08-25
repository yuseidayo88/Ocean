'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { COMPOSER_H, Composer, NEW_CHAT, TopBar } from '@/components/shell/Chrome';
import { Card } from '@/components/chat/Cards';
import { Orb } from '@/components/ui/Orb';
import { threadGet } from '@/app/actions/live';
import { chatSay, chatTargets } from '@/app/actions/chat';
import { streamReply } from '@/lib/chat/stream';
import { useStick } from '@/lib/use-stick';
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

/**
 * 会話の画面。**最初のぶんはサーバーが持ってくる**（`first`）ので、
 * 開いた瞬間にはもう会話が出ている（前は器が立ち上がってから取りに行っていた）。
 */
export type FirstLoad =
  | { gone: true }
  | { gone: false; title: string; to: string; messages: ChatMsg[]; waiting: boolean;
      /** この会話が持っている Work（1チャット = 1 Work）。カードが「作る / 見る」を決める */
      workId?: string };

export function ChatView({ id, first }: { id: string; first: FirstLoad }) {
  const router = useRouter();
  const fresh = id === 'new';
  const [msgs, setMsgs] = useState<ChatMsg[]>(first.gone ? [] : first.messages);
  const [title, setTitle] = useState(first.gone ? '' : first.title || (fresh ? NEW_CHAT : ''));
  /** 送っている途中の、社長の発言（楽観表示） */
  const [pending, setPending] = useState<string | null>(null);
  /** 返事を待っている／流れてきている */
  const [wait, setWait] = useState(false);
  /** いま流れてきている本文（書き終わると msgs に入る） */
  const [live, setLive] = useState('');
  /** **いま何をしているか**（「〇〇しています」）。返している間ずっと出す */
  const [stage, setStage] = useState('');
  /** 考えている中身の断片（開示するモデルのときだけ）。無ければ出さない */
  const [thought, setThought] = useState('');
  const [fail, setFail] = useState('');
  const gone = first.gone;
  /** この会話が宛てている先（入力欄のラベル）。Work に紐づいていればその名前 */
  /**
   * 宛先の名前。**Work に紐づいていない会話は「新しいチャット」**。
   * サーバーは空文字で返す（Work が無いので名前も無い）ので、ここで名前を与える —
   * 既定値は `undefined` のときしか効かないので、空のままだと**⌄ だけが並ぶ**。
   */
  const [to, setTo] = useState(first.gone || !first.to ? NEW_CHAT : first.to);
  /** 送るところ（外が動く器・中が中身）。中身が伸びたら下に貼り直す */
  /** 会話はいつも下に貼り付く（右ペインと同じ1つの決まり → `lib/use-stick.ts`） */
  const [box, inner] = useStick<HTMLDivElement, HTMLDivElement>();
  /** 返事を頼んだスレッド。開き直しで二度頼まない */
  const asked = useRef<string | null>(null);
  /** この会話が持っている Work（1チャット = 1 Work）。カードが「作る / 見る」を決めるのに使う */
  const [workId, setWorkId] = useState<string | null>(first.gone ? null : first.workId ?? null);

  /** 読んだものを画面に写す */
  const apply = useCallback((r: NonNullable<Awaited<ReturnType<typeof threadGet>>>) => {
    setMsgs(r.messages);
    setTitle(r.thread.title);
    const wid = r.thread.workId;
    /**
     * **カードは id しか持たない**（→ CLAUDE.md）。この会話がもう Work を持っているかは
     * スレッドが知っているので、そこから渡す。前は「作った」がカードの中の state だけにあり、
     * **開き直すと「この Work を作る」に戻っていた** — もう有るのに作ると書いてある。
     */
    setWorkId(wid ?? null);
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
    setWait(true); setFail(''); setLive(''); setStage('会話を読んでいます'); setThought('');
    let got = '';
    let think = '';
    const bad = await streamReply(tid, (t) => {
      got += t;
      if (!got.trim()) return;
      setLive(got); setStage('書いています');
    }, setStage, (th) => {
      // 断片をつないで、**最新のひとかたまり**だけ見せる（行が変わったら前を捨てる）
      think = (think + th).split('\n').filter(Boolean).pop() ?? '';
      setThought(think.slice(-80));
    });
    if (bad) setFail(bad);
    // **読み直してから**流れていた文を下ろす（本文が一瞬消えるのを避ける）
    const r = await threadGet(tid);
    if (r) apply(r);
    setLive(''); setStage(''); setThought(''); setPending(null); setWait(false);
  }, [apply]);

  /**
   * **開いたときに読み直さない。** 中身はサーバーが持ってきている。
   * ここでやるのは1つだけ — **返事がまだ来ていない会話**（入口から作られた直後）に、
   * 開いた側から返事を頼むこと。
   */
  useEffect(() => {
    if (fresh || first.gone || !first.waiting) return;
    if (asked.current === id) return;
    asked.current = id;
    void reply(id);
  }, [id, fresh, first, reply]);

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
                  {m.card && <Card card={m.card} live={i === lastCard} threadId={id}
                                    workId={workId} onSend={send} />}
                </div>
              )
          ))}
          {pending && <You>{pending}</You>}

          {/**
            * **考えている印は、次の返事が出るところに置く**（2026-08-25 に社長の指示で移した）。
            * 参考: ChatGPT / Claude。返事が始まる場所でそのまま本文に入れ替わるので、
            * 目が動かない。前は入力欄のすぐ上に貼っていた — 隠れはしないが、
            * **返事とは違う場所**にあるので、出たあとに目線が飛んでいた。
            *
            * **会話は下に貼り付いている**（`useStick`）ので、これが増えても隠れない。
            * 中身は道具の名前から来る**事実**だけ。分からないあいだは「考えています」。
            */}
          {(wait || pending !== null) && (
            <div style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px', minWidth: 0 }}>
                <Orb color={EXEC} size={20} seed={7} />
                <span className="sh" style={{ fontSize: 12.5, flexShrink: 0 }}>{stage || '考えています'}</span>
                {/* 思考の断片（開示するモデルのときだけ）。1行・薄く */}
                {thought && (
                  <span style={{
                    color: T5, fontSize: 11.5, minWidth: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{thought}</span>
                )}
              </div>
              {/* 流れてきている本文は、その印の**すぐ下**に出る（右ペインとまったく同じ形） */}
              {live && <div><Body text={live} /><span className="caret" /></div>}
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

      <Composer placeholder="統括AIに書く" mode={to} local onSend={send} busy={pending !== null || wait} />
    </div>
  );
}
