'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 器の実寸を測る。盤面は「入る大きさ」ではなく **いま与えられている大きさ** で描く。
 * 最初の1描画は 0（サーバーと同じ）なので、ずれた形が出てから直る、が起きない。
 */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, set] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      set((p) => (Math.abs(p.w - w) < 1 && Math.abs(p.h - h) < 1 ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
