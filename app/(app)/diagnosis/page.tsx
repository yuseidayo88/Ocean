'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Go as Link } from '@/components/ui/Go';
import { useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { pressable } from '@/lib/a11y';
import { findingToWork, profileGet } from '@/app/actions/entry';
import type { Profile } from '@/lib/store';
import { BLUE, COMPOSER_H, EDGE, HAIR, MUTE, RED_T, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪-d 診断結果（Case D）。中身は**統括AIが出した実物**（`diagnoses`）。
 * **診断は必ず「次に何をするか（Work）」まで持つ** — 見つけたことを並べて終わりにしない。
 * 「この Work を立てる」で Case A と同じ道（計画→承認）に入る。
 */

/**
 * **重さは明るさで言う。色は使わない。**
 * 赤＝止まっている・遅れている / 橙＝あなたが決める・見る の2つしか意味を持たないので、
 * 診断の重さはどちらでもない（測れていないことも、停止ではない）。
 */
const WEIGHT: Record<string, string> = { '重い': T2, '中くらい': T4, '軽い': MUTE };

function Diagnosis() {
  const router = useRouter();
  const [pid] = useParam('p', '');
  const [open, setOpen] = useOpen();
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  useEffect(() => {
    if (!pid) { router.replace('/import' as Route); return; }
    let on = true;
    profileGet(pid).then((x) => {
      if (!on) return;
      // 診断がまだなら取り込みへ（空の診断画面を見せない）
      if (!x || !x.diagnosis) { router.replace((x ? `/import?p=${pid}` : '/import') as Route); return; }
      setP(x);
    });
    return () => { on = false; };
  }, [pid, router]);

  const dg = p?.diagnosis;
  if (!p || !dg) return <Centre><TopBar title="診断結果" /><div style={{ flex: 1 }} /></Centre>;

  const start = async (index: number) => {
    setBusy(true); setFail('');
    const r = await findingToWork(p.id, index);
    if (r.ok) { router.push(`/work/${r.id}/plan` as Route); return; }
    setBusy(false);
    setFail(r.need === 'end' ? `統括AIが聞いています — ${r.body}` : r.message);
  };

  const selIdx = Math.max(dg.findings.findIndex((f) => f.title === open), 0);
  const sel = open ? dg.findings[selIdx] : undefined;
  const top = dg.findings[0];
  /** まだ Work になっていない先頭。全部立て終わっていれば -1 */
  const next = dg.findings.findIndex((f) => !f.workId);

  return (
    <>
      <Centre>
        <TopBar crumb={p.name} title="診断結果" onPanel={() => setOpen(dg.findings[0].title)} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 720 }}>
              いちばん効くのは、<b>{top.title}。</b>{top.why}
            </span>
            {!dg.real && (
              <span style={{ color: T5, fontSize: 12 }}>
                これは仮の診断です。モデルの鍵がまだ入っていないので、統括AIは考えていません
              </span>
            )}
            {fail && <span style={{ color: RED_T, fontSize: 12.5 }}>{fail}</span>}
          </div>

          {/* ラベル（小）→ 数字（大）→ 補足。説明文は置かない */}
          {dg.facts.length > 0 && (
          <div style={{ display: 'flex', gap: 26 }}>
            {dg.facts.map((f, i) => (
              <div key={f.label} style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                borderRight: i === dg.facts.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ color: T4, fontSize: 12 }}>{f.label}</span>
                {/* 測れていない数字は「—」そのものが答え。赤にしない（停止ではない） */}
                <span style={{ fontSize: 24, lineHeight: '30px', color: f.missing ? T4 : T1 }} className="tnum">{f.value}</span>
                {f.note && <span style={{ color: T5, fontSize: 11 }}>{f.note}</span>}
              </div>
            ))}
          </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>見つかったこと</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">· {dg.findings.length}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>効きそうな順</span>
            </div>
            {dg.findings.map((f, i) => (
              /* 色帯は置かない — 右端の語とまったく同じ事実で、二度言いになる */
              <div key={f.title} className="row" {...pressable(() => setOpen(f.title))} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0',
                borderBottom: i === dg.findings.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
                  {/* 本物の文は長い。切らずに折り返す */}
                  <span style={{ color: T5, fontSize: 11.5, lineHeight: '17px' }}>{f.why}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ width: 56, flexShrink: 0, textAlign: 'right', color: WEIGHT[f.severity] ?? MUTE, fontSize: 11.5 }}>{f.severity}</span>
                <span style={{ width: 220, flexShrink: 0, textAlign: 'right', color: T4, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {/* もう立てたものは、そう出す（無いものは無いと出す、の裏返し） */}
                  {f.workId ? 'Work にした' : `Work「${f.work.title}」`}
                </span>
              </div>
            ))}
          </div>

          {/* まだ Work になっていないものが残っているときだけ、先頭を勧める */}
          {next >= 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: T3, fontSize: 13 }}>1件ずつ Work にします</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => start(next)} disabled={busy} className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff', opacity: busy ? 0.6 : 1,
            }}>{busy ? '計画を引いています…' : 'いちばん上から始める'}</button>
          </div>
          )}
        </div>
        <Composer placeholder="診断について統括AIに聞く" />
      </Centre>

      {open && sel && (
      <Pane onClose={() => setOpen(null)} width={420} icon="dec" title={sel.title}>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 18px 0' }}>
          <span style={{ color: WEIGHT[sel.severity] ?? MUTE, fontSize: 12 }}>{sel.severity}</span>
        </div>
        <div key={sel.title} className="swap" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 18px 0' }}>
          <span style={{ fontSize: 15, display: 'block' }}>{sel.title}</span>
          <p style={{ color: T2, fontSize: 13, lineHeight: '21px', margin: '12px 0 0' }}>{sel.why}</p>

          {sel.evidence.length > 0 && <>
            <PaneHead>根拠</PaneHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {sel.evidence.map((t) => (
                <span key={t} style={{ color: T2, fontSize: 12.5, lineHeight: '20px' }}>・{t}</span>
              ))}
            </div>
          </>}

          <PaneHead>提案する Work</PaneHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', borderRadius: 10, background: '#131313' }}>
            <span style={{ fontSize: 14 }}>{sel.work.title}</span>
            <span style={{ color: T5, fontSize: 12 }}>{sel.work.goal} · およそ{sel.work.weeks}週</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', padding: 16, borderTop: `1px solid ${HAIR}` }}>
          <div style={{ flex: 1 }} />
          {/* **もう立てたなら、立て直させない。** 行き先はその Work の計画へ */}
          {sel.workId ? (
            <Link href={`/work/${sel.workId}` as Route} className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 20px',
              borderRadius: 8, border: `1px solid ${EDGE}`, color: T2,
            }}>Work を見る</Link>
          ) : (
            <button onClick={() => start(selIdx)} disabled={busy} className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 20px',
              borderRadius: 8, background: BLUE, color: '#fff', opacity: busy ? 0.6 : 1,
            }}>{busy ? '計画を引いています…' : 'この Work を立てる'}</button>
          )}
        </div>
      </Pane>
      )}
    </>
  );
}

export default function DiagnosisPage() {
  return <Suspense fallback={null}><Diagnosis /></Suspense>;
}
