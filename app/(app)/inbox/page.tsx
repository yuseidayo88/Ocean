'use client';

import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { openHref, useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { notesList, readNote } from '@/app/actions/live';
import { inboxAct, type InboxAct } from '@/app/actions/run';
import { DecisionPick } from '@/components/live/DecisionPick';
import { StuckActions } from '@/components/live/StuckActions';
import { DelActions } from '@/components/live/DelActions';
import { DelBody } from '@/components/live/DelBody';
import type { Note } from '@/lib/store';
import { pressable } from '@/lib/a11y';
import { ago } from '@/lib/when';
import { useEffect, useState } from 'react';
import { AMBER, AMBER_T, BLUE, COMPOSER_H, DIM, EDGE, FAINT, HAIR, RED, RED_T, SEAM, T1, T2, T3, T5 } from '@/lib/design/tokens';
/**
 * 通知＝**読むものではなく片づけるもの**
 * （参考: Linear Inbox / Plane Inbox / Lemni — 履歴を流すのをやめて、左に積み・右で片づける）。
 *
 * ・右ペインは使わない。**画面そのものが2列**（左＝未処理の積み / 右＝中身と行動）
 * ・左はいつも1件選ばれている（あるとき）。**この画面から出ずに終わる** — 開いて、済ませて、次へ
 * ・行動の行は入力欄に隠さない（`COMPOSER_H` ぶん上に置く）
 * ・中身は store の notifications だけ。**未読が未処理**、読んだら済んだもの
 */

/** 左の列の幅。ここだけ固定して、右は残り全部 */
const LEFT = 300;

const TONE: Record<string, { line: string; text: string; face: string }> = {
  '判断待ち':   { line: AMBER, text: AMBER_T, face: 'rgba(227,116,0,0.16)' },
  '要確認':     { line: AMBER, text: AMBER_T, face: 'rgba(227,116,0,0.16)' },
  'エラー':      { line: RED,   text: RED_T,   face: 'rgba(217,48,37,0.16)' },
};
const toneOf = (kind: string) => TONE[kind] ?? TONE['要確認'];

/** 通知の題と補足。本文の1行を「—」で分ける（統括AIの書き方に合わせる） */
function split(body: string): { title: string; sub: string } {
  const i = body.indexOf(' — ');
  if (i < 0) return { title: body, sub: '' };
  return { title: body.slice(0, i), sub: body.slice(i + 3) };
}

/** 開く先。**通知が指しているもの**へ（無ければ行き先を出さない） */
function hrefOf(n: Note): Route | null {
  if (n.subjectType === 'task' && n.subjectId) return openHref('/tasks', n.subjectId);
  if (n.subjectType === 'work' && n.subjectId) return `/work/${n.subjectId}` as Route;
  if (n.subjectType === 'employee' && n.subjectId) return openHref('/team', n.subjectId);
  if (n.subjectType === 'phase') return '/work' as Route;
  return null;
}

export default function InboxPage() {
  const [openId, setOpen] = useOpen();
  // 済んだものに切り替えたかどうかは URL に持つ（戻ってきても同じ側を見ている）
  const [done, setDone] = useParam('done', '');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const reload = () => { notesList().then(setNotes); };
  useEffect(reload, []);

  const all = notes ?? [];
  const fresh = all.filter((n) => !n.read);
  const handled = all.filter((n) => n.read);
  const list = done ? handled : fresh;
  /** 1件も来ていない会社。**言葉だけ変える**（器は同じ2列のまま） */
  const none = notes !== null && all.length === 0;
  const at = Math.max(list.findIndex((n) => n.id === openId), 0);
  const item = list[at] as Note | undefined;
  const next = list[at + 1] ?? list[0];
  const flip = (to: boolean) => { setDone(to ? '1' : ''); setOpen(null); };

  const settle = async (n: Note) => { await readNote(n.id); reload(); if (next && next.id !== n.id) setOpen(next.id); };

  /**
   * **いま社長にできること**（`inboxAct`）。画面が1回だけ取りに行き、
   * 右の中身にも「開く」の行き先にも同じものを使う。
   * 前の通知のぶんが残らないよう、**どの通知のものか**を一緒に持つ。
   */
  const [act, setAct] = useState<{ id: string; act: InboxAct } | null>(null);
  const itemId = item?.id, itemType = item?.subjectType, itemSub = item?.subjectId;
  useEffect(() => {
    if (!itemId) return;
    let on = true;
    inboxAct(itemType, itemSub).then((a) => { if (on) setAct({ id: itemId, act: a }); });
    return () => { on = false; };
  }, [itemId, itemType, itemSub]);
  const cur = act && act.id === itemId ? act.act : null;

  /**
   * **「開く」は、その用件そのものへ**（2026-08-26）。
   * 前は通知の subject（タスク）だけを見て `/tasks?open=…` に落としていたので、
   * **いちばん多い「成果物ができました」でタスクの歩みが開いていた** — 用件は成果物なのに。
   */
  const openTo: Route | null = cur
    ? cur.kind === 'deliverable' ? openHref('/deliverables', cur.delId)
      : cur.kind === 'decision' ? openHref(`/work/${cur.workId}`, cur.taskId)
      : openHref('/tasks', cur.taskId)
    : (item ? hrefOf(item) : null);

  return (
    <Centre>
      <TopBar title="通知" right={
        fresh.length > 0 ? <span style={{ color: T5, fontSize: 12 }} className="tnum">未処理 {fresh.length}</span> : undefined
      } />

      {/**
        * **通知が1件も無くても、器は変えない**（2026-08-24）。
        * 前は空のときだけ中央に1枚の画面を出していたが、通知が来た瞬間に画面の形ごと変わる。
        * 積みの列も片づける列もそのまま置いて、**変えるのは言葉だけ**にする。
        */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* ── 左: 積み ─────────────────────────────── */}
        <div style={{
          width: LEFT, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${SEAM}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, height: 42, padding: '0 16px', flexShrink: 0 }}>
            {/* 未処理 ⇄ 済んだもの。**同じ場所で切り替える**（別の画面に飛ばさない） */}
            <button onClick={() => flip(false)} className="lnk" style={{ color: done ? T5 : T3, fontSize: 12 }}>未処理</button>
            <span style={{ color: done ? `${DIM}` : T5, fontSize: 12 }} className="tnum">{fresh.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => flip(true)} className="lnk" style={{ color: done ? T3 : T5, fontSize: 12 }}>済んだもの</button>
          </div>

          {/* 空でも文字を置かない。**上の行の 0 が言っている**（二度言わない） */}
          <div className="sy" style={{ flex: 1, minHeight: 0 }}>
            {list.map((n) => {
              const on = item && n.id === item.id;
              const tone = toneOf(n.kind);
              const { title, sub } = split(n.body);
              return (
                <div key={n.id} className="row" {...pressable(() => setOpen(n.id))} style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 16px',
                  borderBottom: `1px solid ${HAIR}`,
                  boxShadow: on ? `inset 3px 0 0 ${tone.line}` : undefined,
                  background: on ? '#0C0C0C' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 19, padding: '0 7px', borderRadius: 5,
                      background: tone.face, color: tone.text, fontSize: 11,
                    }}>{n.kind}</span>
                    <span style={{ color: T5, fontSize: 11 }}>{ago(n.at)}</span>
                  </div>
                  {/* 本物の通知はダミーより長い。**切らずに折り返す**（行の高さは伸びていい） */}
                  <span style={{ color: on ? T1 : T2, fontSize: 13.5, lineHeight: '19px' }}>{title}</span>
                  {sub && <span style={{ color: T5, fontSize: 11.5, lineHeight: '16px' }}>{sub}</span>}
                </div>
              );
            })}
          </div>

          {/* 片づけ終わったものは、いちばん下に1行だけ */}
          <button onClick={() => flip(!done)} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px',
            borderTop: `1px solid ${SEAM}`, flexShrink: 0, marginBottom: COMPOSER_H, textAlign: 'left',
          }}>
            <Icon name={done ? 'inbox' : 'check'} color={DIM} size={13} width={2} />
            <span style={{ color: T5, fontSize: 12 }}>{done ? '未処理にもどる' : '片づけたもの'}</span>
            {!done && handled.length > 0 && <span style={{ color: DIM, fontSize: 12 }} className="tnum">{handled.length}件</span>}
            <div style={{ flex: 1 }} />
            <Icon name="chev" color={FAINT} size={12} />
          </button>
        </div>

        {/* ── 右: 片づける ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {item ? (
            <>
              <div key={item.id} className="swap" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 28px 8px' }}>
                <span style={{ display: 'block', fontSize: 19 }}>{split(item.body).title}</span>
                <span style={{ display: 'block', color: T5, fontSize: 12, paddingTop: 7 }}>{item.kind} · {ago(item.at)}</span>
                <p style={{ color: T2, fontSize: 13.5, lineHeight: '23px', margin: '18px 0 0' }}>{item.body}</p>
                {/**
                  * **この画面から出ずに終わる**を、本当にする（2026-08-26）。
                  * 通知が指しているタスクにいま社長ができること（判断 / 成果物を見る /
                  * 止まったものから戻る）を、そのまま**ここに出す**。
                  * `key` は通知の id — 次の通知に移ったとき、前の行動が残らない。
                  */}
                <Settle key={item.id} act={cur} onDone={() => settle(item)} />
              </div>

              {/* 行動の行。入力欄に隠さない */}
              <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, height: 56,
                padding: '0 28px', marginBottom: COMPOSER_H, borderTop: `1px solid ${SEAM}`,
              }}>
                {openTo && (
                  <Link href={openTo} className="solid" style={{
                    display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
                    borderRadius: 8, background: BLUE, color: '#fff',
                  }}>開く</Link>
                )}
                {!item.read && (
                  <button onClick={() => settle(item)} className="btn" style={{
                    display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px',
                    borderRadius: 8, border: `1px solid ${EDGE}`, color: T2, fontSize: 12.5,
                  }}>済みにする</button>
                )}
                <div style={{ flex: 1 }} />
                {list.length > 1 && (
                  <span className="lnk" {...pressable(() => setOpen(next.id))} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, color: T5, fontSize: 12,
                  }}>あとで · 次へ <Icon name="down" color={DIM} size={13} /></span>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, marginBottom: COMPOSER_H }}>
                <span style={{ fontSize: 15, color: T2 }}>
                  {none ? '通知はまだありません' : done ? 'まだ何も片づけていません' : '未処理はありません'}
                </span>
                {none && (
                  <span style={{ color: T5, fontSize: 12.5 }}>会社が動きだすと、あなたの番のものだけここに積まれます</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Composer placeholder="統括AIに聞く" />
    </Centre>
  );
}

