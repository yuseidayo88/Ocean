'use server';

import { store } from '@/lib/store';
import type { McpServer } from '@/lib/mcp/types';
import { badUrl, listTools } from '@/lib/mcp/client';
import { sayError } from '@/lib/errors';

/**
 * **つないだ道具**（MCP・Phase 12。2026-08-25）。
 *
 * 社長の指示「将来的にはMCP接続もできるようにしたい」。
 * ここは**社長の操作**の口 — つなぐ / 切る / 書けるようにする / 確かめ直す。
 * AI社員が実際に呼ぶところは `lib/mcp/company.ts` と `lib/run/worker.ts`。
 *
 * **鍵は行って戻らない。** 入れた鍵は保存先に入るだけで、
 * ここから返る型（`McpServer`）には**そもそも入っていない**。
 */

export async function listMcp(): Promise<McpServer[]> {
  try { return await store().listMcpServers(); } catch { return []; }
}

/**
 * つなぐ。**保存する前に、本当に繋がるか確かめる** —
 * 繋がらないものを一覧に並べても、社長は何が悪いのか分からない。
 * ただし**繋がらなくても保存はする**（鍵の打ち直しができるように）。
 * そのかわり一覧に理由を出し、**繋がるまで使わない**（`on` は立てるが道具は0）。
 */
export async function connectMcp(x: { name: string; url: string; token?: string }): Promise<{
  ok: boolean; message?: string; tools?: number;
}> {
  const name = x.name.trim();
  const url = x.url.trim();
  if (!name) return { ok: false, message: '名前を書いてください' };
  const bad = badUrl(url);
  if (bad) return { ok: false, message: bad };
  try {
    const s = store();
    const id = await s.addMcpServer({ name, url, token: x.token?.trim() || undefined });
    const r = await listTools({ id, name, url, token: x.token?.trim() || undefined });
    await s.noteMcpCheck(id, r.ok ? { tools: r.tools.length } : { error: r.error });
    if (!r.ok) return { ok: false, message: r.error };
    if (!r.tools.length) return { ok: false, message: '繋がりましたが、道具が1つもありませんでした' };
    return { ok: true, tools: r.tools.length };
  } catch (e) {
    return { ok: false, message: sayError(e, 'つなげませんでした') };
  }
}

/** 使う・書ける・名前 を変える。**切り替えたその場で効く**（保存ボタンは置かない） */
export async function setMcp(id: string, patch: { on?: boolean; write?: boolean; name?: string }): Promise<
  { ok: boolean; message?: string }> {
  try { await store().setMcpServer(id, patch); return { ok: true }; }
  catch (e) { return { ok: false, message: sayError(e, '変えられませんでした') }; }
}

/** つなぐのをやめる */
export async function dropMcp(id: string): Promise<{ ok: boolean; message?: string }> {
  try { await store().removeMcpServer(id); return { ok: true }; }
  catch (e) { return { ok: false, message: sayError(e, '外せませんでした') }; }
}

/** もう一度確かめる。**繋がっていないなら、そう出す** */
export async function recheckMcp(id: string): Promise<{ ok: boolean; message?: string; tools?: number }> {
  try {
    const s = store();
    const row = (await s.listMcpServers()).find((m) => m.id === id);
    if (!row) return { ok: false, message: 'その道具は見つかりませんでした' };
    const token = await s.mcpSecret(id);
    const r = await listTools({ id, name: row.name, url: row.url, token });
    await s.noteMcpCheck(id, r.ok ? { tools: r.tools.length } : { error: r.error });
    return r.ok ? { ok: true, tools: r.tools.length } : { ok: false, message: r.error };
  } catch (e) {
    return { ok: false, message: sayError(e, '確かめられませんでした') };
  }
}

/** その道具が名乗っている中身（つないだ先の1件を開いたときに読む） */
export async function mcpTools(id: string): Promise<{ name: string; description: string; readOnly: boolean }[]> {
  try {
    const s = store();
    const row = (await s.listMcpServers()).find((m) => m.id === id);
    if (!row) return [];
    const r = await listTools({ id, name: row.name, url: row.url, token: await s.mcpSecret(id) });
    return r.ok ? r.tools.map((t) => ({ name: t.name, description: t.description, readOnly: t.readOnly })) : [];
  } catch { return []; }
}
