'use client';

import { useEffect, useState } from 'react';
import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';

import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR } from '@/lib/view/model';
import { ROSTER, type Definition } from '@/lib/roster';
import { hire, listEmployees } from '@/app/actions/run';
import { pressable } from '@/lib/a11y';
import { useShell } from '@/components/shell/Shell';
import { BLUE, COMPOSER_H, GREEN_T, HAIR, RULE, T2, T3, T5 } from '@/lib/design/tokens';
/**
 * 採用は日本語で「どんなAIか」が分かる形。
 * 大きい日本語名＋1行の約束＋守ること。英語名は副次的に小さく。
 * 想定トークンは出さない。「あとで」は置かない。
 *
 * **候補＝ロスターの定義 − いまの在籍。** 採用は定義で採るので、
 * 二度押しても、Work の承認と重なっても、同じ担当が2人にならない。
 */

export default function HirePage() {
  const { say5 } = useShell();
  const [hired, setHired] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const reload = () => {
    listEmployees().then((es) => { setHired(new Set(es.map((e) => e.definitionId))); setLoaded(true); });
  };
  useEffect(reload, []);

  const candidates = ROSTER.filter((d) => !hired.has(d.slug));

  const take = async (d: Definition) => {
    const r = await hire(d.slug, d.name);
    say5(r.ok ? `${d.name} を採用しました。メンバーに並びます` : r.message ?? '採用できませんでした');
    reload();
  };

  const [openId, setOpen] = useOpen();
  const open = candidates.find((d) => d.slug === openId) ?? null;
  const top = candidates[0];

  return (
    <>
      <Centre>
        <TopBar title="採用" onPanel={top ? () => setOpen(top.slug) : undefined} panelOn={!!open} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loaded && candidates.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: T2 }}>ロスターの全員が在籍しています</span>
              <span style={{ color: T5, fontSize: 13 }}>新しい職種は、統括AIが必要になったときに提案します</span>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 15, lineHeight: '25px' }}>
                {hired.size === 0
                  ? <>まだ誰もいません。ふつうは Work を立てると統括AIが必要な人を提案します — 先に選んでもかまいません。</>
                  : <>いまの在籍は {hired.size}人。足りない職種をここから足せます。</>}
              </span>

              {/* **同じ器を縦に並べない。** 候補はカードにせず、ヘアラインで区切った行にする */}
              <div>
                {candidates.map((c, n) => (
                  <div key={c.slug} className="row" {...pressable(() => setOpen(c.slug))} style={{
                    display: 'flex', gap: 16, padding: '17px 18px', boxSizing: 'border-box',
                    background: openId === c.slug ? '#0B0B0B' : undefined,
                    borderBottom: n === candidates.length - 1 ? undefined : `1px solid ${HAIR}`,
                  }}>
                    <Orb color={AGENT_COLOR[c.color]} size={48} seed={c.name.length * 9 + 5} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 17 }}>{c.name}</span>
                        {n === 0 && hired.size === 0 && <span style={{ color: GREEN_T, fontSize: 11 }}>最初の1人に向く</span>}
                        <div style={{ flex: 1 }} />
                        {/* **青は1ペインに1つ。** 行のボタンはおとなしく */}
                        <button onClick={(ev) => { ev.stopPropagation(); take(c); }} className="btn" style={{
                          display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 15px', borderRadius: 8,
                          background: 'transparent', border: `1px solid ${RULE}`, color: T3, whiteSpace: 'nowrap',
                        }}>採用する</button>
                      </div>
                      <span style={{ color: T5, fontSize: 11 }}>{c.en} · agency-agents 由来</span>
                      <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{c.mission}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 下の余白を放置しない。次にやることを置く */}
              {top && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                  <span style={{ color: T3, fontSize: 13 }}>
                    誰を採るか迷うなら、統括AIに任せてください — Work を立てると提案されます
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => take(top)} className="solid" style={{
                    display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
                    borderRadius: 8, background: BLUE, color: '#fff', whiteSpace: 'nowrap',
                  }}>{top.name}を採用</button>
                </div>
              )}
            </>
          )}
        </div>

        <Composer placeholder="採用について統括AIに聞く" />
      </Centre>

      {open && (
      <Pane onClose={() => setOpen(null)} width={420} icon="team" title="候補の詳細">
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: T5, fontSize: 12 }}>未採用</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={AGENT_COLOR[open.color]} size={44} seed={open.name.length * 9 + 5} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15 }}>{open.name}</span>
              <span style={{ color: T5, fontSize: 11.5 }}>{open.en}</span>
            </div>
          </div>
          <p style={{ color: T2, fontSize: 13.5, lineHeight: '22px', margin: '16px 0 0' }}>{open.mission}</p>

          <PaneHead>守ること</PaneHead>
          {/* 定義の Critical Rules。採用したあとも消せない */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 4 }}>
            {open.rules.map((r) => (
              <span key={r} style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>・{r}</span>
            ))}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: 16, borderTop: `1px solid ${HAIR}` }}>
          <button onClick={() => { take(open); setOpen(null); }} className="solid" style={{
            display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 18px',
            borderRadius: 8, background: BLUE, color: '#fff', fontSize: 13,
          }}>採用する</button>
        </div>
      </Pane>
      )}
    </>
  );
}
