'use client';

import { useEffect, useState } from 'react';
import { publishPage, publishedFor, unpublishPage } from '@/app/actions/publish';
import { whyNot } from '@/lib/deliver/publish';
import { Icon } from '@/components/ui/Icon';
import type { PublishedPage } from '@/lib/store/types';
import { AMBER_T, BLUE, EDGE, GREEN_T, RAIL, RED_T, T1, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * **公開する**（2026-08-27。社長の「他のやつから順に」の③）。
 *
 * AI社員は LP を書ける。でも**出し先がなかった** — ⬇ で落として、
 * 自分でどこかに上げるしかなかった。一人社長にそれをやらせるなら、
 * **作れたことに意味がない**。
 *
 * ## 決めごと
 *
 * - **外に出るので、一度だけ確かめる**（Approval 必須の一形）。
 *   押す → 何が起きるかを読む → もう一度押す
 * - **ページの、承認済のものだけ。** 見ていないものを世に出さない
 * - **落としたものは言う**（script など）。黙って中身を変えない
 * - **秘密の URL だと思わせない。** 公開したページは誰でも読める、と書く
 */
export function DelPublish({ delId, kind, state, body }: {
  delId: string; kind?: string; state: string; body: string;
}) {
  /**
   * いま出ているか。**どの成果物のぶんかを一緒に持つ** —
   * タブを切り替えたときに、前の成果物の URL を出したままにしない
   * （`McpPane` と同じ作法）。
   */
  const [got, setGot] = useState<{ at: string; page: PublishedPage | null } | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    publishedFor(delId).then((p) => { if (live) setGot({ at: delId, page: p }); });
    return () => { live = false; };
  }, [delId]);

  /**
   * 開いている成果物が変わったら、聞きかけを閉じる。
   * **effect ではなく描いている途中で直す**（`lib/use-open.ts` と同じ）—
   * effect にすると、前の成果物の確認の文が1回描かれてから消える。
   */
  const [seen, setSeen] = useState(delId);
  if (seen !== delId) { setSeen(delId); setAsk(false); setErr(''); }

  const know = got?.at === delId;
  const page = know ? got.page : null;

  // **出せないものには、この節ごと出さない**（押せない灰色のボタンを置かない）
  if (whyNot(kind, state, body)) return null;

  const url = page ? `${typeof window === 'undefined' ? '' : window.location.origin}/p/${page.slug}` : '';

  const go = async () => {
    setBusy(true); setErr('');
    const r = await publishPage(delId);
    setBusy(false); setAsk(false);
    if (!r.ok) { setErr(r.message ?? '公開できませんでした'); return; }
    setGot({ at: delId, page: r.page ?? null });
  };
  const off = async () => {
    setBusy(true); setErr('');
    const r = await unpublishPage(delId);
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? '下げられませんでした'); return; }
    setGot({ at: delId, page: null });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { return; }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  };

  if (!know) return null;

  return (
    <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ color: T3 }}>公開</span>

      {page ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check" color={GREEN_T} size={13} width={2} />
            <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer" className="lnk" style={{
              color: T1, fontSize: 12.5, fontFamily: 'ui-monospace, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>/p/{page.slug}</a>
            <div style={{ flex: 1 }} />
            {done && <span style={{ color: T5, fontSize: 11 }}>コピーしました</span>}
            <button className="icob" title="URL をコピー" aria-label="URL をコピー" onClick={copy}
              style={{ display: 'inline-flex', padding: 4 }}>
              <Icon name="copy" color={T4} size={13} />
            </button>
          </div>
          {/* **黙って中身を変えない。** 落としたものは名前で言う */}
          {page.removed.length > 0 && (
            <span style={{ color: AMBER_T, fontSize: 11.5, lineHeight: '18px' }}>
              公開したページからは {page.removed.join('・')} を落としました
            </span>
          )}
          <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>
            出したのは押した時点の中身です。直したら、もう一度押すと入れ替わります。
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={go} disabled={busy} className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px',
              borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, fontSize: 12.5,
            }}>{busy ? '出しています…' : 'いまの中身にする'}</button>
            <button onClick={off} disabled={busy} className="lnk" style={{ color: T5, fontSize: 12 }}>
              公開をやめる
            </button>
            {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
          </div>
        </>
      ) : ask ? (
        <>
          <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>
            出すと、この会社の外の人が URL で読めます。検索やSNSに載ることもあり、
            一度出したものは、下げても誰かの手もとに残りえます。
            動くもの（script など）は落とします。
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={go} disabled={busy} className={busy ? undefined : 'solid'} style={{
              display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px',
              borderRadius: 8, background: busy ? '#1C1C1C' : BLUE, color: busy ? T5 : '#fff',
              fontSize: 12.5, cursor: busy ? 'default' : 'pointer',
            }}>{busy ? '出しています…' : '公開する'}</button>
            <button onClick={() => setAsk(false)} className="lnk" style={{ color: T5, fontSize: 12 }}>やめる</button>
            {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setAsk(true)} className="btn" style={{
            display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px',
            borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, fontSize: 12.5,
            background: RAIL,
          }}>公開する</button>
          <span style={{ color: T5, fontSize: 11.5 }}>URL がひとつできます</span>
          {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
        </div>
      )}
    </div>
  );
}
