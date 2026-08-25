/**
 * **つないだ道具**（MCP。2026-08-25。社長の指示
 * 「将来的にはMCP接続もできるようにしたい」）。
 *
 * AI社員が、社長がふだん使っているものを**そのまま読む・書く**ための口。
 * MCP（Model Context Protocol）は、道具の側が「どんな道具があるか」を
 * 自分で名乗る決まりなので、**こちらに相手ごとの実装を持たなくていい**のがいい。
 *
 * OneFound は **client の側**（相手のサーバーにつなぐ）。
 * `lib/mcp/client.ts` が話し、`lib/run/worker.ts` が仕事の中で呼ぶ。
 */

/** つないだ先。会社に対して1つ（社員ごとではない） */
export type McpServer = {
  id: string;
  /** 社長が付ける名前（「Notion」「うちの在庫」）。画面と依頼文に出る */
  name: string;
  /** 話しかける先。**本番は https だけ** */
  url: string;
  /** 相手に渡す鍵。持っていることは出すが、**中身は画面に返さない** */
  hasToken: boolean;
  /**
   * **書ける道具まで許すか。**
   * 既定は「読むだけ」— 外に出る道具（メール・公開・支払い）は Approval 必須、
   * という決めごとの一形（→ `docs/PLAN.md` 守るルール）。
   */
  write: boolean;
  /** 使うか。切っているあいだ、依頼文に道具は載らない */
  on: boolean;
  /** 最後に確かめたときの結果。**繋がっていないなら、そう出す** */
  checkedAt?: string;
  toolCount?: number;
  lastError?: string;
};

/** 相手が名乗った道具1つ */
export type McpTool = {
  serverId: string;
  serverName: string;
  /** 相手での名前 */
  name: string;
  description: string;
  schema: Record<string, unknown>;
  /**
   * 相手が「読むだけ」と言っているか（MCP の `annotations.readOnlyHint`）。
   * **言っていることを鵜呑みにしない** — 許すかどうかは `McpServer.write` が決める。
   */
  readOnly: boolean;
};

/** 呼んだ結果。**倒れない** — 失敗も文字で返して、社員に読ませる */
export type McpResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * AI社員に渡す道具の名前は `mcp__<つないだ先>__<道具>`。
 * **どこの道具かが名前で分かる**ようにしておく（社員が名前だけ見て選ぶので）。
 */
export const TOOL_PREFIX = 'mcp__';

/** 依頼文に載せる道具の上限。**多すぎると社員が選べない**し、往復も太る */
export const MAX_TOOLS = 12;

/**
 * つないだ道具があるときの、1タスクあたりの往復の上限。
 * **3で止める** — 読む・確かめる・書く で足りるし、
 * 上限が無いと相手のサーバー次第でいくらでも払うことになる。
 */
export const MCP_ROUNDS = 3;
