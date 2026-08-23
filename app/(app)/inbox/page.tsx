'use client';

import { Go as Link } from '@/components/ui/Go';
import { openHref, useOpen } from '@/lib/use-open';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { INBOX, INBOX_DONE, type InboxItem, type InboxKind } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';
import { COMPOSER_H } from '@/lib/design/tokens';

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

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663';
const RED = '#D93025', RED_T = '#F28B82', GREEN = '#1E8E3E', GREEN_T = '#5BB974';

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
  const at = Math.max(INBOX.findIndex((n) => n.id === openId), 0);
  const item = INBOX[at];
  const next = INBOX[at + 1] ?? INBOX[0];

  return (
    <Centre>
      <TopBar title="通知" right={
        <span style={{ color: T5, fontSize: 12 }} className="tnum">未処理 {INBOX.length}</span>
      } />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* ── 左: 積み ─────────────────────────────── */}
        <div style={{
          width: LEFT, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid #1C1C1C',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, height: 42, padding: '0 16px', flexShrink: 0 }}>
            <span style={{ color: T3, fontSize: 12 }}>未処理</span>
            <span style={{ color: T5, fontSize: 12 }} className="tnum">{INBOX.length}</span>
            <div style={{ flex: 1 }} />
            <span className="lnk" style={{ color: T5, fontSize: 12 }}>済んだもの</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {INBOX.map((n) => {
              const on = n.id === item.id;
              const tone = TONE[n.kind];
              return (
                <div key={n.id} className="row" {...pressable(() => setOpen(n.id))} style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 16px',
                  borderBottom: '1px solid #161616',
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
          <div className="row" style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px',
            borderTop: '1px solid #1C1C1C', flexShrink: 0, marginBottom: COMPOSER_H,
          }}>
            <Icon name="check" color="#3A3A3A" size={13} width={2} />
            <span style={{ color: T5, fontSize: 12 }}>{INBOX_DONE.label}</span>
            <span style={{ color: '#3A3A3A', fontSize: 12 }} className="tnum">{INBOX_DONE.count}件</span>
          </div>
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
            padding: '0 28px', marginBottom: COMPOSER_H, borderTop: '1px solid #1C1C1C',
          }}>
            <span className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: item.kind === 'エラー' ? '#1A1A1A' : BLUE,
              border: item.kind === 'エラー' ? '1px solid #2A2A2A' : undefined,
              color: item.kind === 'エラー' ? T1 : '#fff',
            }}>{item.primary}</span>
            <span className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px',
              borderRadius: 8, border: '1px solid #2A2A2A', color: T2, fontSize: 12.5,
            }}>{item.secondary}</span>
            <div style={{ flex: 1 }} />
            <span className="lnk" {...pressable(() => setOpen(next.id))} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, color: T5, fontSize: 12,
            }}>あとで · 次の未処理へ <Icon name="down" color="#3A3A3A" size={13} /></span>
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
          borderRadius: 9, borderTop: '1px solid #161616',
          background: r.hi ? 'rgba(30,142,62,0.10)' : undefined,
        }}>
          <span style={{ width: 40, color: r.hi ? T1 : T3, fontSize: 14 }}>{r.k}</span>
          <span style={{ width: 78, color: r.hi ? T1 : T2, fontSize: 14 }} className="tnum">{r.v}</span>
          <span style={{ width: 148, display: 'inline-flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 84, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${r.pct}%`, height: '100%', background: r.hi ? GREEN : '#3A3A3A' }} />
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
            borderRadius: 9, borderTop: '1px solid #161616',
          }}>
          <Icon name="deliv" color="#3A3A3A" size={14} />
          <span style={{ color: T1, fontSize: 13.5 }}>{name}</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: T5, fontSize: 12 }}>{who}</span>
          <Icon name="chev" color="#2E2E2E" size={12} />
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
          <Dot color="#2E2E2E" size={5} />
          <span style={{ color: T2, fontSize: 13 }}>{what}</span>
          <span style={{ color: '#3A3A3A', fontSize: 11.5 }}>{who}</span>
        </div>
      ))}
    </div>
  );
}
