'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';

import { useOpen } from '@/lib/use-open';
import { notFound, useParams } from 'next/navigation';
import { Ask, Centre, Chips, Composer, ExecStatus, Pane, TopBar } from '@/components/shell/Chrome';
import { AMBER, AMBER_T, BLUE, COMPOSER_H, DIM, EDGE, GREEN_T, HAIR, RED_T, SEAM, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR } from '@/lib/view/model';
import { fromDraft, type PlanView } from '@/lib/exec/view';
import { answerQuestion, approveWork, getDraft, reviseWork } from '@/app/actions/work';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 計画の承認（参考: AWS Amplify / Workable の Review）。
 * **計画は表ではなく図。** 10週の軸に4フェーズを帯で置き、
 * 「あなたに聞くこと」は ◆ として軸の上に立てる。
 * 右ペインは「この計画の根拠」。中央のロードマップを二度言わない。
 */

/** 時間の使い方の帯。**色は意味にだけ使う**ので、ここは明るさだけで分ける */
const GREYS = [`${DIM}`, '#333333', '#2C2C2C', '#242424'];

/**
 * 中身は1つの形（`PlanView`）から描く。
 * ダミーの Work でも、統括AIが立てたばかりの計画でも、**同じ画面**が出る。
 * 似た画面を2つ作らないため。
 */
