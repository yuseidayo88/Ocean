'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Icon } from '@/components/ui/Icon';
import { Go as Link } from '@/components/ui/Go';
import { conditionChips } from '@/lib/live/conditions';
import { Orb } from '@/components/ui/Orb';
import { adoptCandidate, discoveryGet, findingToWork, profileGet } from '@/app/actions/entry';
import { chatMakeWork } from '@/app/actions/chat';
import type { ChatCard, Discovery, Profile } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { BLUE, EDGE, EXEC, GREEN, GREEN_T, HAIR, MUTE, RED_T, SEAM, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * 会話の中に出るカード。**右ペインは開かない** — 中身は会話の中で完結する。
 *
 * ・**カードは id しか持たない。** 中身は描くときに store から読むので、
 *   「もう採用した」「もう Work にした」が常に正しく出る
 * ・**動くのはいちばん新しいカードだけ**（`live`）。会話が先に進んだら、
 *   古いカードは読むだけになる — ChatGPT / Claude と同じ振る舞い
 */

const WRAP: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', marginTop: 4,
  borderRadius: 12, background: '#0B0B0B', border: `1px solid ${SEAM}`, overflow: 'hidden',
};
const HEAD: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 0', color: T3, fontSize: 12.5,
};

export function Card({ card, live, threadId, workId, onSend }:
  { card: ChatCard; live: boolean; threadId: string; workId?: string | null;
    onSend: (text: string) => void }) {
  if (card.kind === 'ask') return <AskCard card={card} live={live} onSend={onSend} />;
  if (card.kind === 'candidates') return <CandidatesCard id={card.sessionId} live={live} threadId={threadId} onSend={onSend} />;
  if (card.kind === 'diagnosis') return <DiagnosisCard id={card.profileId} live={live} threadId={threadId} />;
  return <WorkCard card={card} live={live} threadId={threadId} workId={workId} />;
}

/* ══════════════ 質問（選択肢） ══════════════ */

/**
 * 聞かれたことに答える。**最後まで答えてから、まとめて1通で送る。**
 *
 * 1問ずつ送ると、途中の答えだけで統括AIが走り出してしまう
 * （2問目を聞いておきながら、1問目の答えで候補を出す、が起きる）。
 * 溜めておいて、**最後の1問に答えた瞬間だけ**会話に流す。
 *
 * 答え終わった質問は**緑のチェックつきの行**で上に残り、押せば戻って選び直せる
 * （送る前なら、何度でも直せる）。
 */
