'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * 器の実寸を測る。盤面は「入る大きさ」ではなく **いま与えられている大きさ** で描く。
 * 最初の1描画は 0（サーバーと同じ）なので、ずれた形が出てから直る、が起きない。
 *
 * **ref は呼ぶ側が持つ。** ここから返すと、受け取った側がそれを
 * 「フックが作った動かせない値」として扱うことになり、
 * `el.style.transform = …` のような**直接書き**ができなくなる
 * （ワークフローの送りは毎コマ DOM に直接書くので、そこが止まると手ざわりが落ちる）。
 */
export function useSize<T extends HTMLElement>(ref: RefObject<T | null>) {
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
  }, [ref]);
  return size;
}
