'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useShell } from '@/components/shell/Shell';
import { DECISIONS, DELIVERABLES, EMPLOYEES, TASKS, THREADS, WORKS } from '@/lib/dummy';
import { openHref } from '@/lib/use-open';

/**
 * 検索（⌘K）。**行き先だけを引く。**
 *
 * 左レールは行き先が7つしかない。中身（Work・タスク・成果物・メンバー・決定・会話）は
 * その中に埋まっているので、名前を覚えているときに一発で飛べる道が要る。
 *
 * ・**開いている1件は URL に持つ**ので、検索から「その1件」へ直接飛べる
 * ・並びは種類ごと。**件数は出さない**（数えても動かない）
 * ・↑↓ で動いて Enter で飛ぶ。Esc で閉じる
 * ・**空のときは何も出さない**（最近見たもの、を作らない — まだ持っていない）
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8';

type Hit = { id: string; icon: IconName; label: string; sub: string; href: Route; kind: string };

const PAGES: Hit[] = [
  { id: 'p-home', icon: 'home', label: 'ホーム', sub: '', href: '/home', kind: '行き先' },
  { id: 'p-inbox', icon: 'inbox', label: '通知', sub: '', href: '/inbox', kind: '行き先' },
  { id: 'p-work', icon: 'work', label: 'Work', sub: '', href: '/work', kind: '行き先' },
  { id: 'p-tasks', icon: 'task', label: 'タスク', sub: '', href: '/tasks', kind: '行き先' },
  { id: 'p-deliv', icon: 'deliv', label: '成果物', sub: '', href: '/deliverables', kind: '行き先' },
  { id: 'p-team', icon: 'team', label: 'メンバー', sub: '', href: '/team', kind: '行き先' },
  { id: 'p-dec', icon: 'dec', label: '決定事項', sub: '', href: '/decisions', kind: '行き先' },
  { id: 'p-skills', icon: 'bolt', label: 'スキル', sub: 'SKILL.md の管理', href: '/skills', kind: '行き先' },
  { id: 'p-hire', icon: 'plus', label: '採用', sub: '候補を見る', href: '/hire', kind: '行き先' },
];

/** 名簿は lib/dummy がひとつの出どころ。画面ごとに書かない */
function all(): Hit[] {
  return [
    ...PAGES,
    ...WORKS.map((w): Hit => ({ id: w.id, icon: 'work', label: w.title, sub: w.goal, href: `/work/${w.id}` as Route, kind: 'Work' })),
    ...TASKS.map((t): Hit => ({ id: t.id, icon: 'task', label: t.title, sub: `${t.state} · ${t.due}`, href: openHref('/tasks', t.id), kind: 'タスク' })),
    ...DELIVERABLES.map((d): Hit => ({ id: d.id, icon: 'deliv', label: d.title, sub: `${d.version} · ${d.when}`, href: openHref('/deliverables', d.id), kind: '成果物' })),
    ...EMPLOYEES.map((e): Hit => ({ id: e.id, icon: 'team', label: e.name, sub: e.en, href: openHref('/team', e.id), kind: 'メンバー' })),
    ...DECISIONS.map((d): Hit => ({ id: d.id, icon: 'dec', label: d.question, sub: `${d.state} · ${d.when}`, href: openHref('/decisions', d.id), kind: '決定事項' })),
    ...THREADS.map((t): Hit => ({ id: t.id, icon: 'chat', label: t.title, sub: '', href: `/chat/${t.id}` as Route, kind: 'チャット' })),
  ];
}

export function Find() {
  const { find, setFind } = useShell();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [];
    return all().filter((h) => (h.label + h.sub + h.kind).toLowerCase().includes(k)).slice(0, 12);
  }, [q]);

  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => { if (find) { setQ(''); setAt(0); box.current?.focus(); } }, [find]);

  if (!find) return null;

  const go = (h: Hit) => { setFind(false); router.push(h.href); };

  return (
    <>
      {/* 外を押したら閉じる。中身は覆わない（うっすら暗くするだけ） */}
      <div onClick={() => setFind(false)} style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)',
      }} />
      <div className="pop" role="dialog" aria-label="検索" style={{
        position: 'fixed', top: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 61,
        width: 620, maxWidth: 'calc(100vw - 48px)', boxSizing: 'border-box',
        borderRadius: 14, background: '#141414', border: '1px solid #2A2A2A',
        boxShadow: '0 30px 70px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, height: 50, padding: '0 16px' }}>
          <Icon name="search" color={T4} size={16} />
          <input
            ref={box} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); setFind(false); }
              if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(i + 1, hits.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && hits[at]) { e.preventDefault(); go(hits[at]); }
            }}
            placeholder="Work・タスク・成果物・メンバー・決定事項・会話"
            style={{
              flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
              color: T1, fontSize: 15, padding: 0,
            }} />
          <span style={{ color: T5, fontSize: 11 }}>esc</span>
        </div>

        {hits.length > 0 && <>
          <div style={{ height: 1, background: '#232323' }} />
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
            {hits.map((h, i) => {
              const on = i === at;
              return (
                <button key={h.kind + h.id} onMouseEnter={() => setAt(i)} onClick={() => go(h)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 42,
                  padding: '0 10px', borderRadius: 8, textAlign: 'left',
                  background: on ? '#1F1F1F' : undefined,
                }}>
                  <Icon name={h.icon} color={on ? T2 : '#3A3A3A'} size={15} />
                  <span style={{ color: on ? T1 : T2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.label}
                  </span>
                  {h.sub && <span style={{ color: T5, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sub}</span>}
                  <div style={{ flex: 1 }} />
                  <span style={{ color: '#3A3A3A', fontSize: 11, flexShrink: 0 }}>{h.kind}</span>
                  {on && <Icon name="chev" color={BLUE} size={12} />}
                </button>
              );
            })}
          </div>
        </>}
      </div>
    </>
  );
}

/**
 * まだ効かないものを押したときの返し。**黙って何も起きないのをやめる。**
 *
 * 置き場所は**右下**。入力欄の真上には質問の板が出るので、そこに重ねると
 * 板の選択肢が押せなくなる（実際そうなっていた）。
 */
export function Note() {
  const { note } = useShell();
  if (!note) return null;
  return (
    <div className="rise" role="status" style={{
      position: 'fixed', right: 22, bottom: 22, zIndex: 55,
      display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 16px',
      borderRadius: 10, background: '#1F1F1F', border: '1px solid #2E2E2E',
      boxShadow: '0 16px 40px rgba(0,0,0,0.7)', whiteSpace: 'nowrap',
    }}>
      <Icon name="bolt" color="#FDD663" size={14} />
      <span style={{ color: T2, fontSize: 12.5 }}>{note}</span>
    </div>
  );
}
