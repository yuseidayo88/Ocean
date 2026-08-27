'use client';

import { openHref } from '@/lib/use-open';

import { useOpen, useParam } from '@/lib/use-open';
import { Go as Link } from '@/components/ui/Go';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Centre, Composer, Pane, PaneHead, PaneLoading, TopBar } from '@/components/shell/Chrome';
import { Toggle } from '@/components/shell/Controls';
import { useShell } from '@/components/shell/Shell';
import { Diamond, Dot, Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AMBER_T, BLUE, COMPOSER_H, DIM, GREEN, GREEN_T, HAIR, MUTE, RED, RED_T, SEAM, SUNK, T1, T2, T3, T4, T5, WELL } from '@/lib/design/tokens';
import { fromLive, type WorkPhase, type WorkView } from '@/lib/exec/work-view';
import { getWork } from '@/app/actions/work';
import { approvePhase, holdWork, taskSteps } from '@/app/actions/run';
import { openWorkChat } from '@/app/actions/chat';
import { wakePump } from '@/lib/pump';
import { DelActions } from '@/components/live/DelActions';
import { DecisionPick } from '@/components/live/DecisionPick';
import { StuckActions } from '@/components/live/StuckActions';
import { DelBody } from '@/components/live/DelBody';
import { DelTake } from '@/components/live/DelTake';
import { DelThumb } from '@/components/live/DelThumb';
import type { RunStep } from '@/lib/store';
import { useEffect, useState } from 'react';
import { pressable } from '@/lib/a11y';
import type { Route } from 'next';
import { ago } from '@/lib/when';
import { formatOf } from '@/lib/deliver/format';

/**
 * Work＝会話を持たない。一目で状況が分かる1枚（参考: Upwork / Squarespace / Linear）。
 * 上に事実の帯 → フェーズ全部 → いま動いていること → 成果物。タブに隠さない。
 * 相談は「統括AIに相談する」でチャットへ飛ぶ。
 *
 * **読む形は1つ**（`WorkView`）。ダミー（Phase 4）でも、承認して動きだした本物でも同じ画面。
 * 無いもの（成果物・決定・日付）は**無いと出す**。埋めるために数字を作らない。
 */

