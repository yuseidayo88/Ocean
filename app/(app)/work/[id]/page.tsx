'use client';

import { openHref } from '@/lib/use-open';

import { useOpen } from '@/lib/use-open';
import { Go as Link } from '@/components/ui/Go';
import { notFound, useParams } from 'next/navigation';
import { Centre, Composer, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Toggle } from '@/components/shell/Controls';
import { useShell } from '@/components/shell/Shell';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AMBER_T, BLUE, COMPOSER_H, DIM, FAINT, GREEN, GREEN_T, HAIR, MUTE, RAIL, RED, RED_T, SEAM, SUNK, T1, T2, T3, T4, T5, WELL } from '@/lib/design/tokens';
import { fromLive, type WorkView } from '@/lib/exec/work-view';
import { getWork } from '@/app/actions/work';
import { approvePhase, decide, holdWork, taskDecision, taskSteps } from '@/app/actions/run';
import { wakePump } from '@/lib/pump';
import type { LiveDecision } from '@/lib/store';
import { DelActions } from '@/components/live/DelActions';
import { DelBody } from '@/components/live/DelBody';
import { DelTake } from '@/components/live/DelTake';
import type { RunStep } from '@/lib/store';
import { useEffect, useState } from 'react';

/**
 * Work＝会話を持たない。一目で状況が分かる1枚（参考: Upwork / Squarespace / Linear）。
 * 上に事実の帯 → フェーズ全部 → いま動いていること → 成果物。タブに隠さない。
 * 相談は「統括AIに相談する」でチャットへ飛ぶ。
 *
 * **読む形は1つ**（`WorkView`）。ダミー（Phase 4）でも、承認して動きだした本物でも同じ画面。
 * 無いもの（成果物・決定・日付）は**無いと出す**。埋めるために数字を作らない。
 */

/** 数字の下に置く図形。文章で言い直さない */
const Bar = ({ pct }: { pct: number }) => (
  <span style={{ display: 'block', width: 86, height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: T4 }} />
  </span>
);
const Seg = ({ n, on }: { n: number; on: number }) => (
  <span style={{ display: 'flex', gap: 4 }}>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < on ? `${GREEN_T}` : WELL }} />
    ))}
  </span>
);
const Pips = ({ cols }: { cols: string[] }) => (
  <span style={{ display: 'flex', gap: 6, height: 15, alignItems: 'center' }}>
    {cols.map((c, i) => <Dot key={i} color={c} size={5} />)}
  </span>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: T5, fontSize: 11, lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px' }}>{children}</span>
);
/**
 * 一覧の1行。**本物なら右ペインを開き、ダミーなら別画面へ**。
 * 「押した結果がその画面の中で起きるなら、飛ばすほうが答えていない」（→ 09-navigation）。
 */
function Row({ live, onOpen, href, style, children }: {
  live: boolean; onOpen: () => void; href: Parameters<typeof Link>[0]['href'];
  style: React.CSSProperties; children: React.ReactNode;
}) {
  if (!live) return <Link href={href} className="row" style={style}>{children}</Link>;
  return (
    <button onClick={onOpen} className="row" style={{ ...style, width: '100%', textAlign: 'left' }}>
      {children}
    </button>
  );
}

/**
 * フェーズの承認（Phase 9）。統括AIが前の結果と決定を見て
 * 次のフェーズのタスクを引いてから進む。**押すと本当に進む。**
 */
function PhaseGate({ name, unseen, workId, onDone }:
  { name: string; unseen: number; workId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    const r = await approvePhase(workId);
    wakePump(); // 次のフェーズのタスクが積まれた — 15秒待たせない
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? ''); return; }
    onDone();
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Diamond size={10} />
      <span style={{ color: AMBER_T }}>
        フェーズ「{name}」が終わりました。
        {unseen > 0 ? `成果物 ${unseen}件 を見て、次に進めてください` : '次に進めてください'}
      </span>
      <div style={{ flex: 1 }} />
      {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
      <button onClick={go} disabled={busy} className={busy ? undefined : 'solid'} style={{
        display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
        background: busy ? SEAM : BLUE, color: busy ? T5 : '#fff', fontSize: 12.5, flexShrink: 0,
        cursor: busy ? 'default' : 'pointer',
      }}>{busy ? '次のタスクを引いています…' : '次のフェーズへ進める'}</button>
    </div>
  );
}

/**
 * 判断（右ペイン・Phase 9）。統括AIが止まって聞いていることに、その場で答える。
 * 選ぶと decisions が decided になり、タスクが走り直す。
 */