function AskCard({ card, live, onSend }:
  { card: Extract<ChatCard, { kind: 'ask' }>; live: boolean; onSend: (t: string) => void }) {
  const qs = card.questions;
  const [answers, setAnswers] = useState<(string | undefined)[]>(() => qs.map(() => undefined));
  const [at, setAt] = useState(0);
  const [sent, setSent] = useState(false);
  /** 選択肢に無いことを、その場で書く（→ 最後の行） */
  const [free, setFree] = useState('');

  const q = qs[at];
  if (!q) return null;
  const on = live && !sent;
  /**
   * **送ったあとは、ぜんぶ同じ形にする。**
   * 前は最後の1問だけ選択肢が開いたまま残り、**その問だけ別のものに見えていた**。
   * 答え終わったものは、何問めでも「✓ 質問 答え」の1行。
   */
  const done = sent || answers.every((a) => a !== undefined);

  const pick = (label: string) => {
    const next = [...answers];
    next[at] = label;
    setAnswers(next);
    setFree('');
    // **全部そろったら、そこで初めて送る**（1通にまとめる）
    const missing = next.findIndex((a) => a === undefined);
    if (missing < 0) {
      setSent(true);
      /**
       * **読める形で送る。** 前は `質問 → 答え` を改行でつないでいたが、
       * 吹き出しが改行を潰して**1行に全部つながって読めなかった**。
       * 1組を2行にして、組と組のあいだを空ける（吹き出し側も `pre-wrap` にした）。
       */
      onSend(qs.map((x, i) => `${x.body}\n→ ${next[i]}`).join('\n\n'));
      return;
    }
    setAt(missing);
  };

  return (
    <div style={WRAP}>
      <div style={HEAD}>
        <span style={{ flex: 1 }}>{done ? '答えました' : q.why}</span>
        {qs.length > 1 && (
          <span style={{ color: T5, fontSize: 11 }} className="tnum">
            {done ? qs.length : at + 1} / {qs.length}
          </span>
        )}
      </div>
      <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 答え終わったもの。**押せば戻って選び直せる**（送る前なら何度でも） */}
        {qs.map((x, i) => ((!done && i === at) || answers[i] === undefined ? null : (
          <button key={`done-${i}`} disabled={!on} onClick={() => setAt(i)} className={on ? 'row' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
              padding: '6px 4px', borderRadius: 7, cursor: on ? 'pointer' : 'default',
            }}>
            <Icon name="check" color={GREEN_T} size={12} width={2.4} />
            <span style={{ color: T5, fontSize: 11.5, flexShrink: 0 }}>{x.body}</span>
            <span style={{ color: T2, fontSize: 12, minWidth: 0 }}>{answers[i]}</span>
          </button>
        )))}

        {!done && <span style={{ color: T1, fontSize: 14, paddingBottom: 2 }}>{q.body}</span>}
        {!done && q.options.map((o, i) => {
          const chosen = answers[at] === o.label;
          return (
            <button key={o.label} disabled={!on} onClick={() => pick(o.label)} className={on ? 'card' : undefined}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
                padding: '10px 13px', borderRadius: 9,
                background: chosen ? 'rgba(30,142,62,0.10)' : SUNK,
                border: `1px solid ${chosen ? GREEN : EDGE}`,
                opacity: !live && !chosen ? 0.5 : 1,
                cursor: on ? 'pointer' : 'default',
              }}>
              <span style={{ color: T5, fontSize: 11, lineHeight: '18px', width: 12, flexShrink: 0 }} className="tnum">{i + 1}</span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: T1, fontSize: 13.5 }}>{o.label}</span>
                  {o.recommended && <span style={{ color: GREEN_T, fontSize: 10.5 }}>おすすめ</span>}
                </span>
                {o.description && <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>{o.description}</span>}
              </span>
              {chosen && <><div style={{ flex: 1 }} /><Icon name="check" color={GREEN_T} size={12} width={2.4} /></>}
            </button>
          );
        })}
        {/**
          * **自由に書く道を、選択肢と同じ場所に置く**（→ CLAUDE.md「最後の行は自由入力」）。
          * 前は「下の入力欄に書いてください」と書いてあるだけで、
          * **答えの続きなのに置き場所が離れていた**。
          */}
        {on && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderRadius: 9,
            background: SUNK, border: `1px solid ${EDGE}`,
          }}>
            <Icon name="pencil" color={T5} size={13} />
            <input value={free} onChange={(e) => setFree(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && free.trim() && !e.nativeEvent.isComposing) {
                  e.preventDefault(); pick(free.trim());
                }
              }}
              placeholder="自分の言葉で書く" style={{
                flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                color: T1, fontSize: 13.5,
              }} />
            {free.trim() && (
              <button onClick={() => pick(free.trim())} className="btn" style={{
                display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                borderRadius: 6, color: T3, fontSize: 11.5, flexShrink: 0,
              }}>これで</button>
            )}
          </div>
        )}
        {on && qs.length > 1 && (
          <span style={{ color: T5, fontSize: 11.5 }} className="tnum">
            {qs.length}問ぜんぶ答えると、まとめて送ります
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════ 終わりを聞き返された ══════════════ */

/**
 * 「何ができたら終わりですか」と聞き返されたときの姿。
 *
 * **赤い1行で出さない。** 赤は止まっている印で、これは質問です。
 * しかも道具（`ask_end`）は**選択肢まで持っている**のに、前は本文だけを
 * エラーの色で出して捨てていた — 社長は入力欄に書き直すしかなかった。
 * 押すだけで答えられる形にして、選んだ答えをそのまま終わりの一文にする。
 */
function EndAsk({ body, options, busy, onPick }: {
  body: string; options: { label: string; description: string }[];
  busy: boolean; onPick: (label: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
      <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{body}</span>
      {options.map((o, i) => (
        <button key={o.label} disabled={busy} onClick={() => onPick(o.label)}
          className={busy ? undefined : 'card'} style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
            padding: '10px 13px', borderRadius: 9, background: SUNK, border: `1px solid ${EDGE}`,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>
          <span style={{ color: T5, fontSize: 11, lineHeight: '18px', width: 12, flexShrink: 0 }} className="tnum">{i + 1}</span>
          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: T1, fontSize: 13.5 }}>{o.label}</span>
            {o.description && <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>{o.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ══════════════ 候補をくらべる ══════════════ */

/**
 * **軸を入れ替えた**（2026-08-26。社長の「実際に需要があって個人1人でもできるような仕事」）。
 * 前は 速さ / 安さ / 得意との相性 で、**需要も「1人で回せるか」も入っていなかった**。
 * 「初期費用の低さ」は落とした — **お金がかかることは「1人で回せる」に吸収される**。
 */
const AXES: [string, 'demand' | 'solo' | 'speed'][] = [
  ['欲しい人がいる', 'demand'], ['1人で回せる', 'solo'], ['最初の1件まで', 'speed'],
];

/**
 * 目盛り。**1本の棒だと、どこまで塗られているかが読めない**（3つ並ぶとなおさら）。
 * 5つの刻みにすると「5つのうち3つ」と**数えて**読める。色は使わない —
 * 明るさだけで言う（色は意味にだけ、が決めごと）。
 */
function Ticks({ value }: { value: number }) {
  const full = Math.max(0, Math.min(5, Math.round((value / 100) * 5)));
  return (
    <span style={{ display: 'inline-flex', gap: 3 }} aria-label={`5段階で ${full}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{
          width: 9, height: 3, borderRadius: 1,
          background: i < full ? '#B9B9B9' : '#2A2A2A',
        }} />
      ))}
    </span>
  );
}

/**
 * 作っている最中の姿。**「押したのに何も起きない」を作らない** —
 * 計画を引くのは統括AIのいちばん重い往復で、10〜30秒かかる。
 * かかることは正直に書き、動いていることは動きで見せる。
 */
function Building({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
      <Orb color={EXEC} size={20} seed={7} />
      <span className="sh" style={{ fontSize: 12.5 }}>「{name}」の計画を引いています</span>
      <div style={{ flex: 1 }} />
      <span style={{ color: T5, fontSize: 11 }}>30秒ほどかかります</span>
    </div>
  );
}

function CandidatesCard({ id, live, threadId, onSend }: {
  id: string; live: boolean; threadId: string; onSend: (text: string) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState('');
  const [fail, setFail] = useState('');
  /** 「何ができたら終わりですか」と聞き返された（選択肢つき） */
  const [end, setEnd] = useState<{ candId: string; body: string; options: { label: string; description: string }[] } | null>(null);
  /** 押した1件（**まだ作っていない**）。作るのは確認を押したとき */
  const [sure, setSure] = useState('');
  const reload = () => { discoveryGet(id).then(setD); };
  useEffect(reload, [id]);
  if (!d?.candidates.length) return null;

  const adopt = async (candId: string, ending?: string) => {
    setBusy(candId); setFail('');
    const r = await adoptCandidate(d.id, candId, threadId, ending);
    if (r.ok) { router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy('');
    if (r.need === 'end') { setEnd({ candId, body: r.body, options: r.options }); return; }
    setFail(r.message);
  };
  const taken = d.candidates.find((c) => c.adoptedWorkId);

  return (
    <div style={WRAP}>
      <div style={HEAD}>
        <span style={{ flex: 1 }}>条件に合う道</span>
        <span style={{ display: 'flex', gap: 12 }}>
          {conditionChips(d.conditions).slice(0, 3).map(([k, v]) => (
            <span key={k} style={{ color: T5, fontSize: 11 }}>{k} <span style={{ color: T4 }}>{v}</span></span>
          ))}
        </span>
      </div>
      {/**
        * **3つとも選べる。** 前は推している1つだけが色と面を持っていて、
        * 残りの2つは「読むだけのもの」に見えていた（実際は同じだけ選べる）。
        * いまは**行そのものが選ぶもの** — 指が乗れば光り、押せばその道に決まる。
        * 推している1つの印は**左の緑帯とタグだけ**にして、押しやすさは3つとも同じにする。
        */}
      <div style={{ padding: '6px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.candidates.map((c) => {
          const asking = sure === c.id;
          const working = busy === c.id;
          const pick = c.adoptedWorkId
            ? () => router.push(`/work/${c.adoptedWorkId}` as Route)
            : live && !taken && !busy && !asking ? () => { setSure(c.id); setFail(''); } : undefined;
          return (
            <div key={c.id} {...(pick ? pressable(pick) : {})} className={pick ? 'card' : undefined} style={{
              position: 'relative', display: 'flex', flexDirection: 'column', gap: 9,
              padding: '13px 14px', borderRadius: 10,
              /**
               * **面の色で推さない。** 前は推している1件だけ緑の面と帯を持っていて、
               * 3つとも選べるのに**1つだけボタンのように**見えていた。
               * 推している印は「おすすめ」の**文字だけ**にする（色は意味にだけ使う）。
               */
              border: `1px solid ${asking ? EDGE : SEAM}`,
              background: SUNK,
              cursor: pick ? 'pointer' : 'default',
              opacity: busy && !working ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ color: T1, fontSize: 14 }}>{c.name}</span>
                {c.recommended && <span style={{ color: GREEN_T, fontSize: 10.5 }}>おすすめ</span>}
                <div style={{ flex: 1 }} />
                <span style={{ color: pick ? T3 : T5, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {c.adoptedWorkId ? 'Work を見る' : pick ? 'この案にする' : ''}
                </span>
                {pick && <Icon name="chev" color={T5} size={12} />}
              </div>
              <span style={{ color: T2, fontSize: 12.5, lineHeight: '20px' }}>{c.summary}</span>
              {/**
                * **選ぶ前に読めるものを増やした**（2026-08-26）。
                * 「誰が買うのか」「最初の1人をどこで見つけるか」が書けない候補は、
                * そもそも始められない。**ラベルは2〜4文字で左に揃える**（表と同じ読み方）。
                */}
              {([['完了', c.ending], ['誰が', c.who], ['最初の1人', c.firstOne]] as const)
                .filter(([, v]) => !!v).map(([label, v]) => (
                <span key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ color: T5, fontSize: 10.5, flexShrink: 0, width: 48 }}>{label}</span>
                  <span style={{ color: T3, fontSize: 12, lineHeight: '18px' }}>{v}</span>
                </span>
              ))}
              <div style={{ display: 'flex', gap: 16 }}>
                {AXES.map(([label, key]) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: T5, fontSize: 10.5 }}>{label}</span>
                    <Ticks value={c.fit[key]} />
                  </span>
                ))}
              </div>
              {/**
                * **確かめていないことを、候補の顔に出す**（2026-08-26）。
                * 統括AIは Web を見ていないので、需要は記憶から言っているだけ。
                * **黙って自信ありげに出すほうが危ない** — AI社員の憲法の「未確認」と同じ作法。
                * 週に何時間要るかも一緒に出す（社長はひとりで、時間がいちばん足りない）。
                */}
              {(c.unsure || !!c.hoursPerWeek) && (
                <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>
                  {c.hoursPerWeek ? `週およそ ${c.hoursPerWeek}時間` : ''}
                  {c.hoursPerWeek && c.unsure ? ' · ' : ''}
                  {c.unsure ? `まだ確かめていない — ${c.unsure}` : ''}
                </span>
              )}
              {/* **選ばなかった理由も残す。** なぜその道を選んだかは、選ばなかった道と並べて意味になる */}
              {!c.recommended && c.notChosenWhy && (
                <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>推さない理由 — {c.notChosenWhy}</span>
              )}

              {/**
                * **作る前に、一度だけ聞く。** Work は会社の仕事の入れ物で、
                * 押した瞬間にできてしまうと「まだ選んでいただけ」との区別が無い。
                */}
              {asking && !working && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 3 }}>
                  <span style={{ color: T2, fontSize: 12.5 }}>この案で Work を作りますか</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setSure('')} className="btn" style={{
                    display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px',
                    borderRadius: 8, color: T4, fontSize: 12,
                  }}>やめる</button>
                  <button onClick={() => adopt(c.id)} className="solid" style={{
                    display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 15px',
                    borderRadius: 8, background: BLUE, color: '#fff', fontSize: 12.5,
                  }}>作る</button>
                </div>
              )}
              {working && <Building name={c.name} />}
            </div>
          );
        })}
        {end && (
          <EndAsk body={end.body} options={end.options} busy={!!busy}
            onPick={(label) => adopt(end.candId, label)} />
        )}
        {/**
          * **3つとも違うときの道。** 前はここが行き止まりだった —
          * 押せるのは「この案にする」だけで、どれも違う社長は自分で入力欄に
          * 書き出すしかなかった（何を書けばいいのかも分からない）。
          * 押すと**会話に戻る**ので、統括AIが「何が違うか」を1問だけ聞いてから出し直す。
          */}
        {live && !taken && !busy && !end && (
          <button className="lnk" onClick={() => onSend('どれもピンと来ません。何が違うか話して、出し直したいです')}
            style={{ alignSelf: 'flex-start', color: T4, fontSize: 12, padding: '6px 0 0' }}>
            どれも違う — 条件から見直す
          </button>
        )}
        {fail && <span style={{ display: 'block', color: RED_T, fontSize: 12, paddingTop: 8 }}>{fail}</span>}
      </div>
    </div>
  );
}

/* ══════════════ 診断 ══════════════ */

const WEIGHT: Record<string, string> = { '重い': T2, '中くらい': T4, '軽い': MUTE };

function DiagnosisCard({ id, live, threadId }: { id: string; live: boolean; threadId: string }) {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(-1);
  const [fail, setFail] = useState('');
  const [end, setEnd] = useState<{ at: number; body: string; options: { label: string; description: string }[] } | null>(null);
  useEffect(() => { profileGet(id).then(setP); }, [id]);
  const dg = p?.diagnosis;
  if (!dg?.findings.length) return null;

  const start = async (i: number, ending?: string) => {
    setBusy(i); setFail('');
    const r = await findingToWork(id, i, threadId, ending);
    if (r.ok) { router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy(-1);
    if (r.need === 'end') { setEnd({ at: i, body: r.body, options: r.options }); return; }
    setFail(r.message);
  };
  const taken = dg.findings.some((f) => f.workId);

  return (
    <div style={WRAP}>
      <div style={HEAD}><span style={{ flex: 1 }}>{p?.name} の診断</span></div>
      {dg.facts.length > 0 && (
        <div style={{ display: 'flex', gap: 20, padding: '10px 16px 4px' }}>
          {dg.facts.map((f, i) => (
            <div key={f.label} style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
              borderRight: i === dg.facts.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <span style={{ color: T4, fontSize: 11 }}>{f.label}</span>
              <span style={{ fontSize: 19, lineHeight: '25px', color: f.missing ? T4 : T1 }} className="tnum">{f.value}</span>
              {f.note && <span style={{ color: T5, fontSize: 10.5 }}>{f.note}</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '8px 16px 14px' }}>
        {dg.findings.map((f, i) => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
            borderBottom: i === dg.findings.length - 1 ? undefined : `1px solid ${HAIR}`,
          }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: T1, fontSize: 13.5 }}>{f.title}</span>
              <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>{f.why}</span>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ color: WEIGHT[f.severity] ?? MUTE, fontSize: 11.5, flexShrink: 0 }}>{f.severity}</span>
            {f.workId ? (
              <button onClick={() => router.push(`/work/${f.workId}` as Route)} className="btn" style={{
                height: 28, padding: '0 12px', borderRadius: 7, border: `1px solid ${EDGE}`, color: T3, fontSize: 12, whiteSpace: 'nowrap',
              }}>Work を見る</button>
            ) : live && !taken ? (
              <button onClick={() => start(i)} disabled={busy >= 0} className="btn" style={{
                height: 28, padding: '0 12px', borderRadius: 7, border: `1px solid ${EDGE}`, color: T2, fontSize: 12, whiteSpace: 'nowrap',
                opacity: busy >= 0 && busy !== i ? 0.5 : 1,
              }}>Work にする</button>
            ) : null}
          </div>
        ))}
        {/**
          * **残りが行き止まりにならないようにする**（2026-08-26）。
          * 1つを Work にすると、ほかの行からは黙ってボタンが消えていた
          * （1チャット = 1 Work なので、消えるのは正しい）。
          * **なぜ消えたのかと、次にどこへ行けばいいか**を1行だけ言う。
          */}
        {taken && dg.findings.some((f) => !f.workId) && (
          <span style={{ display: 'block', color: T5, fontSize: 11.5, paddingTop: 10 }}>
            1つの会話で作る Work は1つまで。ほかも進めるなら{' '}
            <Link href="/chat/new" className="lnk" style={{ color: T3 }}>新しいチャット ›</Link>
          </span>
        )}
        {busy >= 0 && dg.findings[busy] && <Building name={dg.findings[busy].work.title} />}
        {end && (
          <EndAsk body={end.body} options={end.options} busy={busy >= 0}
            onPick={(label) => start(end.at, label)} />
        )}
        {fail && <span style={{ display: 'block', color: RED_T, fontSize: 12, paddingTop: 8 }}>{fail}</span>}
      </div>
    </div>
  );
}

/* ══════════════ Work を作る確認 ══════════════ */

/**
 * **Work は確認してから作る。** 会話しただけで Work が増えない、が守りたいこと。
 * 断ってもいい — そのまま会話が続く（断ったことは会話に残る）。
 */
function WorkCard({ card, live, threadId, workId }:
  { card: Extract<ChatCard, { kind: 'work' }>; live: boolean; threadId: string;
    workId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  /**
   * **もう作ってあるなら「作る」と書かない。**
   * 前は作ったことがこの部品の state にしか無く、開き直すと
   * 「この Work を作る」に戻っていた（押しても二度は作られないが、画面が嘘をつく）。
   * いまはスレッドが持っている Work を親から受け取る（→ CLAUDE.md「カードは id しか持たない」）。
   */
  const [made, setMade] = useState<string | null>(workId ?? null);

  const [end, setEnd] = useState<{ body: string; options: { label: string; description: string }[] } | null>(null);

  const make = async (ending?: string) => {
    setBusy(true); setFail('');
    const r = await chatMakeWork(threadId, ending ? { ...card, goal: ending } : card);
    if (r.ok) { setMade(r.id); router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy(false);
    if (r.need === 'end') { setEnd({ body: r.body, options: r.options }); return; }
    setFail(r.message);
  };

  return (
    <div style={{ ...WRAP, borderColor: live ? EDGE : SEAM }}>
      <div style={HEAD}><span style={{ flex: 1 }}>Work にできます</span></div>
      <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ color: T1, fontSize: 15 }}>{card.title}</span>
        <span style={{ color: T2, fontSize: 12.5, lineHeight: '20px' }}>{card.goal}</span>
        {/**
          * **見込みは、計画ができるまでの仮の数**（2026-08-26）。
          * Work を作ると統括AIが計画を引いて週数を決め直すので、
          * ここに残していると**同じ Work が会話では「およそ10週」、計画では「およそ1週」**
          * になる（ロゴの例で実際そうなった）。**作ったあとは出さない** — 計画が本物。
          */}
        <span style={{ color: T5, fontSize: 11.5 }}>
          {!made && card.weeks ? `およそ${card.weeks}週 · ` : ''}{card.why}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
          {made ? (
            <button onClick={() => router.push(`/work/${made}/plan` as Route)} className="btn" style={{
              height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid ${EDGE}`, color: T2, fontSize: 12.5,
            }}>計画を見る</button>
          ) : live ? (
            <>
              <button onClick={() => make()} disabled={busy} className="solid" style={{
                height: 32, padding: '0 16px', borderRadius: 8, background: BLUE, color: '#fff',
                fontSize: 12.5, opacity: busy ? 0.6 : 1,
              }}>この Work を作る</button>
              {!busy && <span style={{ color: T5, fontSize: 11.5 }}>作らずに、続けて相談しても構いません</span>}
            </>
          ) : (
            <span style={{ color: T5, fontSize: 11.5 }}>この提案は流れました</span>
          )}
        </div>
        {busy && <Building name={card.title} />}
        {end && (
          <EndAsk body={end.body} options={end.options} busy={busy}
            onPick={(label) => make(label)} />
        )}
        {fail && <span style={{ color: RED_T, fontSize: 12 }}>{fail}</span>}
      </div>
    </div>
  );
}
