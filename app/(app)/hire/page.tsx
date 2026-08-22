import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, HIRE_CANDIDATES } from '@/lib/dummy';

/**
 * 採用は日本語で「どんなAIか」が分かる形。
 * 大きい日本語名＋1行の説明＋できることタグ＋この Work での担当。英語名は副次的に小さく。
 * 想定トークンは出さない。「あとで」は置かない（その段階なら提案しない）。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', GREEN_T = '#5BB974';

const FOR: Record<string, string> = {
  'c-writer': 'フェーズ3 プロダクト · 4タスク',
  'c-quality': 'フェーズ4 ローンチ · 未計画',
  'c-analyst': 'ローンチ後 · 未計画',
};

const DETAIL = {
  lead: '読む人の手が止まらない文章を書く人です。調子を決めたら、どの成果物でもそれを守ります。',
  skills: [['うちの書き方', 'house-style.md'], ['LPの型', 'lp-structure.md'], ['日本語の言い回し', 'tone-ja.md']],
  rules: ['事実は調査担当に確かめてから書く', '決めた調子から外れない', '埋め草の一文を足さない'],
  role: [['フェーズ', '3 — プロダクト'], ['タスク', 'LPの本文 ほか3件'], ['出すもの', 'LPの文章 / 記事 3本']],
};

export default function HirePage() {
  const top = HIRE_CANDIDATES[0];
  return (
    <>
      <Centre>
        <TopBar title="採用" right={<span style={{ color: T5, fontSize: 12 }}>日本語学習サービス</span>} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 15, lineHeight: '25px' }}>
            いま足りないのは<b>書ける人</b>です。フェーズ3の記事とLPの文章が止まります。
          </span>

          {/* **同じ器を縦に並べない。** 候補はカードにせず、ヘアラインで区切った行にする。
              強調したい1つだけ薄い面を敷く */}
          <div>
            {HIRE_CANDIDATES.map((c, n) => (
              <div key={c.id} className="row" style={{
                display: 'flex', gap: 16, padding: '17px 18px', boxSizing: 'border-box',
                background: c.recommended ? '#0B0B0B' : undefined,
                borderBottom: n === HIRE_CANDIDATES.length - 1 ? undefined : '1px solid #161616',
              }}>
                <Orb color={AGENT_COLOR[c.color]} size={48} seed={c.name.length * 9 + 5} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 17 }}>{c.name}</span>
                    {c.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>おすすめ</span>}
                    <div style={{ flex: 1 }} />
                    {/* **青は1ペインに1つ。** ここは全部おとなしく、下の「執筆担当を採用」だけ青 */}
                    <span className="btn" style={{
                      display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 15px', borderRadius: 8,
                      background: 'transparent', border: '1px solid #262626', color: T3, whiteSpace: 'nowrap',
                    }}>採用する</span>
                  </div>
                  <span style={{ color: T5, fontSize: 11 }}>{c.en} · agency-agents 由来</span>
                  <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{c.lead}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {c.can.map((t, i) => (
                      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: T4, fontSize: 12 }}>{t}</span>
                        {i < c.can.length - 1 && <span style={{ color: '#2E2E2E' }}>·</span>}
                      </span>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 12,
                    padding: '11px 0 0', borderTop: '1px solid #1A1A1A',
                  }}>
                    <span style={{ color: T4, fontSize: 12 }}>担当</span>
                    <span style={{ color: T2, fontSize: 12.5 }}>{FOR[c.id]}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 下の余白を放置しない。次にやることを置く */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
            <span style={{ color: T3, fontSize: 13 }}>
              {top.name}を入れれば、フェーズ3はこの4人で回ります
            </span>
            <div style={{ flex: 1 }} />
            <span className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff', whiteSpace: 'nowrap',
            }}>{top.name}を採用</span>
          </div>
        </div>

        <Composer placeholder="採用について統括AIに聞く" />
      </Centre>

      <Pane width={420} icon="team" title="候補の詳細">
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: T5, fontSize: 12 }}>未採用</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={AGENT_COLOR[top.color]} size={44} seed={top.name.length * 9 + 5} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15 }}>{top.name}</span>
              <span style={{ color: T5, fontSize: 11.5 }}>{top.en}</span>
            </div>
          </div>
          <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: '16px 0 0' }}>{DETAIL.lead}</p>

          <PaneHead>スキル</PaneHead>
          {DETAIL.skills.map(([n, f], i) => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 42,
              borderBottom: i === DETAIL.skills.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ color: T2, fontSize: 13 }}>{n}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{f}</span>
            </div>
          ))}

          <PaneHead>守ること</PaneHead>
          {/* まだ採用していない候補なので、素の箇条書きで見せる（枠で囲わない） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 4 }}>
            {DETAIL.rules.map((r) => (
              <span key={r} style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>・{r}</span>
            ))}
          </div>

          <PaneHead>この Work での担当</PaneHead>
          {DETAIL.role.map(([k, v], i) => (
            <div key={k} style={{
              display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0',
              borderBottom: i === DETAIL.role.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ color: T4, fontSize: 12 }}>{k}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T2, fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
        <PaneFooter primary="採用する" secondary="ほかの候補" reverse />
      </Pane>
    </>
  );
}
