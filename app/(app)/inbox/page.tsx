'use client';

import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { openHref, useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { notesList, readNote } from '@/app/actions/live';
import type { Note } from '@/lib/store';
import { pressable } from '@/lib/a11y';
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

/** 相対時刻。無ければ出さない */
function ago(at?: string): string {
  if (!at) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000));
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  if (min < 24 * 60) return `${Math.round(min / 60)}時間前`;
  return `${Math.round(min / (24 * 60))}日前`;
}

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
  const at = Math.max(list.findIndex((n) => n.id === openId), 0);
  const item = list[at] as Note | undefined;
  const next = list[at + 1] ?? list[0];
  const flip = (to: boolean) => { setDone(to ? '1' : ''); setOpen(null); };

  const settle = async (n: Note) => { await readNote(n.id); reload(); if (next && next.id !== n.id) setOpen(next.id); };

  return (
    <Centre>
      <TopBar title="通知" right={
        fresh.length > 0 ? <span style={{ color: T5, fontSize: 12 }} className="tnum">未処理 {fresh.length}</span> : undefined
      } />

      {notes !== null && all.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, color: T2 }}>通知はまだありません</span>
          <span style={{ color: T5, fontSize: 13 }}>会社が動きだすと、あなたの番のものだけここに積まれます</span>
        </div>
      ) : (
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

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {list.length === 0 && (
              <div style={{ padding: '18px 16px' }}>
                <span style={{ color: T5, fontSize: 12.5 }}>{done ? 'まだ何も片づけていません' : '未処理はありません'}</span>
              </div>
            )}
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
              </div>

              {/* 行動の行。入力欄に隠さない */}
              <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, height: 56,
                padding: '0 28px', marginBottom: COMPOSER_H, borderTop: `1px solid ${SEAM}`,
              }}>
                {hrefOf(item) && (
                  <Link href={hrefOf(item)!} className="solid" style={{
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
              <span style={{ color: T5, fontSize: 13 }}>{done ? 'まだ何も片づけていません' : '未処理はありません'}</span>
            </div>
          )}
        </div>
      </div>
      )}

      <Composer placeholder="統括AIに聞く" />
    </Centre>
  );
}
