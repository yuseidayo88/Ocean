'use client';

import { Go as Link } from '@/components/ui/Go';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, Dot, type IconName } from '@/components/ui/Icon';
import { ME } from '@/lib/view/model';
import { railData, type RailData } from '@/app/actions/live';
import { getWork } from '@/app/actions/work';
import type { ChatThread } from '@/lib/store';
import { isBlank, useShell } from '@/components/shell/Shell';
import { AMBER, DIM, EASE, EASE_FAST, FAINT, GREEN, LINE, RAIL, RAIL_W, RED_T, RULE, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/** レールに出すチャットの数。これを超えたら「すべて見る」を出す */
const SHOWN = 6;

/** 行き先だけを並べる。絞り込みや操作は置かない */
const NAV: { href: Route; label: string; icon: IconName }[] = [
  { href: '/home', label: 'ホーム', icon: 'home' },
  { href: '/inbox', label: '通知', icon: 'inbox' },
  { href: '/work', label: 'Work', icon: 'work' },
  { href: '/tasks', label: 'タスク', icon: 'task' },
  { href: '/deliverables', label: '成果物', icon: 'deliv' },
  { href: '/team', label: 'メンバー', icon: 'team' },
  { href: '/decisions', label: '決定事項', icon: 'dec' },
];

function NavRow({ href, label, icon, on, badge, badgeColor, live, dim }: {
  href: Route; label: string; icon: IconName; on: boolean;
  badge?: string; badgeColor?: string; live?: boolean; dim?: boolean;
}) {
  return (
    <Link href={href} className={on ? 'hit' : 'row'} style={{
      display: 'flex', alignItems: 'center', gap: 11, height: 34, padding: '0 10px',
      borderRadius: 8, background: on ? `${LINE}` : undefined,
      color: on ? T1 : dim ? T4 : T2, transition: `color ${EASE_FAST}`,
    }}>
      <Icon name={icon} color={on ? T1 : dim ? `${DIM}` : T4} size={16} />
      <span>{label}</span>
      <div style={{ flex: 1 }} />
      {live && <Dot color={GREEN} size={6} />}
      {badge && <span style={{ fontSize: 12, color: badgeColor ?? T5 }} className="tnum">{badge}</span>}
    </Link>
  );
}

function Pop({ children, pos }: { children: React.ReactNode; pos: React.CSSProperties }) {
  return (
    <div className="pop" style={{
      position: 'absolute', width: 224, zIndex: 40, boxSizing: 'border-box', padding: 5,
      borderRadius: 11, background: SUNK, border: `1px solid ${FAINT}`,
      boxShadow: '0 18px 44px rgba(0,0,0,0.72)', ...pos,
    }}>{children}</div>
  );
}

function PopRow({ label, right, on, color, onClick }: {
  label: string; right?: string; on?: boolean; color?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={on ? 'hit' : 'row'} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px',
      borderRadius: 7, background: on ? `${RULE}` : undefined, textAlign: 'left',
    }}>
      <span style={{ color: color ?? (on ? T1 : T2) }}>{label}</span>
      <div style={{ flex: 1 }} />
      {right && <span style={{ fontSize: 12, color: T5 }}>{right}</span>}
    </button>
  );
}

const Hair = () => <div style={{ height: 1, margin: '5px 8px', background: RULE }} />;

