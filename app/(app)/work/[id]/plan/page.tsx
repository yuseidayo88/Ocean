'use client';

import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';

import { useOpen } from '@/lib/use-open';
import { notFound, useParams } from 'next/navigation';
import { Centre, Composer, ExecStatus, Pane, TopBar } from '@/components/shell/Chrome';
import { COMPOSER_H } from '@/lib/design/tokens';
import { useShell } from '@/components/shell/Shell';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, WORKS } from '@/lib/dummy';
import { DUMMY_VIEW, fromDraft, type PlanView } from '@/lib/exec/view';
import { getDraft } from '@/app/actions/work';
import { useEffect, useState } from 'react';

/**
 * 計画の承認（参考: AWS Amplify / Workable の Review）。
 * **計画は表ではなく図。** 10週の軸に4フェーズを帯で置き、
 * 「あなたに聞くこと」は ◆ として軸の上に立てる。
 * 右ペインは「この計画の根拠」。中央のロードマップを二度言わない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663';

/**
 * 中身は1つの形（`PlanView`）から描く。
 * ダミーの Work でも、統括AIが立てたばかりの計画でも、**同じ画面**が出る。
 * 似た画面を2つ作らないため。
 */
export default function PlanPage() {
  const { say5 } = useShell();
  const { id } = useParams<{ id: string }>();
  // 右は閉じた状態から始まる。トップバーの板アイコンで出し入れする
  const [openId, setOpen] = useOpen();
  const pane = openId === 'why';
  const setPane = (v: boolean) => setOpen(v ? 'why' : null);
  const dummy = WORKS.find((x) => x.id === id);
  const [v, setV] = useState<PlanView | null>(dummy ? DUMMY_VIEW : null);
  const [gone, setGone] = useState(false);

  // ダミーに無い id は、統括AIが立てたばかりの計画
  useEffect(() => {
    if (dummy) return;
    let live = true;
    getDraft(id).then((d) => { if (!live) return; if (d) setV(fromDraft(d)); else setGone(true); });
    return () => { live = false; };
  }, [id, dummy]);

  if (gone) notFound();
  if (!v) return <Centre><TopBar title="計画案" /><Waiting /></Centre>;

  const PW = v.weeks || 1;
  const ROWS = v.rows;
  // 作るものは2列に割る
  const half = Math.ceil(v.makes.length / 2);
  const MAKES = [v.makes.slice(0, half), v.makes.slice(half)];

  return (
    <>
      <Centre>
        <TopBar crumb={v.title} title="計画案" onPanel={() => setPane(true)} panelOn={pane} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 26px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>
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
              <span style={{ color: T5, fontSize: 12 }}>
                およそ {v.weeks}週{v.rows.filter((r) => r.dec).length > 0 && ` · あなたに聞くのは ◆ の${v.rows.filter((r) => r.dec).length}回`}
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
                borderBottom: i === ROWS.length - 1 ? undefined : '1px solid #161616',
              }}>
                <div style={{ width: 208, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ color: r.soft ? T5 : T1 }}>{r.name}</span>
                  <span style={{ color: T5, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.goal}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 26 }}>
                  <div style={{
                    position: 'absolute', left: `${(r.w0 / PW) * 100}%`, width: `${((r.w1 - r.w0) / PW) * 100}%`,
                    top: 0, height: 26, borderRadius: 5,
                    background: r.soft ? undefined : '#2A2A2A',
                    border: r.soft ? '1px dashed #2A2A2A' : undefined, boxSizing: 'border-box',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: '1px solid #161616' }}>
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
                      borderBottom: i === col.length - 1 ? undefined : '1px solid #161616',
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
          padding: '0 26px', marginBottom: COMPOSER_H, borderTop: '1px solid #1C1C1C',
        }}>
          <Link href={`/work/${id}` as Route} className="solid" style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px', borderRadius: 8, background: BLUE, color: '#fff' }}>
            承認して始める
          </Link>
          <button onClick={() => say5('直したいところは、下の入力欄に書いてください')} className="btn" style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #2A2A2A', color: T3 }}>
            直したい
          </button>
        </div>
        <Composer placeholder="直したいところを書く、@ で資料を参照" />
      </Centre>

      {pane && (
      <Pane onClose={() => setPane(false)} width={440} icon="roadmap" title="この計画の根拠">
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0' }}>
          <span style={{ color: T3, display: 'block', paddingBottom: 3 }}>時間の使い方</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 0 4px' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[[3, '#3A3A3A'], [2, '#333'], [3, '#2C2C2C'], [2, '#242424']].map(([f, c], i) => (
                <div key={i} style={{ flex: f as number, height: 10, borderRadius: 3, background: c as string }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[[3, '調査'], [2, '戦略'], [3, 'プロダクト'], [2, 'ローンチ']].map(([f, n], i) => (
                <span key={i} style={{ flex: f as number, color: T5, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>{n}</span>
              ))}
            </div>
          </div>
          <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '11px 0' }}>
            作る前に確かめることに <span style={{ color: T1 }}>半分</span> を使います。ここで外すと、あとの5週がまるごと無駄になります。
          </p>

          <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>なぜこの順番か</span>
          {['価格は、市場と競合を見てからでないと決められません。だから戦略はフェーズ2です。',
            'ローンチの担当はまだ決めません。何を作るかが決まってから、合う社員を選びます。'].map((t, i) => (
            <div key={i} style={{ padding: '11px 0', borderBottom: i === 0 ? '1px solid #161616' : undefined }}>
              <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{t}</span>
            </div>
          ))}

          <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>前提にしていること</span>
          {[['韓国の日本語学習者', '約 12万人'], ['あなたが使える時間', '週 10時間'], ['初期の資金', '〜50万円'], ['出典', '3件 ›']].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: i === 3 ? undefined : '1px solid #161616' }}>
              <span style={{ color: T4, fontSize: 12 }}>{k}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T2, fontSize: 13 }}>{v}</span>
            </div>
          ))}

          <span style={{ color: T3, display: 'block', padding: '22px 0 3px' }}>見送った案</span>
          <div style={{ padding: '11px 0' }}>
            <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>
              いきなりLPを作る — 誰に何を売るかが決まる前に作ると、ほぼ作り直しになります。フェーズ3に入れました。
            </span>
          </div>
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
