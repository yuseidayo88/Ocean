import { notFound } from 'next/navigation';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, WORKS } from '@/lib/dummy';

/**
 * 計画の承認（参考: AWS Amplify / Workable の Review）。
 * **計画は表ではなく図。** 10週の軸に4フェーズを帯で置き、
 * 「あなたに聞くこと」は ◆ として軸の上に立てる。
 * 右ペインは「この計画の根拠」。中央のロードマップを二度言わない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663';
const PW = 10; // 全体の週数

type Row = { n: number; name: string; goal: string; w0: number; w1: number; who: string; weeks: string; soft?: boolean; dec?: string };
const ROWS: Row[] = [
  { n: 1, name: '調査',       goal: '市場・競合・ターゲットを確かめる', w0: 0, w1: 3,  who: '調査担当', weeks: '3週' },
  { n: 2, name: '戦略',       goal: '収益モデルと価格を決める',       w0: 3, w1: 5,  who: '戦略担当', weeks: '2週', dec: '価格の方向性' },
  { n: 3, name: 'プロダクト', goal: 'MVPの要件を固めて作る',         w0: 5, w1: 8,  who: '企画担当', weeks: '3週', dec: 'MVPの線引き' },
  { n: 4, name: 'ローンチ',   goal: '初期ユーザーを集める',           w0: 8, w1: 10, who: '担当は未定', weeks: '2週', soft: true },
];

const MAKES: [string, string][][] = [
  [['市場規模レポート', 'フェーズ1'], ['競合分析レポート', 'フェーズ1'], ['ペルソナ仮説', 'フェーズ1']],
  [['収益モデル比較', 'フェーズ2'], ['MVP要件定義', 'フェーズ3'], ['LPと申込フォーム', 'フェーズ3']],
];

export function generateStaticParams() { return WORKS.map((w) => ({ id: w.id })); }

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = WORKS.find((x) => x.id === id);
  if (!w) notFound();

  return (
    <>
      <Centre>
        <TopBar crumb={w.title} title="計画案" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 26px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>
              韓国人向けの日本語学習サービスを立ち上げたい
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T4 }}>
            <span>42秒 考えました</span><Icon name="chev" color={T4} size={12} />
          </div>
          <span style={{ fontSize: 15, lineHeight: '25px' }}>
            4フェーズで進めます。まず市場を確かめ、勝てる形が見えてから作りはじめます。
          </span>

          {/* 計画 = 図 */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 4 }}>
              <span style={{ color: T3 }}>計画</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>およそ 10週 · あなたに聞くのは ◆ の2回</span>
            </div>
            <div style={{ position: 'absolute', left: 220, right: 120, top: 22, bottom: 0, pointerEvents: 'none' }}>
              {[2, 4, 6, 8].map((wk) => (
                <div key={wk} style={{ position: 'absolute', left: `${(wk / PW) * 100}%`, top: 0, bottom: 0, width: 1, background: '#131313' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0 6px' }}>
              <div style={{ width: 208, flexShrink: 0 }} />
              <div style={{ flex: 1, position: 'relative', height: 14 }}>
                {[2, 4, 6, 8, 10].map((wk) => (
                  <span key={wk} style={{
                    position: 'absolute', left: `${(wk / PW) * 100}%`,
                    transform: wk === 10 ? 'translateX(-100%)' : 'translateX(-50%)',
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
              <span style={{ width: 176, flexShrink: 0, color: T4, fontSize: 13 }}>採用する AI社員 3体</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {(['cyan', 'purple', 'indigo'] as const).map((c, i) => (
                  <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Orb color={AGENT_COLOR[c]} size={26} seed={13 + i * 5} />
                    <span style={{ color: T2, fontSize: 13 }}>{['調査担当', '戦略担当', '企画担当'][i]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
              <span style={{ width: 176, flexShrink: 0, color: T4, fontSize: 13 }}>最初の成果物が出るまで</span>
              <span style={{ color: T2, fontSize: 13 }}>3日</span>
            </div>
          </div>

          {/* 作るもの */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 4 }}>
              <span style={{ color: T3 }}>作るもの</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>6件</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px', borderRadius: 8, background: BLUE, color: '#fff' }}>
              承認して始める
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, color: T3 }}>
              直したい
            </span>
          </div>
        </div>
        <Composer placeholder="直したいところを書く、@ で資料を参照" />
      </Centre>

      <Pane width={440} icon="roadmap" title="この計画の根拠">
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
    </>
  );
}
