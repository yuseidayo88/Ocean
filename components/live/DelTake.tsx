'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { T4, T5 } from '@/lib/design/tokens';

/**
 * **作ったものを持ち出す**（2026-08-25）。
 *
 * ここまで、調べさせて書かせたものは**アプリの中にしか無かった**。
 * 一人社長は、調査結果を人に見せ、価格表を計算に使い、LPの構成をそのまま書き出す —
 * **持ち出せない成果物は、無いのと同じ**。スキル（SKILL.md）には最初から
 * ⬇ が付いていたのに、いちばん大事な成果物に付いていなかった。
 *
 * サーバーは要らない（本文はもう画面にある）。図は JSON のまま落とす —
 * 中身は archify の器なので、そのまま別の道具に渡せる。
 */
export function DelTake({ title, body, kind }: { title: string; body: string; kind?: string }) {
  const [done, setDone] = useState(false);
  if (!body) return null;

  const diagram = kind === 'diagram' || body.trim().startsWith('{');
  const name = `${title.replace(/[\\/:*?"<>|]/g, '_')}.${diagram ? 'json' : 'md'}`;

  const save = () => {
    const url = URL.createObjectURL(new Blob([body], {
      type: diagram ? 'application/json' : 'text/markdown',
    }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
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
      <button className="icob" title="コピー" aria-label="本文をコピー" onClick={copy}
        style={{ display: 'inline-flex', padding: 4 }}>
        <Icon name="copy" color={T4} size={14} />
      </button>
      <button className="icob" title={name} aria-label="ダウンロード" onClick={save}
        style={{ display: 'inline-flex', padding: 4 }}>
        <Icon name="download" color={T4} size={14} />
      </button>
    </span>
  );
}
