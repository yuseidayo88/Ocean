'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { fileName, formatOf, printable } from '@/lib/deliver/format';
import { T4, T5 } from '@/lib/design/tokens';

/**
 * **作ったものを持ち出す**（2026-08-25）。
 *
 * ここまで、調べさせて書かせたものは**アプリの中にしか無かった**。
 * 一人社長は、調査結果を人に見せ、価格表を計算に使い、LPの構成をそのまま書き出す —
 * **持ち出せない成果物は、無いのと同じ**。
 *
 * 出す形は `lib/deliver/format.ts` の1枚が決める（表は `.csv`、ページは `.html`、
 * 図は `.json`、あとは `.md`）。**種類ごとに別のボタンを並べない** — 器は1つ。
 *
 * **PDF は刷って作る。** サーバーで PDF を組む道具は入れない（workerd に載らないし、
 * 書体を抱えるとビルドが太る）。ブラウザの印刷には「PDF に保存」がもとから付いていて、
 * それが**いちばん確かな PDF** — 画面の黒ではなく、白い紙の体裁で刷る（→ `printable`）。
 */
export function DelTake({ title, body, kind, src }: { title: string; body: string; kind?: string; src?: string }) {
  const [done, setDone] = useState(false);
  const f = formatOf(kind, body);
  // 画像・音声は本文が空でも持ち出せる（中身はバイト列のほう）
  if (!body && !src) return null;

  const name = fileName(title, f);

  /**
   * **画像は絵そのものを落とす**（2026-08-27）。`src` は署名つきURL（本番）か
   * data URI（デモ）— どちらも `fetch` で読めるので、道を分けない。
   * 落ちたら黙って何もしない（**押しても何も起きない**を作らないよう、
   * ボタンは絵があるときにしか出ない）。
   */
  const save = async () => {
    // **中身がバイト列のものは、道から落とす**（画像も音声も同じ道を通る）
    if (f.shape === 'image' || f.shape === 'audio') {
      if (!src) return;
      try {
        const blob = await (await fetch(src)).blob();
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        a.click();
        URL.revokeObjectURL(url);
      } catch { /* 取れなかった。何も起きない */ }
      return;
    }
    const url = URL.createObjectURL(new Blob([body], { type: `${f.mime};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * 刷る。**新しい窓は開かない**（ブロックされると何も起きない）。
   * 見えない iframe に1枚組んで、その中の窓に刷ってもらう。
   * 刷り終わったら片づける — 残すと次に押したとき2枚になる。
   */
  const toPdf = () => {
    const fr = document.createElement('iframe');
    Object.assign(fr.style, {
      position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0',
    });
    fr.srcdoc = printable(title, body, kind, src);
    fr.onload = () => {
      const w = fr.contentWindow;
      if (!w) { fr.remove(); return; }
      w.focus();
      w.print();
      // 印刷の窓が閉じるまで待つ（同期で消すと、刷る前に中身が無くなる）
      window.setTimeout(() => fr.remove(), 1000);
    };
    document.body.appendChild(fr);
  };

  /** 押した瞬間だけ「コピーしました」。**押せたことが分からない、を作らない** */
  const copy = async () => {
    try { await navigator.clipboard.writeText(body); } catch { return; }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      {done && <span style={{ color: T5, fontSize: 11, paddingRight: 4 }}>コピーしました</span>}
      {/* 画像に「本文をコピー」は要らないので、本文があるときだけ */}
      {body && (
        <button className="icob" title="コピー" aria-label="本文をコピー" onClick={copy}
          style={{ display: 'inline-flex', padding: 4 }}>
          <Icon name="copy" color={T4} size={14} />
        </button>
      )}
      {f.print && (f.shape !== 'image' || !!src) && (
        <button className="btn" title="印刷して PDF にする" aria-label="PDF にする" onClick={toPdf}
          style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 7px',
                   borderRadius: 6, color: T5, fontSize: 11 }}>PDF</button>
      )}
      {((f.shape !== 'image' && f.shape !== 'audio') || !!src) && (
      <button className="icob" title={name} aria-label="ダウンロード" onClick={save}
        style={{ display: 'inline-flex', padding: 4 }}>
        <Icon name="download" color={T4} size={14} />
      </button>
      )}
    </span>
  );
}
