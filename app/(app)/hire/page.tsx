import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, HIRE_CANDIDATES } from '@/lib/dummy';

/**
 * 採用は日本語で「どんなAIか」が分かる形。
 * 大きい日本語名＋1行の説明＋できることタグ＋この Work での担当。英語名は副次的に小さく。
 * 想定トークンは出さない。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', GREEN_T = '#5BB974';

export default function HirePage() {
  const top = HIRE_CANDIDATES[0];
  return (
    <>
      <Centre>
        <TopBar crumb="メンバー" title="採用" />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 26px 112px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 14 }}>
            <span style={{ color: T3 }}>候補</span>
            <span style={{ color: T5, fontSize: 12 }} className="tnum">{HIRE_CANDIDATES.length}体</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {HIRE_CANDIDATES.map((c) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 12,
                background: c.recommended ? '#0C0C0C' : 'transparent',
                border: `1px solid ${c.recommended ? '#262626' : '#1A1A1A'}`,
              }}>
                <Orb color={AGENT_COLOR[c.color]} size={52} seed={c.name.length * 9 + 5} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{c.name}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{c.en}</span>
                    {c.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>おすすめ</span>}
                  </div>
                  <span style={{ color: T2, fontSize: 13 }}>{c.lead}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.can.map((t) => (
                      <span key={t} style={{
                        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                        borderRadius: 999, background: '#151515', color: T4, fontSize: 11,
                      }}>{t}</span>
                    ))}
                  </div>
                  <span style={{ color: T5, fontSize: 11.5 }}>この Work での担当: {c.forWork}</span>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 15px', borderRadius: 8,
                  background: c.recommended ? BLUE : '#1A1A1A',
                  border: c.recommended ? undefined : '1px solid #2A2A2A',
                  color: c.recommended ? '#fff' : T2, whiteSpace: 'nowrap',
                }}>採用する</span>
              </div>
            ))}
          </div>
        </div>
        <Composer placeholder="どんな社員が要るか統括AIに相談する" />
      </Centre>

      <Pane width={420} tabs={[{ label: top.name }]}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={AGENT_COLOR[top.color]} size={44} seed={top.name.length * 9 + 5} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15 }}>{top.name}</span>
              <span style={{ color: T5, fontSize: 11.5 }}>{top.en}</span>
            </div>
          </div>
          <span style={{ color: T2, fontSize: 13.5, lineHeight: '22px' }}>{top.lead}</span>
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>できること</span>
            {top.can.map((t, i) => (
              <div key={t} style={{ padding: '9px 0', borderBottom: i === top.can.length - 1 ? undefined : '1px solid #161616' }}>
                <span style={{ color: T2, fontSize: 13 }}>{t}</span>
              </div>
            ))}
          </div>
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 6 }}>最初に入るスキル</span>
            {['記事の書き方', '見出しの付け方'].map((s, i) => (
              <div key={s} style={{ padding: '9px 0', borderBottom: i === 1 ? undefined : '1px solid #161616' }}>
                <span style={{ color: T2, fontSize: 13 }}>{s}</span>
              </div>
            ))}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 34,
            borderRadius: 8, background: BLUE, color: '#fff',
          }}>採用する</span>
        </div>
      </Pane>
    </>
  );
}