/**
 * **通知1件を、この画面の中で終わらせる**（2026-08-26）。
 *
 * 前の通知の画面は、自分で「開いて、済ませて、次へ」と書いておきながら、
 * 行動は **「開く」（別の画面へ飛ぶ）と「済みにする」（既読にするだけ）** の2つしか無かった。
 * 社長の仕事は4つあって、そのうち**判断する**と**成果物を見る**は、
 * ぜんぶこの画面に積まれてくる。それを別の画面まで持って行かせていた。
 *
 * ## 決めごと
 *
 * - **器を作らない。** 判断は `DecisionPick`、成果物は `DelBody` ＋ `DelActions`、
 *   止まったものは `StuckActions` — **どれも Work 画面と同じ部品**。
 *   ここだけ別の形にすると、同じことを2通りの見え方で覚えることになる
 * - **できることが無ければ、何も出さない。** その通知の用はもう済んでいる
 *   （行動をでっち上げない）。下の「開く」だけが残る
 * - **終わったら、その通知を済みにして次へ。** それがこの画面の動き方
 */
function Settle({ act, onDone }: { act: InboxAct; onDone: () => void }) {
  if (!act) return null;

  const head = act.kind === 'decision' ? '決める'
    : act.kind === 'deliverable' ? '成果物' : '止まっています';

  return (
    <div style={{ paddingTop: 26 }}>
      <div style={{ paddingBottom: 10 }}><span style={{ color: T3 }}>{head}</span></div>
      {act.kind === 'decision' && <DecisionPick taskId={act.taskId} onDone={onDone} />}
      {act.kind === 'stuck' && <StuckActions taskId={act.taskId} onDone={onDone} />}
      {act.kind === 'deliverable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* **中身を出す。** 見ずに承認させない — 要確認 は「あなたが成果物を見る」ということ */}
          <DelBody body={act.body} kind={act.delKind} />
          {/* `DelActions` はペインの足として作ってあり、内側に 16px を持っている。
              横だけ打ち消して、ボタンの左端を本文にそろえる */}
          <div style={{ margin: '0 -16px' }}>
            <DelActions delId={act.delId} workId={act.workId} taskId={act.taskId}
              title={act.title} state={act.state} onDone={onDone} />
          </div>
        </div>
      )}
    </div>
  );
}