/** 数字の下に置く図形。文章で言い直さない */
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
function Row({ live, onOpen, href, style, state, children }: {
  live: boolean; onOpen: () => void; href: Parameters<typeof Link>[0]['href'];
  style: React.CSSProperties; state?: string; children: React.ReactNode;
}) {
  if (!live) return <Link href={href} className="row" style={style} data-state={state}>{children}</Link>;
  return (
    <button onClick={onOpen} className="row" style={{ ...style, width: '100%', textAlign: 'left' }} data-state={state}>
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
 * タスクの歩み（右ペイン）。**開いているあいだだけ**2秒ごとに読み直す。
 * 実行中は最後の行が動き続けるので、流れて見える。
 */
function StepsPane({ taskId, running }: { taskId: string; running: boolean }) {
  /**
   * **まだ分からないあいだ、「まだ動いていません」と言わない**（2026-08-26）。
   * `[]` から始めていたので、取りに行っているあいだ**動いているタスクにも**
   * 「まだ動いていません。」が出て、そのあと歩みが現れていた。
   */
  const [steps, setSteps] = useState<RunStep[] | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => taskSteps(taskId).then((r) => { if (on) setSteps(r); });
    load();
    if (!running) return () => { on = false; };
    const h = window.setInterval(load, 2000);
    return () => { on = false; window.clearInterval(h); };
  }, [taskId, running]);

  if (steps === null) return <PaneLoading lines={3} />;
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
const PhaseMark = ({ state }: { state: WorkPhase['state'] }) => {
  if (state === 'done') return <Icon name="check" color={GREEN_T} size={13} width={2.2} />;
  // **終わって社長の番**（review）。緑にすると済んだものと見分けがつかない
  if (state === 'wait') return <Icon name="check" color={AMBER_T} size={13} width={2.2} />;
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
  /** 選んでいるフェーズ（`?ph=<番号>`）。空＝ぜんぶ */
  const [ph, setPh] = useParam('ph', '');
  const pane = openId === 'about';
  const setPane = (v: boolean) => setOpen(v ? 'about' : null);
  const [w, setW] = useState<WorkView | null>(null);
  const { say5 } = useShell();
  const [gone, setGone] = useState(false);
  const router = useRouter();
  /** その Work の会話へ。**無ければ作る**ので、押して何も起きない、が起きない */
  const [toChat, setToChat] = useState(false);
  const goChat = async () => {
    setToChat(true);
    const r = await openWorkChat(id);
    if (r.ok) router.push(`/chat/${r.threadId}` as Route);
    else { setToChat(false); say5(r.message); }
  };

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

  /**
   * **Esc でフェーズの選びを外す**（右ペインと同じ作法。→ CLAUDE.md「Esc で閉じる」）。
   * ペインが開いているあいだは、そちらが先に閉じる — Esc を1回で2つ閉じない。
   */
  useEffect(() => {
    if (!ph) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !openId) setPh(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ph, openId, setPh]);

  if (gone) notFound();
  // 取りに行っているあいだ。**形だけ出して、数字は出さない**
  if (!w) return <Centre><TopBar crumb="Work" title="読み込み中" /><div style={{ flex: 1 }} /></Centre>;

  /**
   * **フェーズを選ぶと、下がそのフェーズだけになる**（2026-08-26）。
   *
   * 前はフェーズの4行が**どれも同じ `/tasks`（絞り込みなし）へ飛んでいた** —
   * 押した先で「このフェーズの話」がどこにも無いので、答えていない。
   * ワークフローの地図と同じ作法にする（→ CLAUDE.md「押しても盤面から出ない。
   * その鎖だけが残ってほかが沈む」）。**選んでいる1件は URL に持つ**（`?ph=2`）。
   */
  const at = Number(ph) || 0;
  /**
   * **動いているものが先、済んだものは下**（2026-08-27）。
   * 順番は状態で決める — 判断待ち（あなたの番）→ 停止 → 実行中 → 待機 → 済んだもの。
   * 同じ組の中では、引かれた順（`w.tasks` の並び）のまま。
   */
  const RANK: Record<string, number> = { 判断待ち: 0, 停止: 1, 実行中: 2, 待機: 3 };
  const live = (at ? w.tasks.filter((t) => t.phase === at) : w.tasks)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => ((RANK[a.t.state] ?? 9) - (RANK[b.t.state] ?? 9)) || (a.i - b.i))
    .map((x) => x.t);
  const phaseOfTask = new Map(w.tasks.map((t) => [t.id, t.phase]));
  const dels = at ? w.dels.filter((d) => !!d.taskId && phaseOfTask.get(d.taskId) === at) : w.dels;
  const decs = w.decs;
  const late = w.late !== undefined;
  /** いまどのフェーズか。全部済んでいれば最後のフェーズまで来ている */
  const nowFound = w.phases.findIndex((p) => p.state === 'now' || p.state === 'wait');
  const nowI = nowFound >= 0 ? nowFound : w.phases.length - 1;
  const nowP = w.phases[nowI];
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
            {/**
              * **いまの状況を、中央に出す**（2026-08-27）。
              *
              * この1行（「『案出し』を進めています。いまは 企画担当 が『案を3つ出す』の
              * 途中です。」）は**この画面でいちばん人の言葉に近い**のに、
              * **閉じた右ペインの中にだけ**あった。数字の帯は開けば見えるが、
              * 「誰が何をしているか」は開かないと分からない、という並びになっていた。
              * ここに出したので、右ペインからは外した（同じことを1画面で二度言わない）。
              *
              * **行動の帯が出ているときは出さない。** そのときは帯が同じことを言っていて
              * （「『案出し』が終わりました。成果物 2件 を見て…」の下に
              * 「『案出し』のタスクが終わりました。成果物を見てください。」）、
              * ほとんど同じ文が2行続いていた。
              */}
            {w.live && !w.unapproved && !w.gateAsk && !w.phaseGate && !w.finished && (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 9, paddingTop: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 21, flexShrink: 0 }}>
                  <Dot color={w.paused ? `${MUTE}` : late ? `${RED}` : GREEN} size={7} />
                </span>
                <span style={{ color: T2, fontSize: 13, lineHeight: '21px' }}>{w.lead}</span>
              </span>
            )}
          </div>

          {/**
            * **まだ承認していない Work は、承認へ連れていく**（2026-08-26）。
            * 承認前の Work も `listWorks` に出るので、レールの「Work」や ⌘K から
            * ここへ来られる。それなのに画面には「まだ始まっていません。」としか出ておらず、
            * **計画へ戻る道が無かった** — 承認しないと何も始まらないのに。
            */}
          {w.unapproved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12,
              background: 'rgba(26,115,232,0.06)', border: `1px solid rgba(26,115,232,0.34)`,
            }}>
              <span style={{ color: T2, fontSize: 13.5 }}>
                この Work はまだ始まっていません。計画を承認すると動きだします
              </span>
              <div style={{ flex: 1 }} />
              <Link href={`/work/${w0id}/plan` as Route} className="solid" style={{
                display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 16px',
                borderRadius: 8, background: BLUE, color: '#fff', fontSize: 12.5, flexShrink: 0,
              }}>計画を見る</Link>
            </div>
          )}

          {/**
            * **◆ は、本物の問いとして出す**（2026-08-26）。
            *
            * 計画の画面は「あなたが決めるのは ◆ の N か所」と言い、軸の上に
            * `どの案で進めるか` と書く。それなのに前は **◆ が「そこで止まる」印にしか
            * なっておらず**、社長は最後まで一度も聞かれなかった（決定事項も空のまま）。
            * いまは統括AIが、そのフェーズの成果物から選択肢を作って聞く。
            *
            * **決めるのが先。** ここが出ているあいだ「次のフェーズへ進める」は出さない —
            * 決まればポンプが自分で次を引く（`gate()` が関門を測り直す）。
            */}
          {w.gateAsk ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10, padding: '15px 17px',
              borderRadius: 12, background: 'rgba(227,116,0,0.06)',
              border: '1px solid rgba(227,116,0,0.34)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <Diamond size={10} />
                <span style={{ color: AMBER_T, fontSize: 12.5 }}>
                  フェーズ「{w.phaseGate ?? ''}」が終わりました。決めて、次に進めてください
                </span>
              </span>
              <DecisionPick given={w.gateAsk}
                onDone={() => { wakePump(); getWork(id).then((r) => r && setW(fromLive(r))); }} />
            </div>
          ) : w.phaseGate ? (
            <PhaseGate name={w.phaseGate} unseen={w.gateUnseen} workId={w0id}
              onDone={() => getWork(id).then((r) => r && setW(fromLive(r)))} />
          ) : null}
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

          {/**
            * 事実の帯 — ラベル（小）→ 数字（大）→ **図形**。数で言えるものは文章にしない。
            *
            * **5つとも別のことを言う**（2026-08-27）。前はそうなっていなかった —
            * ① `進捗` と `フェーズ` が隣り合って**違うことを言っていた**（実測「100% / 1 of 2」）。
            *    進捗をフェーズで数えるようにしたので、いまは同じことの2つの言い方 →
            *    **数字は進捗、形はフェーズの刻み**にして1つに畳んだ。
            * ② `判断待ち` は `gate` を誰も埋めておらず、**どの Work でも永久に「—」**だった。
            * 空いた1つには**成果物**を置く。社長がこの画面でやることは、
            *   見て決めることなので、その数が帯に無いのはおかしい。
            */}
          <div style={{ display: 'flex', gap: 24 }}>
            {([
              ['進捗',     `${w.progress}%`,                       undefined,                     <span key="s" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Seg n={w.phases.length} on={w.phases.filter((p) => p.state === 'done' || p.state === 'wait').length} />
                {/* **刻みの読み方**。数字だけを別の列にすると、進捗と隣り合って
                    同じことを二度言うことになる（前がそうだった）。ここなら形の見出し */}
                {nowP && <Sub>フェーズ {nowI + 1} / {w.phases.length} · {nowP.name}</Sub>}
              </span>],
              ['判断待ち', w.gate ? '1' : '—',                     w.gate ? AMBER_T : undefined,  w.gate ? <Sub key="g">{w.gate}</Sub> : null],
              ['成果物',   String(w.dels.length),                  undefined,                     w.unseen > 0 ? <Sub key="u"><span style={{ color: AMBER_T }}>要確認 {w.unseen}</span></Sub> : null],
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
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 8 }}>
              <span style={{ color: T3 }}>フェーズ</span>
              <div style={{ flex: 1 }} />
              {/**
                * **承認したあとも、計画へ戻れる**（2026-08-27）。
                * 前は「計画を見る」が**承認前だけ**だった。社長が読んで承認したのは
                * なぜこの順番か / 前提にしていること / 見送った案 で、
                * それはこの並びの根拠そのものなのに、押した瞬間に永久に読めなくなっていた。
                */}
              {w.live && !w.unapproved && (
                <Link href={`/work/${w0id}/plan` as Route} className="lnk" style={{ color: T5, fontSize: 12 }}>
                  承認した計画 ›
                </Link>
              )}
            </div>
            {w.phases.map((p, i) => (
              /**
               * **押しても Work 画面から出ない。** 選ぶとそのフェーズだけが残り、ほかは沈む。
               * 下の「いま動いているもの」と「成果物」も一緒に絞られる。
               * 外し方は2つ — 同じ行をもう一度押す / Esc（→ `onKeyDown`）。
               */
              <div key={p.name} className="row" {...pressable(() => setPh(at === i + 1 ? '' : String(i + 1)))} style={{
                display: 'flex', alignItems: 'center', gap: 14, minHeight: 54, borderRadius: 7,
                borderBottom: i === w.phases.length - 1 ? undefined : `1px solid ${HAIR}`,
                opacity: at && at !== i + 1 ? 0.4 : 1,
                background: at === i + 1 ? '#0E0E0E' : undefined,
              }}>
                <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  <PhaseMark state={p.state} />
                </span>
                <span style={{ width: 14, flexShrink: 0, color: T5 }} className="tnum">{i + 1}</span>
                {/**
                  * **名前だけでなく、ねらいと担当を出す**（2026-08-27）。
                  * 計画の画面は「名前 ＋ ねらい ＋ 担当 ＋ 週数」を並べ、社長はそれを読んで
                  * 承認する。承認した瞬間に**ねらいと担当が消えて名前だけ**になっていた —
                  * 承認したものと、その後の画面が別物になっていた。
                  */}
                <span style={{ width: 210, flexShrink: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: p.state === 'next' ? T5 : T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {p.goal && <Sub>{p.goal}</Sub>}
                </span>
                <span style={{ width: 74, flexShrink: 0, color: p.state === 'next' ? MUTE : T4, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.owner ?? ''}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 2,
                      width: `${p.all ? Math.round((p.done / p.all) * 100) : 0}%`,
                      // **帯が測るのはタスク。** 終わって社長待ち（wait）でもタスクは終わっているので緑。
                      // 「あなたの番」は行の先頭の印が言う（帯まで橙にすると、同じことを二度言う）
                      background: p.state === 'done' || p.state === 'wait' ? GREEN : p.state === 'now' ? `${T3}` : 'transparent',
                    }} />
                  </span>
                </span>
                {/**
                  * **◆ は、来る前から見えている**（2026-08-27）。計画で承認した関門を、
                  * そのフェーズの行に立てる。いつ自分の番が来るかが、承認した瞬間に
                  * 分からなくなっていた（帯に出るのは、来てからだけだった）。
                  */}
                <span style={{
                  width: 132, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                  // 済んだフェーズの ◆ は**もう決めたこと**。橙のまま置くと、あなたの番に見える
                  opacity: p.state === 'done' ? 0.45 : 1,
                }}>
                  {p.gate && <><Diamond size={8} /><Sub>{p.gate}</Sub></>}
                </span>
                <span style={{ width: 42, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 12 }} className="tnum">
                  {p.done}/{p.all}
                </span>
                <span style={{ width: 92, flexShrink: 0, textAlign: 'right', color: MUTE, fontSize: 11 }} className="tnum">
                  {p.from && p.to ? `${p.from} – ${p.to}` : ''}
                </span>
              </div>
            ))}
          </div>

          {/**
            * タスク — 既定はフェーズをまたいで並べる。1つ選ぶとそのフェーズだけ。
            *
            * **済んだものも出す**（2026-08-27）。前は「いま動いているもの」だけを並べていたので、
            * **走っているものが1つも無い時間は、節がまるごと「まだありません。」**だった
            * （実測で、フェーズが閉じて社長を待っているあいだ ずっとそう）。
            * AI社員が何をやったかは、この Work の記録そのもの — 動いているものを先に、
            * 済んだものは沈めて下に置く。
            */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 8 }}>
              <span style={{ color: T3 }}>タスク</span>
              <div style={{ flex: 1 }} />
              {/* **絞っていることと、その外し方を1つで言う**（説明のコピーは置かない） */}
              {at > 0 && (
                <button onClick={() => setPh('')} className="lnk" style={{ color: T5, fontSize: 12 }}>
                  フェーズ{at} だけ · すべて見る
                </button>
              )}
            </div>
            {live.length === 0 && <Empty>{at > 0 ? 'このフェーズのタスクはまだありません。' : 'まだありません。'}</Empty>}
            {live.map((t, i) => (
              <Row key={t.id} live={!!w.live} onOpen={() => setOpen(t.id)} href={openHref('/tasks', t.id)} state={t.state} style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44, borderRadius: 7,
                opacity: t.past ? 0.5 : 1,
                borderBottom: i === live.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ width: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                  {t.state === '判断待ち' ? <Diamond size={9} />
                    : t.state === '停止' ? <Dot color={RED} size={8} />
                    : t.state === '完了' ? <Icon name="check" color={GREEN_T} size={12} width={2.2} />
                    : t.state === '待機' ? <span style={{ width: 8, height: 8, borderRadius: 999, border: '1px solid #333' }} />
                    : t.state === '実行中' ? <span style={{ width: 8, height: 8, borderRadius: 999, background: GREEN_T, animation: 'pulse 1.6s ease-in-out infinite' }} />
                    : <Dot color={T4} size={8} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ width: 84, color: T5, fontSize: 12 }}>{t.phase ? `フェーズ${t.phase}` : ''}</span>
                <span style={{ width: 78, color: T4, fontSize: 12 }}>{t.owner}</span>
                {/* **状態の語は6つだけ。** 進捗の数字は、走っている最中にだけ意味がある */}
                <span className="tnum" style={{ width: 52, textAlign: 'right', fontSize: 12,
                  color: t.state === '判断待ち' ? AMBER_T : t.state === '停止' ? RED_T : T5 }}>
                  {t.state === '実行中' ? `${t.progress}%` : t.state}
                </span>
              </Row>
            ))}
          </div>

          {/* 成果物 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', paddingBottom: 8 }}>
              <span style={{ color: T3 }}>成果物</span>
              <div style={{ flex: 1 }} />
              {/* **絞っていることと、その外し方を1つで言う**（タスクの節と同じ形） */}
              {at > 0 && (
                <button onClick={() => setPh('')} className="lnk" style={{ color: T5, fontSize: 12 }}>
                  フェーズ{at} だけ · すべて見る
                </button>
              )}
            </div>
            {dels.length === 0 && <Empty>{at > 0 ? 'このフェーズの成果物はまだありません。' : 'まだありません。AI社員が出したら、ここに並びます。'}</Empty>}
            {/**
              * **サムネイルは実際の書き出し**（2026-08-27。成果物の画面と同じ `DelThumb`）。
              *
              * ここだけ**灰色の棒3本**を描いていたので、2枚並ぶとどちらも同じ絵で、
              * 開くまで見分けられなかった（`preview` は最初から渡っていたのに使っていない）。
              * → CLAUDE.md「**中身が主役** → サムネイルに**実際の書き出し**を出す」。
              *
              * 列は器が決める（画面ごとのブレークポイントは作らない）。
              * 右ペインを開くと中央が狭くなるので、入るぶんだけ並ぶ。
              */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 12 }}>
              {dels.map((d) => (
                <div key={d.id} className="card" data-state={d.state} {...pressable(() => setOpen(d.id))} style={{
                  boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
                  padding: 12, borderRadius: 12, background: '#121212',
                }}>
                  <DelThumb preview={d.preview} src={d.src} height={84} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                      {/* **直した版だと分かるようにする**（v2〜だけ。差し戻すのはこの画面） */}
                      {(d.version ?? 1) > 1 && <span style={{ color: T5, fontSize: 11, flexShrink: 0 }} className="tnum">v{d.version}</span>}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: T5, fontSize: 12 }}>{d.byName}</span>
                      {ago(d.when) && <span style={{ color: MUTE, fontSize: 11.5 }}>{ago(d.when)}</span>}
                      <span style={{ color: MUTE, fontSize: 11.5 }}>{formatOf(d.kind, d.preview).label}</span>
                      <div style={{ flex: 1 }} />
                      {d.state === '要確認' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 6,
                          background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 12, whiteSpace: 'nowrap',
                        }}>要確認</span>
                      )}
                      {d.state === '承認済' && <Dot color={GREEN} size={7} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Composer placeholder="この Work について統括AIに相談する" mode={w.title} />
      </Centre>

      {pane && (
      <Pane onClose={() => setPane(false)} width={400} icon="work" title="この Work について">
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px' }}>
          {/**
            * **「最新の状況」はここから外した**（2026-08-27）。中央の、題のすぐ下に出している —
            * この画面でいちばん人の言葉に近い1行が、**閉じたペインの中にだけ**あった。
            *
            * かわりに置いたのが**戻り道2つ**。Work は、承認した計画から生まれ、
            * ある会話から生まれる。それなのに**どちらにも戻れなかった**。
            */}
          <PaneHead top>もとになったもの</PaneHead>
          <Link href={`/work/${w0id}/plan` as Route} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 11, height: 40, borderRadius: 7,
            padding: '0 8px', margin: '0 -8px', borderBottom: `1px solid ${HAIR}`,
          }}>
            <Icon name="roadmap" color={T4} size={14} />
            <span style={{ color: T2, fontSize: 12.5 }}>承認した計画</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: T5, fontSize: 11 }}>なぜこの順番か</span>
          </Link>
          {/* **押した先は必ず1本ある**（無ければ作る → `openWorkChat`） */}
          <button onClick={goChat} disabled={toChat} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 11, height: 40, borderRadius: 7, width: '100%',
            padding: '0 8px', margin: '0 -8px', textAlign: 'left',
          }}>
            <Icon name="chat" color={T4} size={14} />
            <span style={{ color: T2, fontSize: 12.5 }}>この Work の会話</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: T5, fontSize: 11 }}>{toChat ? '開いています…' : '統括AIに相談する'}</span>
          </button>

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
              <span style={{ width: 52, flexShrink: 0, color: T5, fontSize: 11 }}>{ago(when)}</span>
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
            <DecisionPick taskId={openTask.id}
              onDone={() => { setOpen(null); getWork(id).then((r) => r && setW(fromLive(r))); }} />
          ) : openTask.state === '停止' ? (
            /**
             * **止まったタスクは、ここから戻れる**（2026-08-26）。
             * 止まったものが1つ残るとフェーズは永久に閉じず、この Work は二度と進まない。
             * 歩みを見せるだけでは、社長にできることが1つも無い。
             */
            <StuckActions key={openTask.id} taskId={openTask.id}
              onDone={() => { getWork(id).then((r) => r && setW(fromLive(r))); }} />
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
            <span style={{ color: T5, fontSize: 11 }}>
              {openDel.byName}{ago(openDel.when) ? ` · ${ago(openDel.when)}` : ''}{(openDel.version ?? 1) > 1 ? ` · v${openDel.version}` : ''}
            </span>
            {openDel.state === '要確認' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 6,
                background: 'rgba(227,116,0,0.18)', color: AMBER_T, fontSize: 11,
              }}>要確認</span>
            )}
            <div style={{ flex: 1 }} />
            {/* **持ち出せない成果物は、無いのと同じ**（→ `components/live/DelTake.tsx`） */}
            <DelTake title={openDel.title} body={openDel.body ?? openDel.preview ?? ''} kind={openDel.kind} src={openDel.src} />
          </div>
          <DelBody body={openDel.body ?? openDel.preview ?? ''} kind={openDel.kind} src={openDel.src} />
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
