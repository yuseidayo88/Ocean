'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { INBOX, INBOX_DONE, INBOX_HANDLED, type InboxItem, type InboxKind } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';
import { useShell } from '@/components/shell/Shell';
import { AMBER, AMBER_T, BLUE, COMPOSER_H, DIM, EDGE, FAINT, GREEN, GREEN_T, HAIR, RED, RED_T, SEAM, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * 通知＝**読むものではなく片づけるもの**
 * （参考: Linear Inbox / Plane Inbox / Lemni — 履歴を流すのをやめて、左に積み・右で片づける）。
 *
 * 前は時系列のフィードで、開く先が決定事項・成果物とばらばらだった。
 * いまは**この画面から出ずに終わる** — 開いて、決めて、次へ。
 *
 * ・右ペインは使わない。**画面そのものが2列**（左＝未処理の積み / 右＝中身と行動）
 * ・左はいつも1件選ばれている。閉じた状態から始まらない（片づける画面なので）
 * ・行動の行は入力欄に隠さない（`COMPOSER_H` ぶん上に置く）
 */

/** 左の列の幅。ここだけ固定して、右は残り全部 */
const LEFT = 300;

const TONE: Record<InboxKind, { line: string; text: string; face: string }> = {
  '判断待ち':   { line: AMBER, text: AMBER_T, face: 'rgba(227,116,0,0.16)' },
  '要確認':     { line: AMBER, text: AMBER_T, face: 'rgba(227,116,0,0.16)' },
  'エラー':      { line: RED,   text: RED_T,   face: 'rgba(217,48,37,0.16)' },
};

export default function InboxPage() {
  // 片づける画面なので、いつも1件選ばれている（閉じた状態から始めない）
  const [openId, setOpen] = useOpen();
  // 済んだものに切り替えたかどうかは URL に持つ（戻ってきても同じ側を見ている）
  const [done, setDone] = useParam('done', '');
  const list = done ? INBOX_HANDLED : INBOX;
  const at = Math.max(list.findIndex((n) => n.id === openId), 0);
  const item = list[at];
  const next = list[at + 1] ?? list[0];
  const { say5 } = useShell();
  const flip = (to: boolean) => { setDone(to ? '1' : ''); setOpen((to ? INBOX_HANDLED : INBOX)[0].id); };

  return (
    <Centre>
      <TopBar title="通知" right={
        <span style={{ color: T5, fontSize: 12 }} className="tnum">未処理 {INBOX.length}</span>
      } />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* ── 左: 積み ─────────────────────────────── */}
        <div style={{
          width: LEFT, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${SEAM}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, height: 42, padding: '0 16px', flexShrink: 0 }}>
            {/* 未処理 ⇄ 済んだもの。**同じ場所で切り替える**（別の画面に飛ばさない） */}
            <button onClick={() => flip(false)} className="lnk" style={{ color: done ? T5 : T3, fontSize: 12 }}>未処理</button>
            <span style={{ color: done ? `${DIM}` : T5, fontSize: 12 }} className="tnum">{INBOX.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => flip(true)} className="lnk" style={{ color: done ? T3 : T5, fontSize: 12 }}>済んだもの</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {list.map((n) => {
              const on = n.id === item.id;
              const tone = TONE[n.kind];
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
                    <span style={{ color: T5, fontSize: 11 }}>{n.when}</span>
                  </div>
                  <span style={{
                    color: on ? T1 : T2, fontSize: 13.5,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{n.title}</span>
                  <span style={{
                    color: T5, fontSize: 11.5,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{n.sub}</span>
                </div>
              );
            })}
          </div>

          {/* 片づけ終わったものは日ごとに畳んで、いちばん下に1行だけ */}
          <button onClick={() => flip(!done)} className="row" style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px',
            borderTop: `1px solid ${SEAM}`, flexShrink: 0, marginBottom: COMPOSER_H, textAlign: 'left',
          }}>
            <Icon name={done ? 'inbox' : 'check'} color={DIM} size={13} width={2} />
            <span style={{ color: T5, fontSize: 12 }}>{done ? '未処理にもどる' : INBOX_DONE.label}</span>
            {!done && <span style={{ color: DIM, fontSize: 12 }} className="tnum">{INBOX_DONE.count}件</span>}
            <div style={{ flex: 1 }} />
            <Icon name="chev" color={FAINT} size={12} />
          </button>
        </div>

        {/* ── 右: 片づける ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div key={item.id} className="swap" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 28px 8px' }}>
            <span style={{ display: 'block', fontSize: 19 }}>{item.title}</span>
            <span style={{ display: 'block', color: T5, fontSize: 12, paddingTop: 7 }}>{item.meta}</span>

            <div style={{ paddingTop: 18 }}>
              {item.lead.map((p) => (
                <p key={p} style={{ color: T2, fontSize: 13.5, lineHeight: '23px', margin: '0 0 4px' }}>{p}</p>
              ))}
            </div>

            {item.table && <Table t={item.table} />}
            {item.look && <Look rows={item.look} />}
            {item.after && <After rows={item.after} kind={item.kind} />}
          </div>

          {/* 行動の行。入力欄に隠さない */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, height: 56,
            padding: '0 28px', marginBottom: COMPOSER_H, borderTop: `1px solid ${SEAM}`,
          }}>
            <button onClick={() => say5('決めたことを台帳に残すのは Phase 9 から')} className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: item.kind === 'エラー' ? `${SUNK}` : BLUE,
              border: item.kind === 'エラー' ? `1px solid ${EDGE}` : undefined,
              color: item.kind === 'エラー' ? T1 : '#fff',
            }}>{item.primary}</button>
            <button onClick={() => say5('統括AIが会話で答えるのは Phase 7 から。計画を立てるところは、いま動いています')} className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px',
              borderRadius: 8, border: `1px solid ${EDGE}`, color: T2, fontSize: 12.5,
            }}>{item.secondary}</button>
            <div style={{ flex: 1 }} />
            <span className="lnk" {...pressable(() => setOpen(next.id))} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, color: T5, fontSize: 12,
            }}>あとで · 次の未処理へ <Icon name="down" color={DIM} size={13} /></span>
          </div>
        </div>
      </div>

      <Composer placeholder="統括AIに聞く" />
    </Centre>
  );
}

