'use client';

import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { openHref, useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, Pane, PaneFooter, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Diamond, Icon, type IconName } from '@/components/ui/Icon';
import { worksList } from '@/app/actions/live';
import { taskSteps } from '@/app/actions/run';
import type { LiveWork, RunStep } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { useEffect, useState } from 'react';
import { AMBER, AMBER_T, COMPOSER_H, DIM, GREEN, HAIR, RED, RED_T, RULE, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
import { StuckActions } from '@/components/live/StuckActions';
/**
 * タスク＝**状態で束ねる**。
 *
 * 設計時は「いつやるか（きょう / あした）」で束ねる案だったが、本物のタスクは
 * 期限を持たない（統括AIの計画は順序で言う）。**無い日付をでっち上げない** —
 * 束は「あなたが決める / いま動いている / このあと / 止まっている」の4つ。
 *
 * ・**判断待ちは束から出す。** あなたが決めるものは束の外、いちばん上の帯に置く
 * ・空の束は出さない。**完了は下の1行に畳む**（下に溜めない）
 * ・「追加」ボタンは置かない。タスクは統括AIとの会話から作られる
 */

type Row = {
  id: string; title: string; state: string; progress: number;
  owner?: string; workId: string; workTitle: string; phase: string; phaseSeq: number;
};

/** 状態の語は6つだけ（→ CLAUDE.md）。DB の値をそこに写す */
const WORD: Record<string, string> = {
  queued: '待機', running: '実行中', needs_decision: '判断待ち',
  blocked: '停止', done: '完了', cancelled: '取消',
};

function flatten(works: LiveWork[]): Row[] {
  return works.flatMap((w) => {
    const phase = new Map(w.phases.map((p) => [p.id, p]));
    return w.tasks.map((t): Row => ({
      id: t.id, title: t.title, state: t.state, progress: t.progress ?? 0,
      owner: t.owner, workId: w.id, workTitle: w.title,
      phase: phase.get(t.phaseId)?.name ?? '', phaseSeq: phase.get(t.phaseId)?.seq ?? 0,
    }));
  });
}

function Mark({ s }: { s: string }) {
  if (s === 'running') return <span style={{ width: 7, height: 7, borderRadius: 999, background: GREEN, display: 'inline-block' }} />;
  if (s === 'done') return <Icon name="check" color={DIM} size={12} width={2} />;
  if (s === 'blocked' || s === 'failed') return <span style={{ width: 7, height: 7, borderRadius: 999, background: RED_T, display: 'inline-block' }} />;
  // 取消＝社長が飛ばしたもの。**完了の ✓ と見分ける**（打ち消しの横線）
  if (s === 'cancelled') return <span style={{ width: 9, height: 1, background: DIM, display: 'inline-block' }} />;
  return <span style={{ width: 7, height: 7, borderRadius: 999, border: '1px solid #333', display: 'inline-block' }} />;
}

export default function TasksPage() {
  const [openId, setOpen] = useOpen();
  // 畳んだ完了は URL に持つ（別の画面から戻っても開いたまま）
  const [doneOpen, setDoneOpen] = useParam('done', '');
  const [rows, setRows] = useState<Row[] | null>(null);

  const reload = () => { worksList().then((ws) => setRows(flatten(ws))); };
  useEffect(() => {
    let on = true;
    worksList().then((ws) => { if (on) setRows(flatten(ws)); });
    return () => { on = false; };
  }, []);

  const all = rows ?? [];
  const open = all.find((t) => t.id === openId) ?? null;
  const gates = all.filter((t) => t.state === 'needs_decision');
  const running = all.filter((t) => t.state === 'running');
  const queued = all.filter((t) => t.state === 'queued');
  const stuck = all.filter((t) => t.state === 'blocked' || t.state === 'failed');
  /**
   * **飛ばしたものも「終わったもの」に入れる**（2026-08-26）。
   * 社長が「これは飛ばす」を押すとタスクは `cancelled` になる。
   * 束のどれにも入れないと**画面のどこにも出ないのに「やること」に数えられる**
   * （行の状態は 取消 と出るので、完了と見間違えない）。
   */
  const done = all.filter((t) => t.state === 'done' || t.state === 'cancelled');
  const liveCount = all.length - done.length;

  const bunches: { key: string; label: string; amber?: boolean; items: Row[] }[] = [
    { key: 'run', label: 'いま動いている', items: running },
    { key: 'next', label: 'このあと', items: queued },
    { key: 'stuck', label: '止まっている', items: stuck },
  ].filter((b) => b.items.length > 0);

  return (
    <>
    <Centre>
      <TopBar title="タスク"
        onPanel={all.length ? () => setOpen(all[0].id) : undefined} panelOn={!!open}
        right={all.length > 0
          ? <span style={{ color: T5, fontSize: 12 }} className="tnum">やること {liveCount} · 完了 {done.length}</span>
          : undefined} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 26px ${COMPOSER_H}px` }}>
        {rows !== null && all.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: T2 }}>タスクはまだありません</span>
            <span style={{ color: T5, fontSize: 13 }}>
              ゴールを書くと、統括AIが計画してタスクに割ります — <Link href="/start" className="lnk" style={{ color: T3 }}>はじめる ›</Link>
            </span>
          </div>
        )}

        {all.length > 0 && (
          <>
            {/* 答えを先に1行。図はそのあと（進捗の画面と同じ作法） */}
            <div style={{ fontSize: 16, lineHeight: '26px', paddingBottom: 16 }}>
              {gates.length > 0
                ? <><span style={{ color: AMBER_T }}>決めるのが {gates.length}件</span>。{running.length + queued.length}件は会社の側で進みます。</>
                : <>決めるものはありません。{running.length + queued.length}件が会社の側で進みます。</>}
            </div>

            {/* 判断待ちは束に入れない。あなたが決めるものだけ、面と枠を持つ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gates.map((t) => <GateBand key={t.id} t={t} on={t.id === openId} />)}
            </div>

            {bunches.map((b) => (
              <div key={b.key}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, height: 40, paddingTop: 10 }}>
                  <span style={{ color: T3, fontSize: 12 }}>{b.label}</span>
                  <span style={{ color: DIM, fontSize: 11 }} className="tnum">{b.items.length}</span>
                </div>
                {b.items.map((t) => <TaskRow key={t.id} t={t} on={t.id === openId} onOpen={() => setOpen(t.id)} />)}
              </div>
            ))}

            {/* 終わったものは下に溜めない。1行に畳んで、押したときだけ開く */}
            {done.length > 0 && (
              <div style={{ paddingTop: 22 }}>
                <div className="row" {...pressable(() => setDoneOpen(doneOpen ? '' : '1'))} style={{
                  display: 'flex', alignItems: 'center', gap: 11, height: 40, padding: '0 12px',
                  borderRadius: 8, background: '#0B0B0B',
                }}>
                  <Icon name="check" color={DIM} size={13} width={2} />
                  <span style={{ color: T4, fontSize: 12.5 }}>終わったもの</span>
                  <span style={{ color: T5, fontSize: 12 }} className="tnum">{done.length}件</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ color: T5, fontSize: 12 }}>{doneOpen ? '畳む ›' : '開く ›'}</span>
                </div>
                {doneOpen && done.map((t) => <TaskRow key={t.id} t={t} on={t.id === openId} onOpen={() => setOpen(t.id)} />)}
              </div>
            )}
          </>
        )}
      </div>

      <Composer placeholder="統括AIに頼む" />
    </Centre>

    {open && <TaskPane t={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

/**
 * 束の中の1行。**状態の列を置かない**（印がタイトルの前にある）。
 * 事実は右に並べる — 進捗のバー / 担当 / どの Work か。
 */
function TaskRow({ t, on, onOpen }: { t: Row; on: boolean; onOpen: () => void }) {
  const fin = t.state === 'done';
  return (
    <div className="row" {...pressable(onOpen)} style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 43,
      borderTop: `1px solid ${HAIR}`, background: on ? '#0C0C0C' : undefined,
    }}>
      <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
        <Mark s={t.state} />
      </span>
      <span style={{
        flex: 1, minWidth: 0, color: fin ? T5 : T1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{t.title}</span>
      <span style={{ width: 74, height: 3, borderRadius: 2, background: SUNK, overflow: 'hidden', flexShrink: 0 }}>
        <span style={{
          display: 'block', width: `${t.progress}%`, height: '100%', borderRadius: 2,
          background: fin ? `${RULE}` : T5,
        }} />
      </span>
      <span style={{ width: 76, flexShrink: 0, color: T4, fontSize: 12 }}>{t.owner ?? ''}</span>
      {/* 行は開く、中のリンクは別の画面へ。食い合わないように止める */}
      {/* **切れていて正しい**（`clip`）— 主役はタスク名で、これはどの Work かの副次ラベル。
          広げるとタイトルの列を食う。長い会社の名前が来ても、行の形は変わらない */}
      <Link href={`/work/${t.workId}` as Route} onClick={(e) => e.stopPropagation()} className="lnk clip" style={{
        width: 140, flexShrink: 0, textAlign: 'right', color: fin ? `${DIM}` : T5, fontSize: 12,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{t.workTitle}</Link>
    </div>
  );
}

/** あなたが決めるもの。**束の外に出して、いちばん上に置く。** 決める場は Work 画面の右ペイン */
function GateBand({ t, on }: { t: Row; on: boolean }) {
  return (
    <Link href={openHref(`/work/${t.workId}`, t.id)} className="row" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12,
      background: on ? 'rgba(227,116,0,0.10)' : 'rgba(227,116,0,0.055)',
      border: '1px solid rgba(227,116,0,0.42)',
    }}>
      <Diamond size={11} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14.5, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
        <span style={{ color: T5, fontSize: 11.5 }}>{t.workTitle} · フェーズ{t.phaseSeq} · あなたの判断を待っています</span>
      </div>
      <div style={{ flex: 1 }} />
      <span className="solid" style={{
        display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 16px',
        borderRadius: 8, background: AMBER, color: '#fff', flexShrink: 0, fontSize: 12.5,
      }}>決める</span>
    </Link>
  );
}

/** 1行を開いた先。フィールドと、実行の歩み（run_steps）。無いものは出さない */
function TaskPane({ t, onClose, onChanged }: { t: Row; onClose: () => void; onChanged: () => void }) {
  /**
   * **まだ分からないあいだ、「まだ動いていません」と言わない**（2026-08-26）。
   * `[]` から始めていたので、取りに行っている数百 ms のあいだ**動いているタスクにも**
   * 「まだ動いていません。」が出て、そのあと歩みが現れていた。
   * 無いのと、まだ知らないのは別のこと（`null` ＝ まだ知らない）。
   */
  const [steps, setSteps] = useState<RunStep[] | null>(null);
  useEffect(() => {
    let on = true;
    taskSteps(t.id).then((s) => { if (on) setSteps(s); });
    return () => { on = false; };
  }, [t.id]);

  const gate = t.state === 'needs_decision';
  /** **止まっている。** ここだけは行動がある — 戻り道が無いと Work ごと死ぬ */
  const stuck = t.state === 'blocked' || t.state === 'failed';
  const barColor = gate ? AMBER : t.state === 'done' ? `${GREEN}` : T4;
  return (
    <Pane width={420} onClose={onClose}
      dot={gate ? AMBER : stuck ? RED : t.state === 'done' ? `${GREEN}` : T5}
      title={t.title}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px' }}>
        <PaneHead top>フィールド</PaneHead>
        <PaneRow icon="check" label="状態">
          {gate || stuck ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
              background: gate ? 'rgba(227,116,0,0.18)' : 'rgba(217,48,37,0.18)',
              color: gate ? AMBER_T : RED_T, fontSize: 12,
            }}>{gate ? '判断待ち' : '停止'}</span>
          ) : <span style={{ color: T1, fontSize: 12.5 }}>{WORD[t.state] ?? t.state}</span>}
        </PaneRow>
        <PaneRow icon="bars" label="進捗">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'block', width: 74, height: 4, borderRadius: 2, background: SUNK }}>
              <span style={{ display: 'block', width: `${t.progress}%`, height: '100%', borderRadius: 2, background: barColor }} />
            </span>
            <span style={{ color: T1, fontSize: 12.5 }} className="tnum">{t.progress}%</span>
          </span>
        </PaneRow>
        {t.owner && <PaneRow icon="team" label="担当"><span style={{ color: T1, fontSize: 12.5 }}>{t.owner}</span></PaneRow>}
        <PaneRow icon="work" label="Work"><span style={{ color: T1, fontSize: 12.5 }}>{t.workTitle}</span></PaneRow>
        {t.phase && <PaneRow icon="roadmap" label="フェーズ"><span style={{ color: T1, fontSize: 12.5 }}>{t.phase}</span></PaneRow>}

        {/**
          * **止まったタスクは、ここから戻れる**（2026-08-26 → `components/live/StuckActions.tsx`）。
          * 前はここに理由も行動も無く、フェーズは永久に閉じなかった。
          * 押したら一覧も読み直す — 状態が変わったのに、開いているペインだけ古い、を作らない。
          */}
        {stuck && <>
          <PaneHead>止まっています</PaneHead>
          <StuckActions key={t.id} taskId={t.id} onDone={onChanged} />
        </>}

        {steps !== null && steps.length > 0 && <>
          <PaneHead>歩み</PaneHead>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(steps ?? []).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32, borderTop: i ? `1px solid ${HAIR}` : undefined }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: T5, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, color: T3, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.summary}
                </span>
                {s.progress != null && <span style={{ color: T5, fontSize: 11.5 }} className="tnum">{s.progress}%</span>}
              </div>
            ))}
          </div>
        </>}
        {steps !== null && steps.length === 0 && !gate && !stuck && (
          <span style={{ display: 'block', paddingTop: 16, color: T5, fontSize: 12.5 }}>まだ動いていません。</span>
        )}
      </div>
      <PaneFooter primary={gate ? '判断する' : 'Work を開く'}
        primaryHref={gate ? openHref(`/work/${t.workId}`, t.id) : (`/work/${t.workId}` as Route)} />
    </Pane>
  );
}

/** ペインのフィールド1行。アイコンは裸で置く */
function PaneRow({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34 }}>
      <Icon name={icon} color={DIM} size={13} />
      <span style={{ width: 62, color: T5, fontSize: 12.5 }}>{label}</span>
      {children}
    </div>
  );
}
