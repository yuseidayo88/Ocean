'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTabs } from '@/lib/use-open';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/shell/Controls';
import { pressable } from '@/lib/a11y';
import { skillAdd, skillRemove, skillsList, skillToggle } from '@/app/actions/live';
import type { SkillRow } from '@/lib/store';
import { BLUE, BLUE_T, COMPOSER_H, DIM, HAIR, RAIL, RULE, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * スキル ＝ SKILL.md のファイル管理（参考: Base44 の Knowledge files）。
 * **行の先頭にアイコンは置かない**（ここにはスキルしか並ばない）。
 * 有効かどうかは**青のトグル**で示す（「有効」と文字で書かない）。
 *
 * 中身は store（agent_skills）だけ。**読み込んだものは本当に保存される** —
 * 有効なスキルは、AI社員が必要なときだけ読む手順書になる。
 */

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
          borderRadius: 8, background: RAIL, border: `1px solid ${RULE}`, color: T2, fontSize: 12.5,
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

export default function SkillsPage() {
  const [rows, setRows] = useState<SkillRow[] | null>(null);
  const reload = useCallback(() => { skillsList().then(setRows); }, []);
  useEffect(reload, [reload]);

  // 学びは社員のメモなので、ここには並べない（見る場所はメンバーの設定ペイン）
  const live = (rows ?? []).filter((x) => x.source !== 'learned');
  /**
   * **会社のものになっているものだけ、上に並べる**（2026-08-26）。
   * 社員が書いたばかりのもの（draft）と、統括AIが落としたもの（rejected）は
   * まだ会社のものではないので、下に暗く並べる — メンバー画面で
   * 「まだいない人を暗く並べる」のと同じ置き方。
   */
  const all = live.filter((x) => x.status === 'active');
  const notYet = live.filter((x) => x.status !== 'active');
  const pick = useRef<HTMLInputElement>(null);
  /** ファイルを選ぶ窓を開く。**押す口は3つ**（見出しの ⬆ / 点線の枠 / 落とす）ので1か所にまとめる */
  const choose = useCallback(() => pick.current?.click(), []);

  // タブは本物。開いている並びといま見ているものを URL に持つ（`?open=a.md,b.md&at=1`）
  // **落ちたものも開ける。** 中身を読まずに戻すかどうかは決められない
  const tabs = useTabs(live.map((s) => s.filename));
  const open = tabs.ids[tabs.at];
  const body = (f: string) => live.find((s) => s.filename === f)?.body ?? '';

  const add = async (file: string, text: string) => {
    const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? file.replace(/\.md$/, '');
    const r = await skillAdd({ name, filename: file.endsWith('.md') ? file : `${file}.md`, body: text });
    if (r.ok) reload();
  };
  const [over, setOver] = useState(false);
  const read = (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 8)) {
      f.text().then((t) => add(f.name, t)).catch(() => {});
    }
  };
  const toggle = async (s: SkillRow) => {
    setRows((xs) => (xs ?? []).map((x) => (x.id === s.id ? { ...x, on: !s.on } : x)));
    await skillToggle(s.id, !s.on);
  };
  const remove = async (s: SkillRow) => { await skillRemove(s.id); reload(); };
  /**
   * **落ちた手順書を、社長が会社のものにする。**
   * `toggle` は使えない — 落ちた行の `enabled` はもともと true なので、
   * **`!s.on` は false になって、逆に切ってしまう**（実際そうなった）。
   * ここは向きが1つしかない操作なので、true を渡し切る。
   */
  const revive = async (s: SkillRow) => { await skillToggle(s.id, true); reload(); };

  return (
    <>
      <Centre>
        <TopBar title="スキル" onPanel={all.length ? () => tabs.open(all[0].filename) : undefined} panelOn={!!open} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div>
            <Head label="会社ぜんぶのスキル" note="全員に効きます" actions={[
              { text: 'SKILL.md を読み込む', on: choose },
              { text: '新しく書く', on: () => add('新しいスキル.md', TEMPLATE) },
            ]} />
            <input ref={pick} type="file" accept=".md" multiple hidden
                   onChange={(e) => { read(e.target.files); e.target.value = ''; }} />

            {/* 標準スキルが播かれるので、空になるのはぜんぶ無効にして消したときだけ */}
            {rows !== null && all.length === 0 && (
              <span style={{ display: 'block', padding: '14px 0 4px', color: T5, fontSize: 12.5 }}>
                まだありません。スキル＝必要なときだけ読む手順書。読み込むと、AI社員が仕事のなかで使います
              </span>
            )}
            {all.map((s, i) => (
              <div key={s.id} className="row" {...pressable(() => tabs.open(s.filename))} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '17px 0',
                borderBottom: i === all.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: s.on ? T1 : T4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    {/* 元々の機能としてのスキル。**見えるが、消せない**（切るのはできる） */}
                    {s.source === 'builtin' && <span style={{ color: T5, fontSize: 10.5, flexShrink: 0 }}>標準</span>}
                    {/* 社員が仕事から書いて、統括AIが通したもの（Hermes の輪） */}
                    {s.source === 'agent' && <span style={{ color: T5, fontSize: 10.5, flexShrink: 0 }}>社員が書いた</span>}
                    {s.pending && <span style={{ color: T5, fontSize: 10.5, flexShrink: 0 }}>直しを見ています</span>}
                  </span>
                  <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.filename}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ width: 44, textAlign: 'right', color: T5, fontSize: 11 }} className="tnum">
                  {s.used ? `${s.used}回` : '—'}
                </span>
                <Toggle on={s.on} label={`${s.name} を使う`} onPick={() => toggle(s)} />
                {/* ゴミ箱は自分で読み込んだものと社員が書いたもの。標準スキルは消せない */}
                {(s.source === 'user' || s.source === 'agent') && (
                  <button className="icob" title="削除" style={{ display: 'inline-flex', padding: 3 }}
                    onClick={(e) => { e.stopPropagation(); remove(s); }}>
                    <Icon name="trash" color={DIM} size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* 本当に落とせて、本当に保存される。落としたものは一覧に並ぶ */}
            <button
              type="button"
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files); }}
              onClick={choose}
              style={{
                width: '100%',
                marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 7, height: 104, borderRadius: 12,
                border: `1px dashed ${over ? `${BLUE}` : RULE}`,
                background: over ? 'rgba(26,115,232,0.06)' : undefined,
                transition: 'border-color .14s ease, background-color .14s ease',
              }} className="card">
              <Icon name="upload" color={over ? `${BLUE_T}` : T4} size={16} />
              <span style={{ color: T4, fontSize: 12.5 }}>SKILL.md をここに落とす、または <span style={{ color: T2 }}>選ぶ</span></span>
              <span style={{ color: DIM, fontSize: 11 }}>.md · 何個でも</span>
            </button>
          </div>

          {/**
            * **まだ会社のものになっていないもの**（2026-08-26。Hermes の輪）。
            * 社員が書いたばかりのもの（統括AIが読んでいる最中）と、
            * 統括AIが落としたもの。**落とした理由を残す** — 社長が読んで、戻せるように。
            * 戻し方はトグル1つ（「戻す」ボタンを別に置かない）。
            * **1件も無ければ、節ごと出さない**（「ありません」を1行使って言わない）。
            */}
          {notYet.length > 0 && (
            <div>
              <Head label="まだ会社のものになっていない" note="社員が書いて、統括AIが読んだもの" />
              {notYet.map((s, i) => (
                <div key={s.id} className="row" {...pressable(() => tabs.open(s.filename))} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '17px 0', opacity: 0.58,
                  borderBottom: i === notYet.length - 1 ? undefined : `1px solid ${HAIR}`,
                }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: T2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <span style={{ color: T5, fontSize: 11 }}>
                      {s.status === 'draft' ? '統括AIが読んでいます' : (s.note || '統括AIが落としました')}
                    </span>
                  </div>
                  <div style={{ flex: 1 }} />
                  {/* 落ちたものだけ戻せる。読んでいる最中のものは、押しても何も起きない板を出さない */}
                  {s.status === 'rejected' && (
                    <Toggle on={false} label={`${s.name} を会社のものにする`} onPick={() => revive(s)} />
                  )}
                  <button className="icob" title="削除" style={{ display: 'inline-flex', padding: 3 }}
                    onClick={(e) => { e.stopPropagation(); remove(s); }}>
                    <Icon name="trash" color={DIM} size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Composer placeholder="スキルについて統括AIに聞く" />
      </Centre>

      {open && (
      <Pane width={440} onClose={tabs.close} right={
        /* ⬇ は**本当に落ちる**。開いている SKILL.md をそのまま書き出す（サーバー要らず） */
        <button className="icob" title="ダウンロード" style={{ display: 'inline-flex', padding: 4, flexShrink: 0 }}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([body(open)], { type: 'text/markdown' }));
            const a = Object.assign(document.createElement('a'), { href: url, download: open });
            a.click();
            URL.revokeObjectURL(url);
          }}>
          <Icon name="download" color={T4} size={14} />
        </button>
      }
            tabs={tabs.ids.map((f) => ({ label: f }))} tab={tabs.at} onTab={tabs.select}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
          <pre style={{
            margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
          }}>{body(open)}</pre>
        </div>
      </Pane>
      )}
    </>
  );
}
