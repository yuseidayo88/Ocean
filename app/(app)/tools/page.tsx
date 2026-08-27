'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/shell/Controls';
import { pressable } from '@/lib/a11y';
import { connectMcp, dropMcp, listMcp, mcpTools, recheckMcp, setMcp } from '@/app/actions/tools';
import type { McpServer } from '@/lib/mcp/types';
import { AMBER_T, BLUE, COMPOSER_H, DIM, GREEN_T, HAIR, RAIL, RED_T, RULE, SEAM, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';

/**
 * **つないだ道具**（MCP・Phase 12。2026-08-25）。
 *
 * 社長の指示「将来的にはMCP接続もできるようにしたい」。
 * ここはスキルの画面と同じ置き方 — 左レールには出さず、
 * メンバーの「全員に効くこと」から来る（会社ぜんぶに効くものなので）。
 *
 * **繋がっていないなら、そう出す。** 一覧に並んでいるのに何も呼べない、を作らない。
 * **鍵は行って戻らない** — 入れた鍵は保存先に入るだけで、画面には返ってこない。
 */

/** 状態の1行。**語は増やさない** — 繋がっている / 確かめていない / エラーの3つ */
function State({ m }: { m: McpServer }) {
  if (m.lastError) return <span style={{ color: RED_T, fontSize: 12 }}>{m.lastError}</span>;
  if (m.toolCount != null) {
    return <span style={{ color: GREEN_T, fontSize: 12 }} className="tnum">道具 {m.toolCount}</span>;
  }
  return <span style={{ color: T5, fontSize: 12 }}>まだ確かめていません</span>;
}

/**
 * **認可から戻ってきたときの一言**（2026-08-27）。
 * 短い合図（`?e=` / `?ok=`）を日本語1行にする — **黙って一覧に戻さない**
 * （入口（`/login`）と同じ作法。上流の英語はそのまま出さない）。
 */
const SAID: Record<string, string> = {
  auth: 'ログイン済',
  noid: 'どのつなぎ先か分かりませんでした',
  notfound: 'そのつなぎ先はありません',
  noauth: 'この相手はログインを求めていません（そのまま繋がります）',
  nopkce: 'この相手は安全な入り方（PKCE）に対応していません',
  denied: '許可されませんでした',
  expired: '時間切れです。もう一度押してください',
  state: '入り方が確かめられませんでした。もう一度押してください',
  token: '鍵を受け取れませんでした',
  auth_failed: 'ログインできませんでした',
};

const FIELD = {
  height: 36, padding: '0 12px', borderRadius: 8, background: RAIL,
  border: `1px solid ${RULE}`, color: T1, fontSize: 13, width: '100%', boxSizing: 'border-box' as const,
};

export default function ToolsPage() {
  const [rows, setRows] = useState<McpServer[] | null>(null);
  const reload = useCallback(() => { listMcp().then(setRows); }, []);
  useEffect(reload, [reload]);

  const all = rows ?? [];
  const [openId, setOpen] = useOpen();
  const sel = all.find((m) => m.id === openId);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /**
   * 認可から戻ってきた合図。**1回読んだら URL から消す**
   * （読み直しのたびに同じ一言が出ない。`history.replaceState` なのでサーバーに行かない）。
   *
   * **読むのは描いている途中**（`useOpen` と同じ作法）。effect の中で state を
   * 書くと、合図のない1枚を描いてから足すことになり、一言が遅れて出る。
   */
  const sp = useSearchParams();
  const bad = sp.get('e');
  const good = sp.get('ok');
  const [said] = useState(() => {
    const key = bad ?? good;
    if (!key) return null;
    return { ok: !bad, text: SAID[key] ?? (bad ? 'うまくいきませんでした' : '入れました') };
  });
  useEffect(() => {
    if (!said) return;
    const q = new URLSearchParams(window.location.search);
    if (!q.has('e') && !q.has('ok')) return;
    q.delete('e'); q.delete('ok');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [said]);

  const connect = async () => {
    setBusy(true); setErr('');
    const r = await connectMcp({ name, url, token });
    setBusy(false);
    reload();
    if (!r.ok) { setErr(r.message ?? 'つなげませんでした'); return; }
    setName(''); setUrl(''); setToken('');
  };

  const flip = async (m: McpServer, patch: { on?: boolean; write?: boolean }) => {
    setRows((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    await setMcp(m.id, patch);
    reload();
  };

  return (
    <>
      <Centre>
        <TopBar title="つないだ道具"
          onPanel={all.length ? () => setOpen(all[0].id) : undefined} panelOn={!!sel} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 26px ${COMPOSER_H}px`, display: 'flex', flexDirection: 'column', gap: 34 }}>
          {/* **認可から戻ってきたら、何が起きたかを1行で言う**（黙って戻さない） */}
          {said && (
            <span style={{ color: said.ok ? GREEN_T : AMBER_T, fontSize: 13 }}>{said.text}</span>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, paddingBottom: 6 }}>
              <span style={{ color: T3 }}>つないである先</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 12 }}>全員が使えます</span>
            </div>

            {rows !== null && all.length === 0 && (
              <span style={{ display: 'block', padding: '14px 0 4px', color: T5, fontSize: 12.5 }}>
                まだありません。MCP でつなぐと、AI社員が仕事のなかでそのまま読み書きします
              </span>
            )}

            {all.map((m, i) => (
              <div key={m.id} className="row" {...pressable(() => setOpen(m.id))} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '17px 0',
                borderBottom: i === all.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: m.on ? T1 : T4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    {/* **書けるのは例外**。読むだけが既定なので、そこだけ印を出す */}
                    {m.write && <span style={{ color: AMBER_T, fontSize: 10.5, flexShrink: 0 }}>書ける</span>}
                  </span>
                  <span style={{
                    color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460,
                  }}>{m.url}</span>
                </div>
                <div style={{ flex: 1 }} />
                <State m={m} />
                <Toggle on={m.on} label={`${m.name} を使う`} onPick={(next) => flip(m, { on: next })} />
                <button className="icob" title="外す" style={{ display: 'inline-flex', padding: 3 }}
                  onClick={async (e) => { e.stopPropagation(); await dropMcp(m.id); setOpen(null); reload(); }}>
                  <Icon name="trash" color={DIM} size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* 新しくつなぐ。**押せるものだけが面と枠を持てる** */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, paddingBottom: 10 }}>
              <span style={{ color: T3 }}>新しくつなぐ</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
              <input style={FIELD} placeholder="名前（Notion / うちの在庫 …）" value={name}
                     onChange={(e) => setName(e.target.value)} />
              <input style={FIELD} placeholder="https://… の MCP の行き先" value={url}
                     onChange={(e) => setUrl(e.target.value)} />
              <input style={FIELD} type="password" placeholder="鍵（要るときだけ）" value={token}
                     onChange={(e) => setToken(e.target.value)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={connect} disabled={busy || !name.trim() || !url.trim()}
                  className={busy || !name.trim() || !url.trim() ? undefined : 'solid'} style={{
                    display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 15px',
                    borderRadius: 8, fontSize: 13, flexShrink: 0,
                    background: busy || !name.trim() || !url.trim() ? SEAM : BLUE,
                    color: busy || !name.trim() || !url.trim() ? T5 : '#fff',
                    cursor: busy || !name.trim() || !url.trim() ? 'default' : 'pointer',
                  }}>{busy ? '確かめています…' : 'つないで確かめる'}</button>
                {err && <span style={{ color: RED_T, fontSize: 12 }}>{err}</span>}
              </div>
            </div>
          </div>
        </div>
        <Composer placeholder="つなぎ方を統括AIに聞く" />
      </Centre>

      {sel && <McpPane m={sel} onClose={() => setOpen(null)}
        onWrite={(next) => flip(sel, { write: next })}
        onRecheck={async () => { await recheckMcp(sel.id); reload(); }} />}
    </>
  );
}

/** つないだ先の1件。**相手が名乗っている道具をそのまま並べる**（こちらで名前を作らない） */
function McpPane({ m, onClose, onWrite, onRecheck }: {
  m: McpServer; onClose: () => void; onWrite: (next: boolean) => void; onRecheck: () => Promise<void>;
}) {
  const [tools, setTools] = useState<{ name: string; description: string; readOnly: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  // 開いた1件が入れ替わったら読み直す。**前の先の道具を出したままにしない**
  const [at, setAt] = useState('');
  useEffect(() => { mcpTools(m.id).then((xs) => { setAt(m.id); setTools(xs); }); }, [m.id]);
  const shown = at === m.id ? tools : null;

  return (
    <Pane width={430} icon="gear" title={m.name} onClose={onClose}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{m.url}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <State m={m} />
            <div style={{ flex: 1 }} />
            {/**
              * **入り方を出す**（2026-08-27）。前は「鍵あり / 鍵なし」だけで、
              * OAuth で入ったのか社長が貼ったのかが区別できなかった。
              * **中身は返らない** — 出すのは入り方と、いま入れているかだけ。
              */}
            <span style={{ color: m.needsAuth ? AMBER_T : T5, fontSize: 11 }}>
              {m.needsAuth ? 'ログインが切れています'
                : m.authKind === 'oauth' ? 'ログイン済'
                : m.hasToken ? '鍵あり' : '鍵なし'}
            </span>
            <button className="btn" disabled={busy} onClick={async () => { setBusy(true); await onRecheck(); setBusy(false); }}
              style={{ height: 26, padding: '0 10px', borderRadius: 6, border: `1px solid ${SEAM}`, color: T4, fontSize: 11.5 }}>
              {busy ? '確かめています…' : 'もう一度確かめる'}
            </button>
          </div>
        </div>

        {/**
          * **鍵を手で貼らずに入る**（2026-08-27。社長の「他のやつから順に」の②）。
          *
          * 押すと相手の認可の画面へ行って、戻ってくると入れている。
          * **相手が求めていなければ、そう言って戻る**（要らない認可を踏ませない）。
          * ここは `<a>` — サーバーが行き先を組んで送り出すので、画面は押すだけ。
          */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: T2 }}>{m.authKind === 'oauth' ? '入り直す' : '相手にログインして入る'}</span>
            <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>
              {m.authKind === 'oauth'
                ? '切れたら自動で取り直します。それでも駄目なときだけ押してください。'
                : '鍵を作って貼らなくても、相手の画面で許可すれば入れます。'}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <a href={`/api/mcp/start?id=${m.id}`} className="btn" style={{
            display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
            borderRadius: 7, border: `1px solid ${m.needsAuth ? 'rgba(227,116,0,0.42)' : SEAM}`,
            color: m.needsAuth ? AMBER_T : T4, fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap',
          }}>ログイン</a>
        </div>

        {/* **書けるようにするのは社長の判断。** 既定は読むだけ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingTop: 4 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: T2 }}>書ける道具まで許す</span>
            <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>
              切っているあいだ、AI社員には読む道具しか渡りません
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <Toggle on={m.write} label="書ける道具まで許す" onPick={onWrite} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
            <span style={{ color: T3 }}>この先の道具</span>
          </div>
          {shown === null && <span style={{ display: 'block', padding: '10px 0', color: T5, fontSize: 12 }}>読んでいます…</span>}
          {shown?.length === 0 && (
            <span style={{ display: 'block', padding: '10px 0', color: T5, fontSize: 12 }}>
              いまは読めませんでした
            </span>
          )}
          {(shown ?? []).map((t, i) => (
            <div key={t.name} style={{
              display: 'flex', flexDirection: 'column', gap: 3, padding: '11px 0',
              borderBottom: i === (shown ?? []).length - 1 ? undefined : `1px solid ${HAIR}`,
              opacity: t.readOnly || m.write ? 1 : 0.45,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: T2, fontSize: 12.5, fontFamily: 'ui-monospace, monospace' }}>{t.name}</span>
                {!t.readOnly && <span style={{ color: AMBER_T, fontSize: 10.5 }}>書く</span>}
              </span>
              {t.description && (
                <span style={{ color: T5, fontSize: 11.5, lineHeight: '18px' }}>{t.description.slice(0, 160)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Pane>
  );
}