export default function PlanPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  // 右は閉じた状態から始まる。トップバーの板アイコンで出し入れする
  const [openId, setOpen] = useOpen();
  const pane = openId === 'why';
  const setPane = (v: boolean) => setOpen(v ? 'why' : null);
  const [v, setV] = useState<PlanView | null>(null);
  const [gone, setGone] = useState(false);
  /** 押しているあいだ。**二度押しさせない**（承認は1回きり） */
  const [busy, setBusy] = useState<'' | 'approve' | 'revise' | 'answer'>('');
  /** 「直したい」を押した回数。増えるたびに入力欄へカーソルが移る */
  const [focus, setFocus] = useState(0);
  const [err, setErr] = useState('');
  /**
   * いま見ている質問。`-1` は「まだ選んでいない」＝ **答え終わっていない最初のもの**を出す。
   * ✕ を押したら `asks` を丸ごと引っ込める（また出すのは読み込み直したとき）。
   */
  const [at, setAt] = useState(-1);
  const [hideAsk, setHideAsk] = useState(false);
  /** 入力欄の帯の実寸（質問の板が乗ると高くなる）。行動の行はこのぶん逃げる */
  const [bandH, setBandH] = useState(COMPOSER_H);

  useEffect(() => {
    let live = true;
    getDraft(id).then((d) => { if (!live) return; if (d) setV(fromDraft(d)); else setGone(true); });
    return () => { live = false; };
  }, [id]);

  /**
   * **承認して始める。** ここで初めて状態が本当に変わる。
   * ダミーの Work は書き込み先が無いので、正直にそう返す。
   */
  const approve = async () => {
    setBusy('approve'); setErr('');
    const r = await approveWork(id);
    if (!r.ok) { setBusy(''); setErr(r.message); return; }
    router.push(`/work/${id}` as Route);
  };

  /** **計画を直す。** 書いたものを統括AIに渡して引き直す */
  const revise = async (text: string) => {
    setBusy('revise'); setErr('');
    const r = await reviseWork(id, text);
    if (!r.ok) { setBusy(''); setErr(r.message); return; }
    const d = await getDraft(id);
    if (d) setV(fromDraft(d));
    setBusy('');
  };

  /**
   * **答えを保存する。** 前は選んでも板が緑になるだけで、ブラウザから出ていなかった。
   * 空文字は「選び直す」。
   */
  const reply = async (i: number, text: string) => {
    setBusy('answer'); setErr('');
    await answerQuestion(id, i, text);
    const d = await getDraft(id);
    if (d) setV(fromDraft(d));
    setBusy('');
    // 答えたら次の未回答へ。最後まで答えたら既定（＝出さない）に戻す
    if (!text) { setAt(i); return; }
    const rest = d ? fromDraft(d).asks : [];
    const next = rest.findIndex((a, k) => k > i && !a.answer);
    setAt(next >= 0 ? next : -1);
  };

  if (gone) notFound();
  if (!v) return <Centre><TopBar title="計画案" /><Waiting /></Centre>;

  const PW = v.weeks || 1;
  const ROWS = v.rows;
  // 根拠のペインが読む値は先に取る（JSX の中では narrowing が効かない）
  // **1件も無ければ節ごと出さない**（空の見出しを置かない）
  const FACTS = v.facts?.length ? v.facts : undefined;
  /**
   * いま出す質問。既定は**答え終わっていない最初のもの**
   * （‹ › で行き来できるので、答えたものにも戻れる）。全部答えたら出さない。
   */
  const firstOpen = v.asks.findIndex((a) => !a.answer);
  const askAt = at >= 0 ? Math.min(at, v.asks.length - 1) : firstOpen;
  const ASK = !hideAsk && askAt >= 0 ? v.asks[askAt] : null;
  /**
   * 板が閉じたら（全部答えた / スキップで引っ込めた）、答えは**緑のチップで残す**。
   * 答えたのに画面のどこにも見えない、をつくらない（→ CLAUDE.md「答え終わった条件は
   * 緑のチェック＋項目名つきのチップで見せる」）。承認済みの画面でも出す。
   */
  const DONE = !ASK
    ? v.asks.filter((a) => a.answer).map((a) => [a.body, a.answer!] as [string, string])
    : [];
  // 作るものは2列に割る
  const half = Math.ceil(v.makes.length / 2);
  const MAKES = [v.makes.slice(0, half), v.makes.slice(half)];

  return (
    <>
      <Centre>
        <TopBar crumb={v.title} title="計画案" onPanel={() => setPane(true)} panelOn={pane} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 26px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {/* **行は行のまま。** ゴールと「終わり」は別の行なので、つなげて出さない */}
            <span style={{
              maxWidth: '78%', padding: '9px 16px', borderRadius: 18,
              background: '#24354A', color: '#DCE7F5', whiteSpace: 'pre-wrap',
            }}>
              {v.goal}
            </span>
          </div>
          {/* **考えていないなら、そう出す。** 決め打ちの計画を本物のように見せない */}
          {!v.real && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 9,
              background: 'rgba(227,116,0,0.07)', border: '1px solid rgba(227,116,0,0.3)',
            }}>
              <Icon name="bolt" color={AMBER_T} size={14} />
              <span style={{ color: AMBER_T, fontSize: 12.5 }}>
                これは仮の計画です。モデルの鍵がまだ入っていないので、統括AIは考えていません
              </span>
            </div>
          )}
          <span style={{ fontSize: 15, lineHeight: '25px' }}>{v.lead}</span>

          {/* 計画 = 図 */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 4 }}>
              <span style={{ color: T3 }}>計画</span>
              <div style={{ flex: 1 }} />
              {/* **回数は先に決めない**（2026-08-25）。統括AIが「社長でないと決められない」と
                  判断したところにだけ ◆ が立つ。**◆ が無ければ会社が自分で進む** —
                  そう書いておかないと、止まらないことが不意打ちになる */}
              <span style={{ color: T5, fontSize: 12 }}>
                およそ {v.weeks}週 · {v.rows.filter((r) => r.dec).length > 0
                  ? `あなたが決めるのは ◆ の${v.rows.filter((r) => r.dec).length}か所。ほかは会社が進めます`
                  : 'あなたが決めるところはありません。会社が最後まで進めます'}
              </span>
            </div>
            <div style={{ position: 'absolute', left: 220, right: 120, top: 22, bottom: 0, pointerEvents: 'none' }}>
              {ticks(PW).slice(0, -1).map((wk) => (
                <div key={wk} style={{ position: 'absolute', left: `${(wk / PW) * 100}%`, top: 0, bottom: 0, width: 1, background: '#131313' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0 6px' }}>
              <div style={{ width: 208, flexShrink: 0 }} />
              <div style={{ flex: 1, position: 'relative', height: 14 }}>
                {ticks(PW).map((wk) => (
                  <span key={wk} style={{
                    position: 'absolute', left: `${(wk / PW) * 100}%`,
                    transform: wk === PW ? 'translateX(-100%)' : 'translateX(-50%)',
                    color: T5, fontSize: 11, whiteSpace: 'nowrap',
                  }}>{wk}週</span>
                ))}
              </div>
              <span style={{ width: 80, flexShrink: 0 }} /><span style={{ width: 28, flexShrink: 0 }} />
            </div>
            {ROWS.map((r, i) => (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: i === ROWS.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <div style={{ width: 208, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ color: r.soft ? T5 : T1 }}>{r.name}</span>
                  <span style={{ color: T5, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.goal}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 26 }}>
                  <div style={{
                    position: 'absolute', left: `${(r.w0 / PW) * 100}%`, width: `${((r.w1 - r.w0) / PW) * 100}%`,
                    top: 0, height: 26, borderRadius: 5,
                    background: r.soft ? undefined : EDGE,
                    border: r.soft ? `1px dashed ${EDGE}` : undefined, boxSizing: 'border-box',
                  }} />
                  {r.dec && (
                    <>
                      <div style={{
                        position: 'absolute', left: `${(r.w1 / PW) * 100}%`, top: 13, width: 10, height: 10,
                        marginLeft: -5, marginTop: -5, background: AMBER, transform: 'rotate(45deg)',
                        borderRadius: 1.8, boxShadow: '0 0 0 3px rgba(227,116,0,0.18)',
                      }} />
                      <span style={{
                        position: 'absolute', left: `calc(${(r.w1 / PW) * 100}% + 13px)`, top: 5,
                        color: AMBER_T, fontSize: 11, whiteSpace: 'nowrap',
                      }}>{r.dec}</span>
                    </>
                  )}
                </div>
                <span style={{ width: 80, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12, whiteSpace: 'nowrap' }}>{r.who}</span>
                <span style={{ width: 28, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">{r.weeks}</span>
              </div>
            ))}
          </div>

          {/* 承認すると起きること */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 10 }}>
            <span style={{ color: T3, paddingBottom: 4 }}>承認すると起きること</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: `1px solid ${HAIR}` }}>
              <span style={{ width: 176, flexShrink: 0, color: T4, fontSize: 13 }}>
                {v.hires.length ? `採用する AI社員 ${v.hires.length}体` : '採用はありません'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {v.hires.map((h, i) => (
                  <span key={h.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Orb color={AGENT_COLOR[h.color]} size={26} seed={13 + i * 5} />
                    <span style={{ color: T2, fontSize: 13 }}>{h.name}</span>
                  </span>
                ))}
                {!v.hires.length && <span style={{ color: T5, fontSize: 13 }}>いまの社員で足ります</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
              {/* **誰も言っていない数字を出さない。** 直近のフェーズに引いたタスクの数を出す */}
              <span style={{ width: 176, flexShrink: 0, color: T4, fontSize: 13 }}>すぐ動きだすタスク</span>
              <span style={{ color: T2, fontSize: 13 }} className="tnum">{v.firstTasks}件</span>
            </div>
          </div>

          {/* 作るもの */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 4 }}>
              <span style={{ color: T3 }}>作るもの</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>{v.makes.length}件</span>
            </div>
            <div style={{ display: 'flex', gap: 40 }}>
              {MAKES.map((col, ci) => (
                <div key={ci} style={{ flex: 1, minWidth: 0 }}>
                  {col.map(([nm, ph], i) => (
                    <div key={nm} style={{
                      display: 'flex', alignItems: 'center', gap: 12, height: 29,
                      borderBottom: i === col.length - 1 ? undefined : `1px solid ${HAIR}`,
                    }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{nm}</span>
                      <div style={{ flex: 1 }} />
                      <span style={{ color: T5, fontSize: 12, whiteSpace: 'nowrap' }}>{ph}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/**
          * **行動の行は中身と一緒にスクロールさせない。**
          * 中身が短いとスクロールが起きないので、`padding-bottom` を積んでも行は動かず、
          * 浮いている入力欄の下に潜って**物理的に押せなくなる**（実際そうなっていた）。
          * 下に貼り付けて `COMPOSER_H` ぶん逃がす — 通知の行動の行と同じ作法。
          */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, height: 56,
          // **質問の板が出ているぶんも逃がす。** `COMPOSER_H` は板が無いときの高さ
          padding: '0 26px', marginBottom: Math.max(COMPOSER_H, bandH - 16),
          borderTop: `1px solid ${SEAM}`,
        }}>
          {v.approved ? (
            /* もう承認されている。**押せる顔をさせない** */
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: GREEN_T, fontSize: 13 }}>
                <Icon name="check" color={GREEN_T} size={14} width={2} />承認済
              </span>
              <Link href={`/work/${id}` as Route} className="btn" style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${EDGE}`, color: T3 }}>
                Work を見る
              </Link>
            </>
          ) : (
            <>
              <button onClick={approve} disabled={!!busy} className={busy ? undefined : 'solid'} style={{
                display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px', borderRadius: 8,
                background: busy ? `${SEAM}` : BLUE, color: busy ? T5 : '#fff',
                cursor: busy ? 'default' : 'pointer',
              }}>
                {busy === 'approve' ? '始めています…' : '承認して始める'}
              </button>
              {/* **操作説明を出さない。** 書く場所は1つしか無いので、そこへ連れていく */}
              <button onClick={() => setFocus((n) => n + 1)}
                      className="btn" style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, border: `1px solid ${EDGE}`, color: T3 }}>
                直したい
              </button>
            </>
          )}
          {busy === 'revise' && <span style={{ color: T5, fontSize: 12 }}>統括AIが引き直しています…</span>}
          {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
        </div>
        {/**
          * 書いたものは**この画面が引き取る**（会話ではなく、計画の引き直しになる）。
          * **質問の板は入力欄と一体で浮く。** 答え終わっていないものがあるあいだだけ出す。
          */}
        <Composer placeholder="直したいところを書く、@ で資料を参照"
                  onSend={revise} busy={!!busy} onHeight={setBandH} focusAt={focus}
                  above={ASK ? (
                    <Ask
                      q={ASK.body} idx={askAt + 1} total={v.asks.length}
                      options={ASK.options} free="自分の言葉で書く" answer={ASK.answer}
                      busy={busy === 'answer'}
                      onPick={(label) => reply(askAt, label)}
                      onFree={(text) => reply(askAt, text)}
                      onSkip={() => {
                        const next = v.asks.findIndex((a, k) => k > askAt && !a.answer);
                        if (next >= 0) setAt(next); else setHideAsk(true);
                      }}
                      onMove={(d) => setAt(Math.min(Math.max(askAt + d, 0), v.asks.length - 1))}
                    />
                  ) : DONE.length > 0 ? <Chips items={DONE} /> : undefined} />
      </Centre>

      {pane && (
      <Pane onClose={() => setPane(false)} width={440} icon="roadmap" title="この計画の根拠">
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px' }}>
          <span style={{ color: T3, display: 'block', paddingBottom: 3 }}>時間の使い方</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 0 4px' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {ROWS.map((r, i) => (
                <div key={r.name} style={{ flex: r.w1 - r.w0, height: 10, borderRadius: 3, background: GREYS[i % GREYS.length] }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {ROWS.map((r) => (
                <span key={r.name} style={{ flex: r.w1 - r.w0, color: T5, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>{r.name}</span>
              ))}
            </div>
          </div>
          {/* **統括AIが言っていないことは書かない。** ダミーの計画にだけ一言がある */}
          {v.timeNote && <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '11px 0' }}>{v.timeNote}</p>}

          <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>なぜこの順番か</span>
          {v.why.map((t, i) => (
            <div key={i} style={{ padding: '11px 0', borderBottom: i === v.why.length - 1 ? undefined : `1px solid ${HAIR}` }}>
              <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{t}</span>
            </div>
          ))}

          {FACTS && (
            <>
              <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>前提にしていること</span>
              {FACTS.map(([k, val], i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: i === FACTS.length - 1 ? undefined : `1px solid ${HAIR}` }}>
                  <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ color: T2, fontSize: 13 }}>{val}</span>
                </div>
              ))}
            </>
          )}

          {v.dropped && (
            <>
              <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>見送った案</span>
              <div style={{ padding: '11px 0' }}>
                <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{v.dropped}</span>
              </div>
            </>
          )}
        </div>
      </Pane>
      )}
    </>
  );
}

/** 週の目盛り。全体の長さで刻みを変える（10週なら2週ごと、1週なら0.25週ごと） */
function ticks(pw: number): number[] {
  const step = pw <= 2 ? pw / 4 : pw <= 6 ? 1 : 2;
  const out: number[] = [];
  for (let x = step; x <= pw + 1e-9; x += step) out.push(Math.round(x * 100) / 100);
  return out;
}

/** 統括AIが計画を立てているあいだ。**返事を作らない** — 考えている、とだけ出す */
function Waiting() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ExecStatus state="thinking" />
    </div>
  );
}
