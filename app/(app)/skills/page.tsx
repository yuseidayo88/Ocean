'use client';

import { useState } from 'react';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/shell/Controls';

/**
 * スキル ＝ SKILL.md のファイル管理（参考: Base44 の Knowledge files）。
 * **行の先頭にアイコンは置かない**（ここにはスキルしか並ばない）。
 * 有効かどうかは**青のトグル**で示す（「有効」と文字で書かない）。
 * 追加はセクション見出しの右上。下に点線の行は置かず、落とす場所だけ用意する。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

type Row = { name: string; file: string; used: string; on: boolean };

const MINE: Row[] = [
  { name: '競合分析のやり方',   file: 'competitor-analysis.md', used: '12回', on: true },
  { name: '市場規模の見積もり', file: 'market-sizing.md',       used: '5回',  on: true },
  { name: '出典の付け方',       file: 'source-citation.md',     used: '20回', on: true },
  { name: '価格帯の調べ方',     file: 'price-band.md',          used: '—',    on: false },
];
const SHARED: Row[] = [
  { name: 'うちの書き方',       file: 'house-style.md', used: '48回', on: true },
  { name: '日本語の言い回し',   file: 'tone-ja.md',     used: '31回', on: true },
];

const BODY = `---
name: 競合分析のやり方
description: 競合を並べて比較するとき。
  ポジショニングや価格の比較を頼まれたら読む
---

## 手順
1. 競合を5〜8社に絞る。選んだ理由を1行で書く
2. 比較軸は「価格 / 対象 / 強み / 弱み」の4つから
3. 表にする。出典URLを各セルに残す

## この会社での注意
- 韓国市場では、韓国語のストア評価も必ず含める`;


function Head({ label, note, actions = [] }: { label: string; note?: string; actions?: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, paddingBottom: 6 }}>
      <span style={{ color: T3 }}>{label}</span>
      <div style={{ flex: 1 }} />
      {note && <span style={{ color: T5, fontSize: 12 }}>{note}</span>}
      {/* 押せるものだけが面と枠を持てる */}
      {actions.map((a) => (
        <span key={a} className="btn" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px',
          borderRadius: 8, background: '#141414', border: '1px solid #262626', color: T2, fontSize: 12.5,
        }}>
          <Icon name={a.startsWith('SKILL') ? 'down' : 'plus'} color={T4} size={12} />{a}
        </span>
      ))}
    </div>
  );
}

function Rows({ rows, onOpen }: { rows: Row[]; onOpen: (f: string) => void }) {
  return (
    <>
      {rows.map((s, i) => (
        <div key={s.file} className="row" onClick={() => onOpen(s.file)} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '17px 0',
          borderBottom: i === rows.length - 1 ? undefined : '1px solid #161616',
        }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: s.on ? T1 : T4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.name}
            </span>
            <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.file}</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ width: 44, textAlign: 'right', color: T5, fontSize: 11 }} className="tnum">{s.used}</span>
          <Toggle on={s.on} />
          <Icon name="download" color="#3A3A3A" size={14} />
          <Icon name="edit" color="#3A3A3A" size={14} />
          <Icon name="trash" color="#3A3A3A" size={14} />
        </div>
      ))}
    </>
  );
}

export default function SkillsPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Centre>
        <TopBar crumb="メンバー / 調査担当" title="スキル" onPanel={() => setOpen(open ? null : MINE[0].file)} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 26px 112px', display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div>
            <Head label="この社員のスキル" actions={['SKILL.md を読み込む', '新しく書く']} />
            <Rows rows={MINE} onOpen={setOpen} />
            <div style={{
              marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 7, height: 104, borderRadius: 12, border: '1px dashed #262626',
            }} className="card">
              <Icon name="down" color={T4} size={16} />
              <span style={{ color: T4, fontSize: 12.5 }}>SKILL.md をここに落とす、または <span style={{ color: T2 }}>選ぶ</span></span>
              <span style={{ color: '#3A3A3A', fontSize: 11 }}>.md · .zip · 何個でも</span>
            </div>
          </div>

          <div>
            <Head label="会社ぜんぶのスキル" note="全員に効きます" />
            <Rows rows={SHARED} onOpen={setOpen} />
          </div>
        </div>
        <Composer placeholder="スキルについて統括AIに聞く" />
      </Centre>

      {open && (
      <Pane onClose={() => setOpen(null)} width={440} tabs={[{ label: 'competitor-analysis.md' }]} right={<Icon name="download" color={T4} size={14} />}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
          <pre style={{
            margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
          }}>{BODY}</pre>
        </div>
        {/* 保存は右下に小さく。ペイン幅いっぱいの青にしない */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: 16, borderTop: '1px solid #161616' }}>
          <span className="solid" style={{
            display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 16px',
            borderRadius: 8, background: BLUE, color: '#fff', fontSize: 12.5,
          }}>保存する</span>
        </div>
      </Pane>
      )}
    </>
  );
}
