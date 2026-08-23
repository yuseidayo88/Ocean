'use client';

import { useRef, useState } from 'react';
import { useTabs } from '@/lib/use-open';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/shell/Controls';
import { pressable } from '@/lib/a11y';
import { SKILLS, SKILL_BODY, type Skill } from '@/lib/dummy';
import { COMPOSER_H } from '@/lib/design/tokens';

/**
 * スキル ＝ SKILL.md のファイル管理（参考: Base44 の Knowledge files）。
 * **行の先頭にアイコンは置かない**（ここにはスキルしか並ばない）。
 * 有効かどうかは**青のトグル**で示す（「有効」と文字で書かない）。
 * 追加はセクション見出しの右上。下に点線の行は置かず、落とす場所だけ用意する。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

// 名簿は lib/dummy がひとつの出どころ。画面ごとに書かない
const MINE = SKILLS.filter((s) => s.scope === 'employee');
const SHARED = SKILLS.filter((s) => s.scope === 'company');




function Head({ label, note, actions = [] }:
  { label: string; note?: string; actions?: { text: string; on: () => void }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, paddingBottom: 6 }}>
      <span style={{ color: T3 }}>{label}</span>
      <div style={{ flex: 1 }} />
      {note && <span style={{ color: T5, fontSize: 12 }}>{note}</span>}
      {/* 押せるものだけが面と枠を持てる */}
      {actions.map((a) => (
        <button key={a.text} onClick={a.on} className="btn" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px',
          borderRadius: 8, background: '#141414', border: '1px solid #262626', color: T2, fontSize: 12.5,
        }}>
          <Icon name={a.text.startsWith('SKILL') ? 'upload' : 'plus'} color={T4} size={12} />{a.text}
        </button>
      ))}
    </div>
  );
}

/** 新しく書くときの中身。**空の板を渡さない** — 何を書けばいいか分かる形で開く */
const TEMPLATE = `---
name: 新しいスキル
description: どんなときに読むか。ここに書いた条件に当てはまると読まれる
---

## 手順
1.
2.

## この会社での注意
-
`;

function Rows({ rows, onOpen }: { rows: Skill[]; onOpen: (f: string) => void }) {
  return (
    <>
      {rows.map((s, i) => (
        <div key={s.file} className="row" {...pressable(() => onOpen(s.file))} style={{
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
          <span style={{ width: 44, textAlign: 'right', color: T5, fontSize: 11 }} className="tnum">{s.used || '—'}</span>
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
  /**
   * 読み込んだもの・新しく書いたもの。**Phase 4 なのでどこにも保存されない**
   * （読み込み直すと消える）。ただし「押しても何も起きない」のはやめる —
   * 選んだ `.md` はその場で開いて中身が読める。
   */
  const [extra, setExtra] = useState<{ file: string; body: string }[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  // タブは本物。開いている並びといま見ているものを URL に持つ（`?open=a.md,b.md&at=1`）
  const tabs = useTabs([...SKILLS.map((s) => s.file), ...extra.map((e) => e.file)]);
  const open = tabs.ids[tabs.at];
  const body = (f: string) => SKILL_BODY[f] ?? extra.find((e) => e.file === f)?.body ?? '';

  /** 同じ名前で2つ開かない。増えるたび末尾に番号を足す */
  const uniq = (name: string) => {
    const taken = new Set([...SKILLS.map((s) => s.file), ...extra.map((e) => e.file)]);
    if (!taken.has(name)) return name;
    const [stem, ext] = [name.replace(/\.md$/, ''), '.md'];
    let n = 2; while (taken.has(`${stem}-${n}${ext}`)) n++;
    return `${stem}-${n}${ext}`;
  };
  const add = (file: string, text: string) => {
    const f = uniq(file);
    setExtra((x) => [...x, { file: f, body: text }]);
    // 名簿に載ってから開く（useTabs は知らない名前を弾く）
    requestAnimationFrame(() => tabs.open(f));
  };
  const [over, setOver] = useState(false);
  const read = (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 8)) {
      f.text().then((t) => add(f.name, t)).catch(() => {});
    }
  };
  return (
    <>
      <Centre>
        <TopBar crumb="メンバー / 調査担当" title="スキル" onPanel={() => tabs.open(MINE[0].file)} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div>
            <Head label="この社員のスキル" actions={[
              { text: 'SKILL.md を読み込む', on: () => pick.current?.click() },
              { text: '新しく書く', on: () => add('新しいスキル.md', TEMPLATE) },
            ]} />
            <input ref={pick} type="file" accept=".md,.zip" multiple hidden
                   onChange={(e) => { read(e.target.files); e.target.value = ''; }} />
            <Rows rows={MINE} onOpen={tabs.open} />
            {/* 本当に落とせる。落としたものはその場で開く */}
            <div
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files); }}
              {...pressable(() => pick.current?.click())}
              style={{
                marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 7, height: 104, borderRadius: 12,
                border: `1px dashed ${over ? '#1A73E8' : '#262626'}`,
                background: over ? 'rgba(26,115,232,0.06)' : undefined,
                transition: 'border-color .14s ease, background-color .14s ease',
              }} className="card">
              <Icon name="upload" color={over ? '#669DF6' : T4} size={16} />
              <span style={{ color: T4, fontSize: 12.5 }}>SKILL.md をここに落とす、または <span style={{ color: T2 }}>選ぶ</span></span>
              <span style={{ color: '#3A3A3A', fontSize: 11 }}>.md · .zip · 何個でも</span>
            </div>
          </div>

          <div>
            <Head label="会社ぜんぶのスキル" note="全員に効きます" />
            <Rows rows={SHARED} onOpen={tabs.open} />
          </div>
        </div>
        <Composer placeholder="スキルについて統括AIに聞く" />
      </Centre>

      {open && (
      <Pane width={440} onClose={tabs.close} right={<Icon name="download" color={T4} size={14} />}
            tabs={tabs.ids.map((f) => ({ label: f }))} tab={tabs.at} onTab={tabs.select}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
          <pre style={{
            margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
          }}>{body(open)}</pre>
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