function DecisionPane({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [dec, setDec] = useState<LiveDecision | null | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => { taskDecision(taskId).then(setDec); }, [taskId]);

  if (dec === 'loading') return <span style={{ color: T5, fontSize: 12.5 }}>読み込んでいます…</span>;
  if (!dec) return <span style={{ color: T5, fontSize: 12.5 }}>聞かれていることが見つかりませんでした。</span>;

  const pick = async (label: string) => {
    setBusy(true);
    await decide(dec.id, label);
    wakePump(); // 待っていたタスクが queued に戻った
    setBusy(false); onDone();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : undefined }}>
      <span style={{ fontSize: 14, color: T1 }}>{dec.question}</span>
      {dec.why && <span style={{ color: T4, fontSize: 12.5, lineHeight: '19px', paddingTop: 6 }}>{dec.why}</span>}
      <div style={{ paddingTop: 12 }}>
        {dec.options.map((o, i) => (
          <button key={o.label} onClick={() => pick(o.label)} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 10px', margin: '0 -10px',
            borderRadius: 8, textAlign: 'left',
            borderBottom: i === dec.options.length - 1 ? undefined : `1px solid ${HAIR}`,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 5, background: SEAM, color: T4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
            }}>{i + 1}</span>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {o.label}
                {o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>推奨</span>}
              </span>
              {o.description && <span style={{ color: T5, fontSize: 12 }}>{o.description}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * タスクの歩み（右ペイン）。**開いているあいだだけ**2秒ごとに読み直す。
 * 実行中は最後の行が動き続けるので、流れて見える。
 */
function StepsPane({ taskId, running }: { taskId: string; running: boolean }) {
  const [steps, setSteps] = useState<RunStep[]>([]);
  useEffect(() => {
    let on = true;
    const load = () => taskSteps(taskId).then((r) => { if (on) setSteps(r); });
    load();
    if (!running) return () => { on = false; };
    const h = window.setInterval(load, 2000);
    return () => { on = false; window.clearInterval(h); };
  }, [taskId, running]);

  if (!steps.length) {
    return (
      <span style={{ color: T5, fontSize: 12.5, lineHeight: '20px' }}>
        まだ動いていません。順番が来ると、ここに歩みが流れます。
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((st, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={st.seq} style={{
            display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0',
            borderBottom: last ? undefined : `1px solid ${HAIR}`,
          }}>
            <span style={{ width: 8, flexShrink: 0, display: 'inline-flex', alignSelf: 'center' }}>
              {last && running
                ? <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN_T,
                                 animation: 'pulse 1.6s ease-in-out infinite' }} />
                : <Dot color={DIM} size={5} />}
            </span>
            <span style={{ flex: 1, minWidth: 0, color: last && running ? T1 : T2, fontSize: 12.5, lineHeight: '19px' }}>
              {st.summary}
            </span>
            {st.progress != null && (
              <span style={{ color: T5, fontSize: 11, flexShrink: 0 }} className="tnum">{st.progress}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** フェーズの状態は行の先頭の印で言う（状態の列は置かない） */
const PhaseMark = ({ state }: { state: 'done' | 'now' | 'next' }) => {
  if (state === 'done') return <Icon name="check" color={GREEN_T} size={13} width={2.2} />;
  if (state === 'now') return <span style={{
    width: 10, height: 10, borderRadius: 999, border: `1.5px solid ${T3}`,
    background: `linear-gradient(90deg, ${T3} 50%, transparent 50%)`,
  }} />;
  return <span style={{ width: 9, height: 9, borderRadius: 999, border: `1px dashed ${DIM}` }} />;
};

export default function WorkPage() {
  const { id } = useParams<{ id: string }>();
  // 右は閉じた状態から始まる。トップバーの板アイコンで出し入れする
  const [openId, setOpen] = useOpen();
  const pane = openId === 'about';
  const setPane = (v: boolean) => setOpen(v ? 'about' : null);
  const [w, setW] = useState<WorkView | null>(null);
  const { say5 } = useShell();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let on = true;
    getWork(id).then((r) => { if (!on) return; if (r) setW(fromLive(r)); else setGone(true); });
    return () => { on = false; };
  }, [id]);

  /**
   * **開いているあいだ、この Work を読み直す**（2.5秒ごと）。
   *
   * **起こすのはここではない**（2026-08-25）。ポンプは器（Shell）に移して
   * 会社ぜんぶを進めるようにしたので、ここで別に起こすと**同じ会社に2つのポンプ**が立つ。
   * 取り合いは atomic claim が捌くが、上限を測る場所が2か所になるのは間違い。
   * ここは**動いている結果を見せるだけ**にする。
   */
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      const r = await getWork(id);
      if (r) setW(fromLive(r));
    };
    const h = window.setInterval(tick, 2500);
    return () => window.clearInterval(h);
  }, [id]);

  if (gone) notFound();
  // 取りに行っているあいだ。**形だけ出して、数字は出さない**
  if (!w) return <Centre><TopBar crumb="Work" title="読み込み中" /><div style={{ flex: 1 }} /></Centre>;

  const live = w.tasks;
  const dels = w.dels;
  const decs = w.decs;
  const late = w.late !== undefined;
  // 右は1枚だけ。openId が指す1件（タスクか成果物か、この Work の説明か）
  const openTask = w.live && openId && openId !== 'about' ? w.tasks.find((t) => t.id === openId) : undefined;
  const openDel = w.live && openId && openId !== 'about' && !openTask ? w.dels.find((d) => d.id === openId) : undefined;
  const w0id = id;

  return (
    <>
      <Centre>
        <TopBar crumb="Work" title={w.title} onPanel={() => setPane(true)} panelOn={!!openId} right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {/* **終わった Work を「進行中」と言わない**（2026-08-25）。
                状態の語は6つだけ — 完了 / 遅れ N日 / 進行中 */}
            <Dot color={w.paused ? `${MUTE}` : late ? `${RED}` : GREEN} size={7} />
            <span style={{ color: w.paused ? T4 : late ? RED_T : GREEN_T, fontSize: 12 }}>
              {w.finished ? '完了' : w.paused ? '一時停止' : late ? `遅れ ${w.late}日` : '進行中'}
            </span>
          </span>
        } />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div>
            <span style={{ fontSize: 20, lineHeight: '30px', display: 'block' }}>{w.title}</span>
            <span style={{ color: T4, fontSize: 13, display: 'block', paddingTop: 6 }}>{w.goal}</span>
          </div>

          {/* フェーズの承認 — review のあいだだけ出る行動の帯（Phase 9） */}
          {w.phaseGate && <PhaseGate name={w.phaseGate} unseen={w.gateUnseen} workId={w0id}
            onDone={() => getWork(id).then((r) => r && setW(fromLive(r)))} />}
          {/* **確かめていないことを言わない**（2026-08-25）。
              前は「成果物がすべて揃っています」と書いていたが、
              できただけで社長は1つも見ていない、ということが実際に起きる */}
          {w.finished && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" color={GREEN_T} size={15} width={2} />
              <span style={{ color: GREEN_T }}>
                この Work は終わりました — 成果物 {w.dels.length}件
              </span>
              {w.unseen > 0 && (
                <span style={{ color: AMBER_T, fontSize: 13 }}>
                  まだ見ていないものが {w.unseen}件
                </span>
              )}
            </div>
          )}

          {/* 事実の帯 — ラベル（小）→ 数字（大）→ **図形**。数で言えるものは文章にしない */}
          <div style={{ display: 'flex', gap: 24 }}>
            {([
              ['進捗',     `${w.progress}%`,                       undefined,                     <Bar key="b" pct={w.progress} />],
              ['フェーズ', `${w.phaseIndex} / ${w.phases.length}`, undefined,                     <Seg key="s" n={w.phases.length} on={w.phaseIndex} />],
              ['判断待ち', w.gate ? '1' : '—',                     w.gate ? AMBER_T : undefined,  w.gate ? <Sub key="g">{w.gate}</Sub> : null],
              ['残り',     w.rest ?? '—',                          late ? RED_T : undefined,      w.endDate ? <Sub key="d">{w.endDate}</Sub> : null],
              ['AI社員',   String(w.crew.length),                  undefined,                     <Pips key="p" cols={w.crew.map((c) => c.color)} />],
            ] as [string, string, string | undefined, React.ReactNode][]).map(([k, v, c, shape], i, arr) => (
              <div key={k} style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5,
                borderRight: i === arr.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ color: T4, fontSize: 12 }}>{k}</span>
                <span style={{ fontSize: 24, lineHeight: '30px', color: c ?? T1 }} className="tnum">{v}</span>
                {shape}
              </div>
            ))}
          </div>

          {/* フェーズ全部。タブに隠さない */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>フェーズ</span>
            {w.phases.map((p, i) => (
              <Link key={p.name} href="/tasks" className="row" style={{
                display: 'flex', alignItems: 'center', gap: 14, height: 46, borderRadius: 7,
                borderBottom: i === w.phases.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  <PhaseMark state={p.state} />
                </span>
                <span style={{ width: 14, flexShrink: 0, color: T5 }} className="tnum">{i + 1}</span>
                <span style={{ width: 110, flexShrink: 0, color: p.state === 'next' ? T5 : T1 }}>{p.name}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', height: 4, borderRadius: 2, background: HAIR, overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 2,
                      width: `${p.all ? Math.round((p.done / p.all) * 100) : 0}%`,
                      background: p.state === 'done' ? GREEN : p.state === 'now' ? `${T4}` : 'transparent',
                    }} />
                  </span>
                </span>
                <span style={{ width: 42, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">
                  {p.done}/{p.all}
                </span>
                <span style={{ width: 92, flexShrink: 0, textAlign: 'right', color: MUTE, fontSize: 11 }} className="tnum">
                  {p.from && p.to ? `${p.from} – ${p.to}` : ''}
                </span>
              </Link>
            ))}
          </div>

          {/* いま動いているもの — フェーズをまたいで並べる */}
          <div>
            <span style={{ color: T3, display: 'block', paddingBottom: 8 }}>いま動いているもの</span>
            {live.length === 0 && <Empty>まだありません。</Empty>}
            {live.map((t, i) => (
              <Row key={t.id} live={!!w.live} onOpen={() => setOpen(t.id)} href={openHref('/tasks', t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44, borderRadius: 7,
                borderBottom: i === live.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ width: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  {t.state === '判断待ち' ? <Diamond size={9} />
                    : t.state === '要確認' ? <Icon name="deliv" color={AMBER_T} size={13} />
                    : t.state === '待機' ? <span style={{ width: 8, height: 8, borderRadius: 999, border: '1px solid #333' }} />
                    : <Dot color={T4} size={8} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ width: 84, color: T5, fontSize: 12 }}>{t.phase ? `フェーズ${t.phase}` : ''}</span>
                <span style={{ width: 78, color: t.mine ? AMBER_T : T4, fontSize: 12 }}>{t.owner}</span>
                <span style={{ width: 52, textAlign: 'right', color: t.state === '判断待ち' ? AMBER_T : T5, fontSize: 12 }} className="tnum">
                  {t.state === '判断待ち' ? '決める' : t.state === '待機' ? '待機' : `${t.progress}%`}
                </span>
              </Row>
            ))}
          </div>

          {/* 成果物 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 8 }}>
              <span style={{ color: T3 }}>成果物</span>
              <div style={{ flex: 1 }} />
              {dels.length > 0 && (
                <Link href="/deliverables" className="lnk" style={{ color: T5, fontSize: 12 }}>すべて表示 ›</Link>
              )}
            </div>
            {dels.length === 0 && <Empty>まだありません。AI社員が出したら、ここに並びます。</Empty>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28 }}>
              {dels.map((d, i) => (
                <Row key={d.id} live={!!w.live} onOpen={() => setOpen(d.id)} href={openHref('/deliverables', d.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 13, height: 56, borderRadius: 7,
                  borderBottom: i >= dels.length - 2 ? undefined : `1px solid ${HAIR}`,
                }}>
                  {/* サムネイルだけは面と枠を持てる */}
                  <span style={{
                    width: 34, height: 26, flexShrink: 0, borderRadius: 4, background: RAIL,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '0 6px',
                  }}>
                    {[10, 16, 13].map((wd, k) => (
                      <span key={k} style={{ height: 2, width: wd, borderRadius: 1, background: FAINT }} />
                    ))}
                  </span>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{d.byName}{d.when && ` · ${d.when}`}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {d.state === '要確認' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                      background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12, whiteSpace: 'nowrap',
                    }}>要確認</span>
                  )}
                </Row>
              ))}
            </div>
          </div>
        </div>

        <Composer placeholder="この Work について統括AIに相談する" mode={w.title} />
      </Centre>

      {pane && (
      <Pane onClose={() => setPane(false)} width={400} icon="work" title="この Work について">
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px' }}>
          <PaneHead top>最新の状況</PaneHead>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0 8px' }}>
            <Dot color={late ? `${RED}` : GREEN} size={7} />
            <span style={{ color: late ? RED_T : GREEN_T }}>
              {late ? `遅れ ${w.late}日` : '順調'}
            </span>
            <span style={{ color: T5, fontSize: 11 }}>統括AI{w.leadWhen ? ` · ${w.leadWhen}` : ''}</span>
          </div>
          <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{w.lead}</span>

          <PaneHead>決めたこと</PaneHead>
          {decs.length === 0 && (
            <Empty>まだありません。判断が要る場面になったら、統括AIが選択肢を出します。</Empty>
          )}
          {decs.map(([when, what], i) => (
            <Link key={what} href="/decisions" className="row" style={{
              display: 'flex', alignItems: 'center', gap: 12, height: 40, borderRadius: 7,
              padding: '0 8px', margin: '0 -8px',
              borderBottom: i === decs.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <span style={{ width: 52, flexShrink: 0, color: T5, fontSize: 11 }}>{when}</span>
              <Icon name="check" color={GREEN_T} size={12} width={2.2} />
              <span style={{ color: T2, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{what}</span>
            </Link>
          ))}

          <PaneHead>AI社員</PaneHead>
          {w.crew.length === 0 && <Empty>まだいません。</Empty>}
          {w.crew.map((c, i) => (
            <Link key={c.id ?? c.name} href={c.id ? openHref('/team', c.id) : '/team'} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 11, height: 44, borderRadius: 7,
              padding: '0 8px', margin: '0 -8px',
              borderBottom: i === w.crew.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <Orb color={c.color} size={24} seed={c.name.length * 7 + 3} dim={Boolean(c.dim)} />
              <span style={{ color: c.dim ? T4 : T2 }}>{c.name}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: c.dim ? T5 : T4, fontSize: 12 }} className="tnum">
                {c.dim ? '待機' : `${c.tasks}タスク`}
              </span>
            </Link>
          ))}

          {/**
            * **止める手**（2026-08-25）。見ていないあいだも会社は動く（1時間ごとの Cron）ので、
            * 気が変わった Work を止められないと、社長は安心して閉じられない。
            * 社員の設定と同じ作法 — **最後の行にトグル、保存ボタンは置かない**。
            * 止めているあいだ、この Work は会社に拾われない（走っている最中のものは最後までやる）。
            */}
          {!w.finished && (
            <>
              <PaneHead>この Work を動かす</PaneHead>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                <span style={{ color: T2, fontSize: 13 }}>{w.paused ? '止めています' : '動いています'}</span>
                <div style={{ flex: 1 }} />
                <Toggle on={!w.paused} label="この Work を動かす"
                  onPick={async (next: boolean) => {
                    setW({ ...w, paused: !next });   // 先に画面を変えて、裏で書く
                    const r = await holdWork(w0id, !next);
                    wakePump(); // 動かし直したなら、その場で動き出す
                    if (!r.ok) say5(r.message ?? '変えられませんでした');
                    getWork(id).then((x) => x && setW(fromLive(x)));
                  }} />
              </div>
              <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>
                {w.paused
                  ? '新しいタスクは起きません。動かすと、続きから進みます。'
                  : '止めると、新しいタスクは起きなくなります。'}
              </span>
            </>
          )}
        </div>
      </Pane>
      )}

      {/* タスクの歩み — 本物のタスク行を押すと開く。実行中は流れる */}
      {openTask && (
      <Pane onClose={() => setOpen(null)} width={400} icon="task" title={openTask.title}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 14 }}>
            <span style={{ color: T4, fontSize: 12 }}>{openTask.owner}</span>
            <span style={{ color: T5, fontSize: 12 }}>{openTask.state}</span>
            {openTask.state === '実行中' && (
              <span style={{ color: T5, fontSize: 12 }} className="tnum">{openTask.progress}%</span>
            )}
          </div>
          {openTask.state === '判断待ち' ? (
            <DecisionPane taskId={openTask.id}
              onDone={() => { setOpen(null); getWork(id).then((r) => r && setW(fromLive(r))); }} />
          ) : (
            <StepsPane taskId={openTask.id} running={openTask.state === '実行中'} />
          )}
        </div>
      </Pane>
      )}

      {/* 成果物の中身 — 本物の成果物を押すと開く */}
      {openDel && (
      <Pane onClose={() => setOpen(null)} width={440} icon="deliv" title={openDel.title}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 12 }}>
            <span style={{ color: T5, fontSize: 11 }}>{openDel.byName}{openDel.when ? ` · ${openDel.when}` : ''}</span>
            {openDel.state === '要確認' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 6,
                background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 11,
              }}>要確認</span>
            )}
            <div style={{ flex: 1 }} />
            {/* **持ち出せない成果物は、無いのと同じ**（→ `components/live/DelTake.tsx`） */}
            <DelTake title={openDel.title} body={openDel.body ?? openDel.preview ?? ''} kind={openDel.kind} />
          </div>
          <DelBody body={openDel.body ?? openDel.preview ?? ''} kind={openDel.kind} />
        </div>
        {/* 社長のレビュー。**押すと本当に変わる**（承認 / 差し戻し → 直しタスク） */}
        <DelActions delId={openDel.id} workId={w0id} taskId={openDel.taskId}
                    title={openDel.title} state={openDel.state}
                    onDone={() => { getWork(id).then((r) => r && setW(fromLive(r))); }} />
      </Pane>
      )}
    </>
  );
}