/** 案を比べる。**推奨の行だけ緑を敷く**（凡例は置かない） */
function Table({ t }: { t: NonNullable<InboxItem['table']> }) {
  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 26 }}>
        <span style={{ width: 40, color: T5, fontSize: 11 }}>{t.cols[0]}</span>
        <span style={{ width: 78, color: T5, fontSize: 11 }}>{t.cols[1]}</span>
        <span style={{ width: 148, color: T5, fontSize: 11 }}>{t.cols[2]}</span>
        <span style={{ flex: 1, color: T5, fontSize: 11 }}>{t.cols[3]}</span>
      </div>
      {t.rows.map((r) => (
        <div key={r.k} style={{
          display: 'flex', alignItems: 'center', gap: 16, height: 44, padding: '0 12px', margin: '0 -12px',
          borderRadius: 9, borderTop: `1px solid ${HAIR}`,
          background: r.hi ? 'rgba(30,142,62,0.10)' : undefined,
        }}>
          <span style={{ width: 40, color: r.hi ? T1 : T3, fontSize: 14 }}>{r.k}</span>
          <span style={{ width: 78, color: r.hi ? T1 : T2, fontSize: 14 }} className="tnum">{r.v}</span>
          <span style={{ width: 148, display: 'inline-flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 84, height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${r.pct}%`, height: '100%', background: r.hi ? GREEN : DIM }} />
            </span>
            <span style={{ color: r.hi ? T1 : T4, fontSize: 12 }} className="tnum">{r.pct ? `${r.pct}%` : '—'}</span>
          </span>
          <span style={{ flex: 1, color: r.hi ? GREEN_T : T4, fontSize: 12.5 }}>{r.note}</span>
        </div>
      ))}
    </div>
  );
}

/** 見るものを並べる。押すとその成果物へ */
function Look({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ paddingTop: 18 }}>
      {rows.map(([name, who]) => (
        <Link key={name} href={openHref('/deliverables', name.includes('収益') ? 'd-rev' : 'd-target')}
          className="row" style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 12px', margin: '0 -12px',
            borderRadius: 9, borderTop: `1px solid ${HAIR}`,
          }}>
          <Icon name="deliv" color={DIM} size={14} />
          <span style={{ color: T1, fontSize: 13.5 }}>{name}</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: T5, fontSize: 12 }}>{who}</span>
          <Icon name="chev" color={FAINT} size={12} />
        </Link>
      ))}
    </div>
  );
}

/** 片づけたあとに何が動くか。**決める前に見せる** */
function After({ rows, kind }: { rows: [string, string][]; kind: InboxKind }) {
  return (
    <div style={{ paddingTop: 24 }}>
      <span style={{ display: 'block', color: T5, fontSize: 11, paddingBottom: 4 }}>
        {kind === '判断待ち' ? '決めたあとに起きること' : kind === '要確認' ? '承認したあとに起きること' : 'このまま進めると'}
      </span>
      {rows.map(([what, who]) => (
        <div key={what} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 34 }}>
          <Dot color={FAINT} size={5} />
          <span style={{ color: T2, fontSize: 13 }}>{what}</span>
          <span style={{ color: DIM, fontSize: 11.5 }}>{who}</span>
        </div>
      ))}
    </div>
  );
}
