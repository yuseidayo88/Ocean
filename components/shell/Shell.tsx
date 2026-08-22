'use client';

import { createContext, useContext, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { usePathname } from 'next/navigation';
import { COMPANIES } from '@/lib/dummy';

/**
 * 器の開け閉め。左レールはレールの中の印で閉じ、閉じたら**端に何も残さない**。
 * 戻り道はトップバーの左端（右ペインと同じ作法）。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';

const Ctx = createContext<{ rail: boolean; setRail: (v: boolean) => void }>({ rail: true, setRail: () => {} });
export const useShell = () => useContext(Ctx);

export function Shell({ children }: { children: React.ReactNode }) {
  const [rail, setRail] = useState(true);
  return <Ctx.Provider value={{ rail, setRail }}>{children}</Ctx.Provider>;
}

/**
 * 会社の切り替え。**いま見ているものは全部この会社のもの**なので、
 * パンくずの根に置く（レールの上ではなく）。レールを閉じても消えない。
 */
/** まだ何もない会社の画面（→ docs/design/01-data-model.md 入口） */
export const EMPTY_ROUTES = ['/start', '/discovery', '/import', '/diagnosis'];
export const isBlank = (p: string) => EMPTY_ROUTES.some((r) => p === r || p.startsWith(r + '/'));

export function CompanyPicker() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const blank = isBlank(path);
  const now = COMPANIES.find((c) => c.current) ?? COMPANIES[0];
  const name = blank ? 'あなたの会社' : now.name;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen(!open)} className="btn" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 8px',
        borderRadius: 7, color: open ? T1 : T2,
      }}>
        {name}<Icon name="down" color={open ? T3 : T4} size={12} />
      </button>
      {open && (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
          <div style={{
            position: 'absolute', top: 32, left: 0, width: 224, zIndex: 40, boxSizing: 'border-box', padding: 5,
            borderRadius: 11, background: '#1A1A1A', border: '1px solid #2E2E2E',
            boxShadow: '0 18px 44px rgba(0,0,0,0.72)',
          }}>
            {COMPANIES.map((c) => (
              <button key={c.id} className={c.current ? 'hit' : 'row'} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 32, padding: '0 10px',
                borderRadius: 7, background: c.current ? '#262626' : undefined, textAlign: 'left',
              }}>
                <span style={{ color: c.current ? T1 : T2 }}>{c.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: T5 }}>Work {c.works}</span>
              </button>
            ))}
            <div style={{ height: 1, margin: '5px 8px', background: '#262626' }} />
            <button className="row" style={{
              width: '100%', display: 'flex', alignItems: 'center', height: 32, padding: '0 10px',
              borderRadius: 7, textAlign: 'left',
            }}><span style={{ color: T3 }}>会社を追加</span></button>
          </div>
        </>
      )}
    </span>
  );
}
