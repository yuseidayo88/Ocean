'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 横に送る列（AI社員のカード・レーンなど）。
 *
 * `overflow-x: auto` だけでは**縦のホイールが横に効かない**ので、指が乗っているあいだは
 * 縦の回転を横の移動に変える（横一列に並んでいるものは、そう動くのが当たり前）。
 * 端はグラデーションに溶かして「まだある」と言う。**溶かすのは、本当にあるときだけ。**
 */
export function useRail<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const read = () => {
      const over = el.scrollWidth - el.clientWidth;
      setEdge((p) => {
        const l = el.scrollLeft > 2, r = over > 2 && el.scrollLeft < over - 2;
        return p.l === l && p.r === r ? p : { l, r };
      });
    };
    /** 縦の回転を横に。**送り切っているときは親に返す**（画面ごと固まらないように） */
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const over = el.scrollWidth - el.clientWidth;
      if (over < 2) return;
      const next = Math.max(0, Math.min(over, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };

    read();
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, []);

  return [ref, edge] as const;
}
