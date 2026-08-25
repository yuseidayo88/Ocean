import { store } from '@/lib/store';
import { callTool, listTools } from './client';
import { MAX_TOOLS, TOOL_PREFIX, type McpResult, type McpTool } from './types';

/**
 * **会社がつないでいる道具を、AI社員の道具として渡す**（Phase 12。2026-08-25）。
 *
 * 相手のサーバーが「どんな道具があるか」を自分で名乗るので、
 * ここは**名前を付け替えて並べるだけ**（相手ごとの実装を持たない）。
 *
 * 名前は `mcp__<つないだ先>__<道具>`。**どこの道具かが名前で分かる**ようにしておく —
 * 社員は名前と説明だけを見て選ぶので、「どこの Notion か」が言えないと選べない。
 */

export type Ready = {
  tools: McpTool[];
  /** モデルに渡す形（`ToolDef` と同じ形。`lib/ai/types.ts` の器に載る） */
  defs: { name: string; description: string; input_schema: Record<string, unknown> }[];
  /** 呼ぶときに引く（名前 → 相手と鍵） */
  byName: Map<string, { tool: McpTool; url: string; token?: string; write: boolean }>;
};

const EMPTY: Ready = { tools: [], defs: [], byName: new Map() };

/**
 * 道具の名前は英数字と `_` と `-` だけ（モデル側の決まり）。
 *
 * **日本語の名前は、寄せると意味ごと消える** —「テストの在庫」は `______` になり、
 * `mcp________list_items` のような読めない名前ができる（実際そうなった）。
 * 英数字が1文字も残らなければ**並び順の番号**にして、
 * どこの道具かは説明のほうで言う（説明は日本語のまま出せる）。
 */
const slug = (s: string, fallback: string) => {
  const v = s.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  return /[A-Za-z0-9]/.test(v) ? v : fallback;
};

/**
 * いま使える道具を集める。**繋がらない相手は黙って飛ばす** —
 * 1つ落ちているせいで仕事が始まらない、が起きないように。
 * （繋がらなかったことは `noteMcpCheck` で一覧に残るので、隠してはいない）
 */
export async function readyTools(): Promise<Ready> {
  const s = store();
  const servers = (await s.listMcpServers().catch(() => [])).filter((m) => m.on);
  if (!servers.length) return EMPTY;

  const out: Ready = { tools: [], defs: [], byName: new Map() };
  for (const m of servers) {
    if (out.tools.length >= MAX_TOOLS) break;
    const token = await s.mcpSecret(m.id).catch(() => undefined);
    const r = await listTools({ id: m.id, name: m.name, url: m.url, token });
    if (!r.ok) { await s.noteMcpCheck(m.id, { error: r.error }).catch(() => {}); continue; }
    await s.noteMcpCheck(m.id, { tools: r.tools.length }).catch(() => {});

    for (const t of r.tools) {
      if (out.tools.length >= MAX_TOOLS) break;
      /**
       * **書ける道具は、社長が許した相手のぶんだけ。**
       * 相手が「読むだけ」と言っているかは参考にするが、鵜呑みにはしない —
       * 決めるのは `write`（社長が入れた設定）のほう。
       * 外に出る道具（メール・公開・支払い）は Approval 必須、の一形。
       */
      if (!t.readOnly && !m.write) continue;
      const name = `${TOOL_PREFIX}${slug(m.name, `s${servers.indexOf(m) + 1}`)}__${slug(t.name, 'tool')}`;
      if (out.byName.has(name)) continue;      // 名前がぶつかったら先に来たほうを残す
      out.tools.push(t);
      out.defs.push({
        name,
        description: `${m.name} の道具「${t.name}」。${t.description}`.slice(0, 500),
        input_schema: t.schema,
      });
      out.byName.set(name, { tool: t, url: m.url, token, write: m.write });
    }
  }
  return out;
}

/** 呼ぶ。**倒れない** — 知らない名前も、失敗も、文字で返して社員に読ませる */
export async function runTool(ready: Ready, name: string, args: Record<string, unknown>): Promise<McpResult> {
  const at = ready.byName.get(name);
  if (!at) return { ok: false, error: `${name} という道具はありません` };
  if (!at.tool.readOnly && !at.write) return { ok: false, error: 'この道具は読むだけの設定です' };
  return callTool({ url: at.url, token: at.token }, at.tool.name, args);
}

/** 依頼文に載せる1行（社員が「何が使えるか」を先に知る） */
export function toolsLine(ready: Ready): string[] {
  if (!ready.defs.length) return [];
  return ['', 'つないである道具（必要なときだけ呼ぶ。呼んだら結果を成果物に活かす）:',
          ...ready.defs.map((d) => `- ${d.name} … ${d.description.slice(0, 120)}`)];
}
