'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { pressable } from '@/lib/a11y';
import { conditionChips } from '@/lib/live/conditions';
import { discoveryGet, adoptCandidate } from '@/app/actions/entry';
import type { Discovery } from '@/lib/store';
import { BLUE, COMPOSER_H, EDGE, GREEN, GREEN_T, HAIR, RED_T, SUNK, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪-b 候補をくらべる（Case B）。候補は**統括AIが出した実物**（`discovery_candidates`）。
 * **採用しなかった候補も残す** — なぜその道を選んだかは、選ばなかった道と並べて意味になる。
 * 「この案ではじめる」を押すと、Case A と同じ道（統括AIが計画まで引く）に入る。
 */

const AXES: [string, keyof Discovery['candidates'][number]['fit']][] = [
  ['立ち上がりの速さ', 'speed'], ['初期費用の低さ', 'cost'], ['強みとの相性', 'strength'],
];

function Result() {
  const router = useRouter();
  const [sid] = useParam('s', '');
  const [open, setOpen] = useOpen();
  const [d, setD] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState('');
  const [fail, setFail] = useState('');

  useEffect(() => {
    if (!sid) { router.replace('/discovery' as Route); return; }
    let on = true;
    discoveryGet(sid).then((x) => {
      if (!on) return;
      if (!x || !x.candidates.length) { router.replace((x ? `/discovery?s=${sid}` : '/discovery') as Route); return; }
      setD(x);
    });
    return () => { on = false; };
  }, [sid, router]);

  if (!d) return <Centre><TopBar title="候補" /><div style={{ flex: 1 }} /></Centre>;

  const adopt = async (candId: string) => {
    setBusy(candId); setFail('');
    const r = await adoptCandidate(d.id, candId);
    if (r.ok) { router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy('');
    setFail(r.need === 'end' ? `統括AIが聞いています — ${r.body}。条件を足してからもう一度どうぞ` : r.message);
  };

  const sel = d.candidates.find((c) => c.id === open) ?? d.candidates[0];
  const others = (of: string) => d.candidates.filter((c) => c.id !== of && c.notChosenWhy);

  return (
    <>
      <Centre>
        <TopBar title="候補" onPanel={() => setOpen(d.candidates[0].id)} panelOn={!!open} />

        {/* 集めた条件は上に貼る。答え終わったものだけ */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18,
          padding: '0 26px', height: 44, borderBottom: `1px solid ${HAIR}`,
        }}>
          {conditionChips(d.conditions).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name="check" color={GREEN_T} size={11} width={2.4} />
              <span style={{ color: T5, fontSize: 11 }}>{k}</span>
              <span style={{ color: T2, fontSize: 12 }}>{v}</span>
            </span>
          ))}
          <div style={{ flex: 1 }} />
          {/* **`edit=1` を付ける。** 付けないと、向こうの「候補が出ていれば結果へ」に
              その場で跳ね返されて、条件を直す道が塞がる（押しても何も起きない） */}
          <Link href={`/discovery?s=${d.id}&edit=1` as Route} className="lnk" style={{ color: T4, fontSize: 12 }}>条件を変える</Link>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px` }}>
          <span style={{ fontSize: 15, lineHeight: '25px', display: 'block', paddingBottom: 4 }}>
            条件に合う道を3つ。<b>いちばん上をおすすめします。</b>
          </span>
          {!d.real && (
            <span style={{ display: 'block', color: T5, fontSize: 12, paddingBottom: 6 }}>
              これは仮の候補です。モデルの鍵がまだ入っていないので、統括AIは考えていません
            </span>
          )}
          {fail && <span style={{ display: 'block', color: RED_T, fontSize: 12.5, paddingBottom: 6 }}>{fail}</span>}

          {/* 同じ器を縦に並べない。ヘアラインの行にして、推す1つだけ色帯と薄い面 */}
          <div style={{ paddingTop: 12 }}>
            {d.candidates.map((c, n) => (
              <div key={c.id} className="row" {...pressable(() => setOpen(c.id))} style={{
                position: 'relative', display: 'flex', gap: 20, alignItems: 'center',
                padding: '20px 20px 20px 22px',
                background: c.recommended ? 'rgba(30,142,62,0.05)' : undefined,
                borderRadius: c.recommended ? 10 : undefined,
                borderBottom: n === d.candidates.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                {c.recommended && <span style={{
                  position: 'absolute', left: 0, top: 14, bottom: 14, width: 3,
                  borderRadius: '0 2px 2px 0', background: GREEN,
                }} />}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.recommended && <span style={{ color: GREEN_T, fontSize: 11, whiteSpace: 'nowrap' }}>おすすめ</span>}
                  </div>
                  <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{c.summary}</span>
                </div>
                <div style={{ width: 186, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AXES.map(([label, key]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 88, flexShrink: 0, color: T5, fontSize: 11, textAlign: 'right' }}>{label}</span>
                      <span style={{ flex: 1, height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${c.fit[key]}%`, height: '100%', background: c.recommended ? GREEN : '#333' }} />
                      </span>
                    </div>
                  ))}
                </div>
                {c.adoptedWorkId ? (
                  <Link href={`/work/${c.adoptedWorkId}/plan` as Route} onClick={(e) => e.stopPropagation()}
                        className="btn" style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
                    borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, whiteSpace: 'nowrap',
                  }}>Work を見る</Link>
                ) : d.status === 'adopted' ? null : (
                  <button onClick={(e) => { e.stopPropagation(); adopt(c.id); }}
                          disabled={!!busy}
                          className={c.recommended ? 'solid' : 'btn'} style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
                    borderRadius: 8, whiteSpace: 'nowrap',
                    background: c.recommended ? BLUE : undefined,
                    border: c.recommended ? undefined : `1px solid ${EDGE}`,
                    color: c.recommended ? '#fff' : T3,
                    opacity: busy && busy !== c.id ? 0.5 : 1,
                  }}>{busy === c.id ? '計画を引いています…' : c.recommended ? 'この案ではじめる' : 'この案にする'}</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Composer placeholder="候補について統括AIに聞く" />
      </Centre>

      {open && sel && (
      <Pane onClose={() => setOpen(null)} width={420} icon="dec"
            title={sel.recommended ? 'この案をすすめる理由' : 'この案について'}>
        <div key={sel.id} className="swap" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 0' }}>
          <span style={{ fontSize: 15, display: 'block' }}>{sel.name}</span>
          <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '10px 0 0' }}>{sel.summary}</p>
          {sel.why.length > 0 && (
            <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sel.why.map((t) => (
                <span key={t} style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>・{t}</span>
              ))}
            </div>
          )}
          {!sel.recommended && sel.notChosenWhy && (
            <p style={{ color: T5, fontSize: 12.5, lineHeight: '20px', margin: '14px 0 0' }}>
              推さなかった理由 — {sel.notChosenWhy}
            </p>
          )}

          {others(sel.id).length > 0 && <>
            <PaneHead>選ばなかった理由も残します</PaneHead>
            {others(sel.id).map((c, i, all) => (
              <div key={c.id} style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 0',
                borderBottom: i === all.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ color: T3, fontSize: 12.5 }}>{c.name}</span>
                <span style={{ color: T5, fontSize: 12, lineHeight: '19px' }}>{c.notChosenWhy}</span>
              </div>
            ))}
          </>}
        </div>
      </Pane>
      )}
    </>
  );
}

export default function DiscoveryResultPage() {
  return <Suspense fallback={null}><Result /></Suspense>;
}
