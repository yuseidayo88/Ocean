'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Icon } from '@/components/ui/Icon';
import { conditionChips } from '@/lib/live/conditions';
import { adoptCandidate, discoveryGet, findingToWork, profileGet } from '@/app/actions/entry';
import { chatMakeWork } from '@/app/actions/chat';
import type { ChatCard, Discovery, Profile } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { BLUE, EDGE, GREEN, GREEN_T, HAIR, MUTE, RED_T, SEAM, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';

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

export function Card({ card, live, threadId, onSend }:
  { card: ChatCard; live: boolean; threadId: string; onSend: (text: string) => void }) {
  if (card.kind === 'ask') return <AskCard card={card} live={live} onSend={onSend} />;
  if (card.kind === 'candidates') return <CandidatesCard id={card.sessionId} live={live} threadId={threadId} />;
  if (card.kind === 'diagnosis') return <DiagnosisCard id={card.profileId} live={live} threadId={threadId} />;
  return <WorkCard card={card} live={live} threadId={threadId} />;
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
        <span style={{ flex: 1 }}>{q.why}</span>
        {qs.length > 1 && (
          <span style={{ color: T5, fontSize: 11 }} className="tnum">{at + 1} / {qs.length}</span>
        )}
      </div>
      <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 答え終わったもの。**押せば戻って選び直せる**（送る前なら何度でも） */}
        {qs.map((x, i) => (i === at || answers[i] === undefined ? null : (
          <button key={`done-${i}`} disabled={!on} onClick={() => setAt(i)} className={on ? 'row' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
              padding: '6px 4px', borderRadius: 7, cursor: on ? 'pointer' : 'default',
            }}>
            <Icon name="check" color={GREEN_T} size={12} width={2.4} />
            <span style={{ color: T5, fontSize: 11.5, flexShrink: 0 }}>{x.body}</span>
            <span style={{ color: T2, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {answers[i]}
            </span>
          </button>
        )))}

        <span style={{ color: T1, fontSize: 14, paddingBottom: 2 }}>{q.body}</span>
        {q.options.map((o, i) => {
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

const AXES: [string, 'speed' | 'cost' | 'strength'][] = [
  ['立ち上がりの速さ', 'speed'], ['初期費用の低さ', 'cost'], ['強みとの相性', 'strength'],
];

function CandidatesCard({ id, live, threadId }: { id: string; live: boolean; threadId: string }) {
  const router = useRouter();
  const [d, setD] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState('');
  const [fail, setFail] = useState('');
  /** 「何ができたら終わりですか」と聞き返された（選択肢つき） */
  const [end, setEnd] = useState<{ candId: string; body: string; options: { label: string; description: string }[] } | null>(null);
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
          const pick = c.adoptedWorkId
            ? () => router.push(`/work/${c.adoptedWorkId}` as Route)
            : live && !taken && !busy ? () => adopt(c.id) : undefined;
          return (
            <div key={c.id} {...(pick ? pressable(pick) : {})} className={pick ? 'card' : undefined} style={{
              position: 'relative', display: 'flex', flexDirection: 'column', gap: 9,
              padding: '13px 14px 13px 16px', borderRadius: 10,
              border: `1px solid ${c.recommended ? 'rgba(30,142,62,.34)' : SEAM}`,
              background: c.recommended ? 'rgba(30,142,62,0.06)' : SUNK,
              cursor: pick ? 'pointer' : 'default',
              opacity: busy && busy !== c.id ? 0.5 : 1,
            }}>
              {c.recommended && <span style={{
                position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
                borderRadius: '0 2px 2px 0', background: GREEN,
              }} />}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ color: T1, fontSize: 14 }}>{c.name}</span>
                {c.recommended && <span style={{ color: GREEN_T, fontSize: 10.5 }}>おすすめ</span>}
                <div style={{ flex: 1 }} />
                <span style={{ color: pick ? T3 : T5, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {c.adoptedWorkId ? 'Work を見る'
                    : busy === c.id ? '計画を引いています…'
                    : pick ? 'この案にする' : ''}
                </span>
                {pick && <Icon name="chev" color={T5} size={12} />}
              </div>
              <span style={{ color: T2, fontSize: 12.5, lineHeight: '20px' }}>{c.summary}</span>
              <div style={{ display: 'flex', gap: 16 }}>
                {AXES.map(([label, key]) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: T5, fontSize: 10.5 }}>{label}</span>
                    {/* **3つとも読める濃さにする。** 推しだけ緑、あとは灰（見えない灰にしない） */}
                    <span style={{ width: 46, height: 3, borderRadius: 2, background: '#242424', overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${c.fit[key]}%`, height: '100%',
                                     background: c.recommended ? GREEN : '#6A6A6A' }} />
                    </span>
                  </span>
                ))}
              </div>
              {/* **選ばなかった理由も残す。** なぜその道を選んだかは、選ばなかった道と並べて意味になる */}
              {!c.recommended && c.notChosenWhy && (
                <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>推さない理由 — {c.notChosenWhy}</span>
              )}
            </div>
          );
        })}
        {end && (
          <EndAsk body={end.body} options={end.options} busy={!!busy}
            onPick={(label) => adopt(end.candId, label)} />
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
              }}>{busy === i ? '引いています…' : 'Work にする'}</button>
            ) : null}
          </div>
        ))}
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
function WorkCard({ card, live, threadId }:
  { card: Extract<ChatCard, { kind: 'work' }>; live: boolean; threadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [made, setMade] = useState<string | null>(null);

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
        <span style={{ color: T5, fontSize: 11.5 }}>
          {card.weeks ? `およそ${card.weeks}週 · ` : ''}{card.why}
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
              }}>{busy ? '計画を引いています…' : 'この Work を作る'}</button>
              <span style={{ color: T5, fontSize: 11.5 }}>作らずに、続けて相談しても構いません</span>
            </>
          ) : (
            <span style={{ color: T5, fontSize: 11.5 }}>この提案は流れました</span>
          )}
        </div>
        {end && (
          <EndAsk body={end.body} options={end.options} busy={busy}
            onPick={(label) => make(label)} />
        )}
        {fail && <span style={{ color: RED_T, fontSize: 12 }}>{fail}</span>}
      </div>
    </div>
  );
}