export function Rail({ initial, warn }: { initial: RailData; warn?: string | null }) {
  const path = usePathname();
  const { rail, setRail, setFind } = useShell();
  const [account, setAccount] = useState(false);
  const router = useRouter();
  const blank = isBlank(path);

  const active = (href: string) => path === href || path.startsWith(href + '/');

  /**
   * レールの中身は store から。**画面を移るたびに読み直す**（安い3クエリ）。
   * 通知の点は未読の数、メンバーは在籍の数。無いものは出さない。
   */
  /**
   * **最初のぶんはサーバーが持ってくる**（`initial`）。器と一緒に届くので、
   * 開いた瞬間からレールが埋まっている。読み直すのは**画面を移ったときだけ** —
   * 開いた直後にもう1回取りに行かない（同じものを2回取っていた）。
   */
  const [threads, setThreads] = useState<ChatThread[]>(initial.threads);
  const [unread, setUnread] = useState(initial.unread);
  const [staff, setStaff] = useState(initial.staff);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    let on = true;
    railData().then((r) => { if (on) { setThreads(r.threads); setUnread(r.unread); setStaff(r.staff); } });
    return () => { on = false; };
  }, [path]);

  // 開いている Work だけ、Work の下にぶら下げる（本物の親子）
  const workId = path.match(/^\/work\/([^/]+)$/)?.[1];
  const [open, setOpenWork] = useState<{ id: string; title: string } | null>(null);
  // Work の画面を出たら、ぶら下がりも消す。**描いている途中で直す**
  const want = workId && workId !== 'new' ? workId : null;
  if (!want && open) setOpenWork(null);
  useEffect(() => {
    if (!want) return;
    let on = true;
    getWork(want).then((w) => { if (on) setOpenWork(w ? { id: want, title: w.title } : null); });
    return () => { on = false; };
  }, [want]);

  return (
    /**
     * 閉じたら**端に何も残さない**。戻り道はトップバーの左端。
     * 消すのではなく幅を 0 にするので、開け閉めが滑らかにつながる。
     * 中身は 260 のまま押し出されるだけ（文字が畳まれて崩れない）。
     */
    <div aria-hidden={!rail} inert={!rail} style={{
      width: rail ? RAIL_W : 0, flexShrink: 0, overflow: 'hidden',
      transition: `width ${EASE}`,
    }}>
    <nav aria-label="行き先" style={{
      position: 'relative', width: RAIL_W, height: '100%', flexShrink: 0, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 12px',
      background: RAIL, borderRight: `1px solid ${LINE}`,
      opacity: rail ? 1 : 0, transition: `opacity ${rail ? '.2s ease .06s' : '.14s ease'}`,
    }}>
      {/* 上はプロダクトの名前と、このレールを閉じる印だけ。会社名はパンくずの根に置いた。
          **窓の印（丸3つ）は置かない** — ここは OS の窓ではないので、真似をしない */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', height: 26 }}>
        <span style={{ color: T1, fontSize: 13.5, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
          OneFound
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setRail(false)} className="icob" title="左を閉じる"
                style={{ display: 'inline-flex', padding: 4, marginRight: -2 }}>
          <Icon name="collapse" color={T4} size={15} />
        </button>
      </div>

      <button onClick={() => setFind(true)} className="field hit" style={{
        width: '100%', boxSizing: 'border-box',
        height: 32, display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px',
        borderRadius: 8, background: SUNK, border: `1px solid ${RULE}`,
      }}>
        <Icon name="search" color={T4} size={14} />
        <span style={{ color: T4 }}>検索</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T5 }}>⌘K</span>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((n) => (
          <span key={n.href}>
            <NavRow {...n} on={active(n.href) || (blank && n.href === '/home')} dim={blank}
                    live={n.href === '/work' && !blank}
                    badge={blank ? undefined
                      : n.href === '/inbox' && unread ? String(unread)
                      : n.href === '/team' && staff ? String(staff) : undefined}
                    badgeColor={n.href === '/inbox' ? AMBER : T5} />
            {/* 開いている Work だけ、その下にぶら下げる（本物の親子） */}
            {n.href === '/work' && open && (
              <Link href={`/work/${open.id}`} className="row" style={{
                display: 'flex', alignItems: 'center', gap: 9, height: 30, padding: '0 10px 0 22px',
                borderRadius: 8, color: T1,
              }}>
                <Dot color={GREEN} size={7} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {open.title}
                </span>
              </Link>
            )}
          </span>
        ))}
      </div>

      {/* チャット履歴（ChatGPT の Your chats と同じ置き方） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, height: 30, padding: '0 10px' }}>
          <span style={{ color: T5, fontSize: 12 }}>チャット</span>
          <div style={{ flex: 1 }} />
          {/**
            * **会話だけは、まだ何もない会社でも本物を出す**（2026-08-24）。
            * 前は `/start` にいるあいだ `blank` で丸ごと「まだありません」にしていたので、
            * **Work がまだ無い会社では、話した会話が左に出てこなかった**。
            * 会社が空かどうかと、会話があるかどうかは別のこと。
            */}
          <Link href="/chat/new" className="icob" title="新しいチャット"
                style={{ display: 'inline-flex', padding: 4, marginRight: -3 }}>
            <Icon name="plus" color={T4} size={14} />
          </Link>
        </div>
        <>
            {threads.length === 0 && (
              <div style={{ padding: '2px 10px 0' }}>
                <span style={{ color: DIM, fontSize: 12 }}>まだありません</span>
              </div>
            )}
            {threads.slice(0, SHOWN).map((t) => {
              const on = path === `/chat/${t.id}`;
              return (
                <Link key={t.id} href={`/chat/${t.id}`} className={on ? 'hit' : 'row'} style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 30,
                  padding: '0 10px 0 12px', borderRadius: 8,
                  background: on ? `${LINE}` : undefined, color: on ? T1 : T3,
                }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                </Link>
              );
            })}
            {/**
              * レールに入りきらないときだけ出す。
              * **行き先は ⌘K**（会話も並ぶ）。押しても何も起きない行にしない。
              */}
            {threads.length > SHOWN && (
              <button onClick={() => setFind(true)} className="row" style={{
                display: 'flex', alignItems: 'center', width: '100%', height: 28,
                padding: '0 12px', borderRadius: 8, color: T5, fontSize: 12, textAlign: 'left',
              }}>すべて見る</button>
            )}
        </>
      </div>

      <div style={{ flex: 1 }} />

      {/**
        * 保存先が無い（設定漏れ）。**黙ってデータを失わせない** — 会話が消える理由を
        * 画面が先に言う（→ `lib/store/index.ts` の storeWarning）。赤＝止まっている。
        */}
      {warn && (
        <span style={{ padding: '6px 10px 10px', color: RED_T, fontSize: 11.5, lineHeight: '17px' }}>
          {warn}
        </span>
      )}

      {/* 下は「わたし」 */}
      <button onClick={() => setAccount(!account)} className={account ? 'hit' : 'row'} style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px',
        borderRadius: 8, background: account ? '#1E1E1E' : undefined, width: '100%',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 999, background: FAINT,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
        }}>{ME.initial}</span>
        <span style={{ color: account ? T1 : T2 }}>{ME.name}</span>
        <div style={{ flex: 1 }} />
        <Icon name="down" color={account ? T3 : T4} size={13} />
      </button>

      {account && (
        <Pop pos={{ bottom: 56, left: 12, right: 24, width: 'auto' }}>
          <PopRow label="設定" />
          {/* 請求は本物の画面がある（Phase 11）。トークンの数字はあの画面だけに出す */}
          <PopRow label="請求" onClick={() => { setAccount(false); router.push('/billing' as Route); }} />
          <Hair />
          <PopRow label="ログアウト" color={T3} />
        </Pop>
      )}
    </nav>
    </div>
  );
}
