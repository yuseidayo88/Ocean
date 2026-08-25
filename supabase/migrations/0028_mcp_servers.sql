-- 0028: つないだ道具（MCP サーバー）
--
-- 社長の指示「将来的にはMCP接続もできるようにしたい」（2026-08-25）。
-- AI社員が、社長がふだん使っているもの（Notion / 在庫 / 予約 …）を
-- **そのまま読む・書く**ための口。OneFound は **client の側**。
--
-- **会社に対して1つ**（社員ごとではない）。会社ぜんぶのスキルと同じ置き方で、
-- どの社員の仕事にも同じ道具が並ぶ。誰に使わせるかを分けたくなったら、
-- `agent_skills` と同じく employee_id の列を足す。
--
-- **鍵は画面に返さない。** ただし止め方は**コードのほう**（下の注を見よ）—
-- DB の列の権限で止めると、引くために `public` の SECURITY DEFINER が要り、
-- それだけで警告が1件増える。

create table mcp_servers (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null default private.current_account_id()
              references accounts(id) on delete cascade,
  -- 社長が付ける名前（「Notion」「うちの在庫」）。画面にも依頼文にも出る
  name        text not null,
  -- 話しかける先。**本番は https だけ**（コード側 `badUrl` で止める）
  url         text not null,
  -- 相手に渡す鍵。**型（`McpServer`）に持たせない**ので画面には出ない
  token       text,
  -- **書ける道具まで許すか。** 既定は読むだけ
  -- （外に出る道具は Approval 必須、の一形）
  write_ok    boolean not null default false,
  enabled     boolean not null default true,
  -- 最後に確かめたときの結果。**繋がっていないなら、そう出す**
  checked_at  timestamptz,
  tool_count  int,
  last_error  text,
  created_at  timestamptz not null default now()
);

-- 実行のたびに読む表（0016 と同じ理由の覆い index）
create index on mcp_servers (account_id, enabled);

-- **同じ行き先を二度つながない**（二度押し・同時押しで2行にならない。0015 / 0017 と同じ姿勢）
create unique index mcp_servers_once on mcp_servers (account_id, url);

-- RLS は 0003 と同じ一形。**複数社に開くときも、この行は書き換えなくていい**
alter table mcp_servers enable row level security;
alter table mcp_servers force row level security;
create policy mcp_servers_tenant on mcp_servers for all
  using (account_id = private.current_account_id())
  with check (account_id = private.current_account_id());

grant select, insert, update, delete on mcp_servers to authenticated;

-- **鍵を引く関数は置かない。**
-- `token` を select の列から外して `public.mcp_secret()` で1本だけ引く形も試したが、
-- **`public` の SECURITY DEFINER はそれだけで警告が1件増える**
-- （`authenticated_security_definer_function_executable`）。
-- スキーマ由来の警告0件は守る — そして会社の利用者が、
-- **自分で入れた鍵を自分で引ける**ことは、そもそも隠す必要が無い。
--
-- 守るのは「一覧を引いたら鍵まで画面に届いていた」のほうで、それは**コードで守る** —
-- `McpServer` の型に `token` を置かず（`hasToken` だけ）、
-- 引くのは `lib/store` の `mcpSecret(id)` 1か所だけにしてある。
