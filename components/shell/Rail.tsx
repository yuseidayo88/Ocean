'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon, Dot, type IconName } from '@/components/ui/Icon';
import { ME, THREADS, WORKS } from '@/lib/dummy';
import { isBlank, useShell } from '@/components/shell/Shell';

/** レールに出すチャットの数。これを超えたら「すべて見る」を出す */
const SHOWN = 6;

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', GREEN = '#1E8E3E', BLUE = '#1A73E8';

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
      borderRadius: 8, background: on ? '#232323' : undefined, color: on ? T1 : dim ? T4 : T2,
    }}>
      <Icon name={icon} color={on ? T1 : dim ? '#3A3A3A' : T4} size={16} />
      <span>{label}</span>
      <div style={{ flex: 1 }} />
      {live && <Dot color={GREEN} size={6} />}
      {badge && <span style={{ fontSize: 12, color: badgeColor ?? T5 }} className="tnum">{badge}</span>}
    </Link>
  );
}

function Pop({ children, pos }: { children: React.ReactNode; pos: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', width: 224, zIndex: 40, boxSizing: 'border-box', padding: 5,
      borderRadius: 11, background: '#1A1A1A', border: '1px solid #2E2E2E',
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
      borderRadius: 7, background: on ? '#262626' : undefined, textAlign: 'left',
    }}>
      <span style={{ color: color ?? (on ? T1 : T2) }}>{label}</span>
      <div style={{ flex: 1 }} />
      {right && <span style={{ fontSize: 12, color: T5 }}>{right}</span>}
    </button>
  );
}

const Hair = () => <div style={{ height: 1, margin: '5px 8px', background: '#262626' }} />;

export function Rail({ empty }: { empty?: boolean } = {}) {
  const path = usePathname();
  const { rail, setRail } = useShell();
  const [account, setAccount] = useState(false);
  const blank = empty ?? isBlank(path);

  // 閉じたら**端に何も残さない**。戻り道はトップバーの左端
  if (!rail) return null;

  const active = (href: string) => path === href || path.startsWith(href + '/');
  const open = WORKS.find((w) => path.startsWith(`/work/${w.id}`));

  return (
    <nav aria-label="行き先" style={{
      position: 'relative', width: 260, flexShrink: 0, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 12px',
      background: '#141414', borderRight: '1px solid #232323',
    }}>
      {/* 上は窓の印と、このレールを閉じる印だけ。会社名はパンくずの根に置いた */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', height: 26 }}>
        <Dot color="#2E2E2E" size={9} /><Dot color="#2E2E2E" size={9} /><Dot color="#2E2E2E" size={9} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setRail(false)} className="icob" title="左を閉じる"
                style={{ display: 'inline-flex', padding: 4, marginRight: -2 }}>
          <Icon name="collapse" color={T4} size={15} />
        </button>
      </div>

      <div className="field hit" style={{
        height: 32, display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px',
        borderRadius: 8, background: '#1A1A1A', border: '1px solid #262626',
      }}>
        <Icon name="search" color={T4} size={14} />
        <span style={{ color: T4 }}>検索</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T5 }}>⌘K</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((n) => (
          <span key={n.href}>
            <NavRow {...n} on={active(n.href) || (blank && n.href === '/home')} dim={blank}
                    live={n.href === '/work' && !blank}
                    badge={blank ? undefined : n.href === '/inbox' ? '2' : n.href === '/team' ? '4' : undefined}
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
          {!blank && (
            <Link href="/chat/new" className="icob" title="新しいチャット"
                  style={{ display: 'inline-flex', padding: 4, marginRight: -3 }}>
              <Icon name="plus" color={T4} size={14} />
            </Link>
          )}
        </div>
        {blank ? (
          <div style={{ padding: '2px 10px 0' }}>
            <span style={{ color: '#3A3A3A', fontSize: 12 }}>まだありません</span>
          </div>
        ) : (
          <>
            {THREADS.slice(0, SHOWN).map((t) => {
              const on = path === `/chat/${t.id}`;
              return (
                <Link key={t.id} href={`/chat/${t.id}`} className={on ? 'hit' : 'row'} style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 30,
                  padding: '0 10px 0 12px', borderRadius: 8,
                  background: on ? '#232323' : undefined, color: on ? T1 : T3,
                }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                  {t.unread && <><div style={{ flex: 1 }} /><Dot color={BLUE} size={6} /></>}
                </Link>
              );
            })}
            {/* レールに入りきらないときだけ出す。行き先のないリンクは置かない */}
            {THREADS.length > SHOWN && (
              <div className="row" style={{
                display: 'flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 8,
              }}>
                <span className="lnk" style={{ color: T5, fontSize: 12 }}>すべて見る</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* 下は「わたし」 */}
      <button onClick={() => setAccount(!account)} className={account ? 'hit' : 'row'} style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px',
        borderRadius: 8, background: account ? '#1E1E1E' : undefined, width: '100%',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 999, background: '#2E2E2E',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
        }}>{ME.initial}</span>
        <span style={{ color: account ? T1 : T2 }}>{ME.name}</span>
        <div style={{ flex: 1 }} />
        <Icon name="down" color={account ? T3 : T4} size={13} />
      </button>

      {account && (
        <Pop pos={{ bottom: 56, left: 12, right: 24, width: 'auto' }}>
          <PopRow label="設定" />
          <PopRow label="請求" />
          <Hair />
          <PopRow label="ログアウト" color={T3} />
        </Pop>
      )}
    </nav>
  );
}
