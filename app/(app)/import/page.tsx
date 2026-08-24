'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useOpen, useParam } from '@/lib/use-open';
import { Centre, Composer, ExecStatus, Pane, PaneHead, TopBar } from '@/components/shell/Chrome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { pressable } from '@/lib/a11y';
import { importAdd, profileGet, runDiagnosis } from '@/app/actions/entry';
import type { Profile, SourceRow } from '@/lib/store';
import { BLUE, BLUE_T, COMPOSER_H, DIM, GREEN, HAIR, MUTE, RED_T, RULE, SUNK, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * ⓪-c 事業の取り込み（Case D）。**取り込んだものは本当に保存される**（`imported_sources`）。
 *
 * ・URL は貼る（中身はまだ読めない — 読めないものを読めたと言わない。status=待機）
 * ・文字のファイル（.md / .txt / .csv）は**その場で読む**（status=完了）
 * ・数字はそのまま書いて渡せる（入力欄 → doc として保存）
 * ・「診断する」で統括AIが deep の1往復。→ `/diagnosis`
 */

const ICON_OF: Record<SourceRow['kind'], IconName> = {
  site: 'globe', doc: 'deliv', sheet: 'deliv', analytics: 'bars', social: 'chat',
};
const KIND_JA: Record<SourceRow['kind'], string> = {
  site: 'サイト', doc: '資料', sheet: '表', analytics: '計測', social: 'SNS',
};
/** 状態の6語の中で言う（読込中という新語を作らない） */
const STATE_JA: Record<SourceRow['status'], string> = {
  queued: '待機', reading: '実行中', done: '完了', failed: 'エラー',
};

/** その場で読める形式。PDF や表計算はまだ読めない — 正直にそう返す */
const READABLE = /\.(md|txt|csv|tsv)$/i;

function Import() {
  const router = useRouter();
  const [pid, setPid] = useParam('p', '');
  const [open, setOpen] = useOpen();
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  const reload = useCallback((id: string) => { profileGet(id).then(setP); }, []);
  useEffect(() => { if (pid) reload(pid); }, [pid, reload]);

  const add = async (src: { locator: string; kind: 'site' | 'doc' | 'sheet'; summary?: string }) => {
    setFail('');
    const r = await importAdd(pid || null, src);
    if (!r.ok) { setFail(r.message); return; }
    if (!pid) setPid(r.id);
    reload(r.id);
  };

  const readFiles = (files: FileList | null) => {
    const skipped: string[] = [];
    for (const f of Array.from(files ?? []).slice(0, 8)) {
      if (!READABLE.test(f.name)) { skipped.push(f.name); continue; }
      const kind = /\.(csv|tsv)$/i.test(f.name) ? 'sheet' as const : 'doc' as const;
      f.text().then((t) => add({ locator: f.name, kind, summary: t })).catch(() => {});
    }
    if (skipped.length) setFail(`${skipped.join('、')} はまだ読めません（読めるのは .md .txt .csv）`);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (/^https?:\/\/\S+$/.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) {
      add({ locator: t.replace(/^https?:\/\//, ''), kind: 'site' });
    } else {
      // 数字や説明をそのまま渡す。読める中身なので done
      add({ locator: '書いて渡した', kind: 'doc', summary: t });
    }
  };

  const diagnose = async () => {
    if (!pid) return;
    setBusy(true); setFail('');
    const r = await runDiagnosis(pid);
    if (r.ok) { router.push(`/diagnosis?p=${pid}` as Route); return; }
    setBusy(false); setFail(r.message);
  };

  const sources = p?.sources ?? [];
  const done = sources.filter((s) => s.status === 'done').length;
  const sel = sources.find((s) => s.id === open);

  return (
    <>
      <Centre>
        <TopBar title="事業の取り込み" right={
          sources.length ? <span style={{ color: T5, fontSize: 12 }} className="tnum">{done} / {sources.length} 完了</span> : undefined
        } />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 15, lineHeight: '25px', maxWidth: 680 }}>
            いまの事業のことを教えてください。<b>あるものだけで構いません。</b>
          </span>

          {/* 本当に落とせて、本当に保存される */}
          <button type="button"
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); readFiles(e.dataTransfer.files); }}
            onClick={() => pick.current?.click()}
            className="card" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 9, height: 128, borderRadius: 12, width: '100%',
              border: `1px dashed ${over ? BLUE : RULE}`,
              background: over ? 'rgba(26,115,232,0.06)' : undefined,
              transition: 'border-color .14s ease, background-color .14s ease',
            }}>
            <Icon name="upload" color={over ? BLUE_T : T4} size={19} />
            <span style={{ color: T4, fontSize: 12.5 }}>資料をここへ。サイトのURLと数字は下の入力欄から</span>
            <span style={{ color: DIM, fontSize: 11 }}>.md · .txt · .csv</span>
          </button>
          <input ref={pick} type="file" accept=".md,.txt,.csv,.tsv" multiple hidden
                 onChange={(e) => { readFiles(e.target.files); e.target.value = ''; }} />

          {fail && <span style={{ color: RED_T, fontSize: 12.5 }}>{fail}</span>}

          {sources.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>取り込んだもの</span>
              <span style={{ color: T5, fontSize: 12 }} className="tnum">· {sources.length}</span>
            </div>
            {/* 1件1行。種類は右に列として並べ、進み具合は棒で見せる */}
            {sources.map((s, i) => {
              const pct = s.status === 'done' ? 100 : 0;
              return (
                <div key={s.id} className="row" {...pressable(() => setOpen(s.id))} style={{
                  display: 'flex', alignItems: 'center', gap: 14, height: 43,
                  borderBottom: i === sources.length - 1 ? undefined : `1px solid ${HAIR}`,
                }}>
                  <Icon name={ICON_OF[s.kind]} color={s.status === 'queued' ? `${DIM}` : T4} size={15} />
                  <span style={{
                    flex: 1, minWidth: 0, color: s.status === 'queued' ? T4 : T1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.locator}</span>
                  <span style={{ width: 140, flexShrink: 0, color: T5, fontSize: 11 }}>
                    {KIND_JA[s.kind]}{s.summary ? ` · ${s.summary.length.toLocaleString()}字` : ''}
                  </span>
                  <span style={{ width: 66, flexShrink: 0, height: 4, borderRadius: 2, background: SUNK, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: s.status === 'done' ? GREEN : MUTE }} />
                  </span>
                  <span style={{
                    width: 44, flexShrink: 0, textAlign: 'right', fontSize: 12,
                    color: s.status === 'failed' ? RED_T : s.status === 'done' ? T4 : T5,
                  }}>{STATE_JA[s.status]}</span>
                </div>
              );
            })}
          </div>
          )}

          {sources.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {busy
              ? <ExecStatus state="thinking" />
              : <span style={{ color: T5, fontSize: 12.5 }}>そろったら診断します。あとから足すこともできます</span>}
            <div style={{ flex: 1 }} />
            <button onClick={diagnose} disabled={busy} className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
              borderRadius: 8, background: BLUE, color: '#fff', opacity: busy ? 0.6 : 1,
            }}>{busy ? '診断しています…' : '診断する'}</button>
          </div>
          )}
        </div>
        <Composer placeholder="サイトのURLを貼る、または数字をそのまま書く" onSend={send} busy={busy} />
      </Centre>

      {open && sel && (
      <Pane onClose={() => setOpen(null)} width={400} icon={ICON_OF[sel.kind]} title={sel.locator}>
        <div key={sel.id} className="swap" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 0' }}>
          {sel.summary ? (
            <>
              <PaneHead>読み取れた中身</PaneHead>
              {/* 実際の書き出し。灰色の棒を置かない */}
              <pre style={{
                margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12, lineHeight: '20px', color: T2, whiteSpace: 'pre-wrap',
              }}>{sel.summary.slice(0, 1600)}{sel.summary.length > 1600 ? '\n…' : ''}</pre>
            </>
          ) : (
            <span style={{ display: 'block', color: T5, fontSize: 12.5, lineHeight: '20px', paddingTop: 4 }}>
              まだ中身は読めていません。URL の中身を読むのは、Web取得の鍵が入ってからです。
              いまは名前だけを診断の材料にします
            </span>
          )}
        </div>
      </Pane>
      )}
    </>
  );
}

export default function ImportPage() {
  return <Suspense fallback={null}><Import /></Suspense>;
}
