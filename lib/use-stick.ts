'use client';

import { useEffect, useRef } from 'react';

/**
 * **会話はいつも下に貼り付く。** 開いたときも、返ってきたときも、
 * いちばん新しい発言が見えている。
 *
 * **1回貼るだけでは足りない。** 書体が届いたりカードの中が伸びたりして、
 * 描き終わったあとから中身が高くなる。だから**中身を測っておいて、伸びたら貼り直す**
 * （流れている本文が1行ずつ伸びるあいだも、これが効いている）。
 *
 * ただし**社長が上を読んでいるあいだは動かさない** — 下から 80px 以内にいるときだけ。
 *
 * **チャットの画面と右ペインで同じものを使う。** 分けて書くと、片方だけ直る
 * （実際、画面のほうだけ直っていて、右ペインは返事が伸びても下に付いてこなかった）。
 */
export function useStick<A extends HTMLElement, B extends HTMLElement>() {
  /** 送るところ（外の器）と、中身。**器の中身が伸びたかどうか**を見たいので2つ要る */
  const box = useRef<A>(null);
  const inner = useRef<B>(null);
  useEffect(() => {
    const el = box.current, kid = inner.current;
    if (!el || !kid) return;
    let stick = true;
    const pin = () => { if (stick) el.scrollTop = el.scrollHeight; };
    const watch = () => { stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    pin();
    el.addEventListener('scroll', watch, { passive: true });
    // 中身が伸びたら貼り直す（新しい発言も、流れてくる本文も、ここで拾える）
    const ro = new ResizeObserver(pin);
    ro.observe(kid);
    return () => { el.removeEventListener('scroll', watch); ro.disconnect(); };
  }, []);
  return [box, inner] as const;
}
