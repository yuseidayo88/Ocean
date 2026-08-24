'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useShell } from '@/components/shell/Shell';
import { threadsList, worksList } from '@/app/actions/live';
import { listDecisions, listDels, listEmployees } from '@/app/actions/run';
import { openHref } from '@/lib/use-open';

import { AMBER_T, BLUE, DIM, EDGE, FAINT, LINE, RAIL, T1, T2, T4, T5, WELL } from '@/lib/design/tokens';
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
  { id: 'p-gates', icon: 'dec', label: '判断待ちを見る', sub: 'あなたが決めるものだけ', href: '/decisions', kind: '行き先' },
  { id: 'p-review', icon: 'deliv', label: '要確認の成果物', sub: 'あなたが見るものだけ', href: '/deliverables', kind: '行き先' },
  { id: 'p-billing', icon: 'bars', label: '請求とプラン', sub: '', href: '/billing', kind: '行き先' },
];

/** 中身は store から。**開いたときに1回だけ**取りに行く（打つたびには行かない） */
async function fetchAll(): Promise<Hit[]> {
  const [works, dels, decs, staff, threads] = await Promise.all([
    worksList(), listDels(), listDecisions(), listEmployees(), threadsList(),
  ]);
  return [
    ...PAGES,
    ...works.map((w): Hit => ({ id: w.id, icon: 'work', label: w.title, sub: w.goal, href: `/work/${w.id}` as Route, kind: 'Work' })),
    ...works.flatMap((w) => w.tasks.map((t): Hit => ({
      id: t.id, icon: 'task', label: t.title, sub: w.title, href: `/work/${w.id}` as Route, kind: 'タスク',
    }))),
    ...dels.map((d): Hit => ({ id: d.id, icon: 'deliv', label: d.title, sub: d.state, href: openHref('/deliverables', d.id), kind: '成果物' })),
    ...staff.map((e): Hit => ({ id: e.id, icon: 'team', label: e.name, sub: '', href: openHref('/team', e.id), kind: 'メンバー' })),
    ...decs.map((d): Hit => ({ id: d.id, icon: 'dec', label: d.question, sub: d.status === 'open' ? '判断待ち' : '決定済', href: openHref('/decisions', d.id), kind: '決定事項' })),
    ...threads.map((t): Hit => ({ id: t.id, icon: 'chat', label: t.title, sub: '', href: `/chat/${t.id}` as Route, kind: 'チャット' })),
  ];
}

export function Find() {
  const { find, setFind, say } = useShell();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [pool, setPool] = useState<Hit[]>(PAGES);
  useEffect(() => {
    if (!find) return;
    let on = true;
    fetchAll().then((hs) => { if (on) setPool(hs); });
    return () => { on = false; };
  }, [find]);

  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [];
    const found = pool.filter((h) => (h.label + h.sub + h.kind).toLowerCase().includes(k)).slice(0, 11);
    /**
     * ⌘K は検索だけでなく**会社への口**。書いたものが名前に当たらなくても、
     * そのまま統括AIに頼める（会話が開いて、本当に返ってくる）。
     * いちばん下に1行だけ — 検索の結果と取り違えないように、種類は「頼む」。
     */
    return [...found, {
      id: 'cmd-ask', icon: 'chat' as IconName, label: `統括AIに頼む「${q.trim().slice(0, 40)}」`,
      sub: '会話が開きます', href: '/home' as Route, kind: '頼む',
    }];
  }, [q, pool]);

  /**
   * 書き換えたら選択は先頭に戻し、開いたら空から始める。
   * **どちらも描いている途中で直す** — effect にすると、
   * 古い候補を選んだ状態で1回描いてから戻ることになる（一瞬ずれて見える）。
   */
  const [seenQ, setSeenQ] = useState(q);
  if (seenQ !== q) { setSeenQ(q); setAt(0); }

  const [wasOpen, setWasOpen] = useState(find);
  if (wasOpen !== find) {
    setWasOpen(find);
    if (find) { setQ(''); setAt(0); setSeenQ(''); }
  }

  // 焦点を当てるのは外の世界（DOM）の話なので、ここは effect のままでいい
  useEffect(() => { if (find) box.current?.focus(); }, [find]);

  if (!find) return null;

  const go = (h: Hit) => {
    setFind(false);
    if (h.id === 'cmd-ask') { say(q.trim()); return; } // 頼みごとは会話へ（画面は移らない）
    router.push(h.href);
  };

  return (
    <>
      {/* 外を押したら閉じる。中身は覆わない（うっすら暗くするだけ） */}
      <div onClick={() => setFind(false)} style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)',
      }} />
      <div className="pop" role="dialog" aria-label="検索" style={{
        position: 'fixed', top: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 61,
        width: 620, maxWidth: 'calc(100vw - 48px)', boxSizing: 'border-box',
        borderRadius: 14, background: RAIL, border: `1px solid ${EDGE}`,
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
          <div style={{ height: 1, background: LINE }} />
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
            {hits.map((h, i) => {
              const on = i === at;
              return (
                <button key={h.kind + h.id} onMouseEnter={() => setAt(i)} onClick={() => go(h)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 42,
                  padding: '0 10px', borderRadius: 8, textAlign: 'left',
                  background: on ? `${WELL}` : undefined,
                }}>
                  <Icon name={h.icon} color={on ? T2 : DIM} size={15} />
                  <span style={{ color: on ? T1 : T2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.label}
                  </span>
                  {h.sub && <span style={{ color: T5, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sub}</span>}
                  <div style={{ flex: 1 }} />
                  <span style={{ color: DIM, fontSize: 11, flexShrink: 0 }}>{h.kind}</span>
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
      borderRadius: 10, background: WELL, border: `1px solid ${FAINT}`,
      boxShadow: '0 16px 40px rgba(0,0,0,0.7)', whiteSpace: 'nowrap',
    }}>
      <Icon name="bolt" color={AMBER_T} size={14} />
      <span style={{ color: T2, fontSize: 12.5 }}>{note}</span>
    </div>
  );
}
