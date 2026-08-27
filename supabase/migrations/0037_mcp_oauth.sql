-- 0037: MCP の OAuth（2026-08-27。社長の「他のやつから順に」の②）。
--
-- ここまで、つなぐには**鍵を手で貼る**しかなかった（0028 の `token`）。
-- Notion や GitHub の鍵を自分で作って貼れる社長はまずいないので、
-- 「MCP は入っている」と言いながら**実際には誰も使えない**状態だった。
--
-- **鍵は行って戻らない**（0028 と同じ決めごと）。ここで足す列も、
-- 型（`McpServer`）には出さない — 画面に返るのは「繋がっているかどうか」だけ。
--
-- `token` は**access token の置き場として使い回す**（新しい列を作らない）。
-- 更新に要るものだけを足す。
alter table public.mcp_servers add column if not exists auth_kind text not null default 'none'
  check (auth_kind in ('none', 'token', 'oauth'));
alter table public.mcp_servers add column if not exists client_id text;
alter table public.mcp_servers add column if not exists client_secret text;
alter table public.mcp_servers add column if not exists token_url text;
alter table public.mcp_servers add column if not exists refresh_token text;
alter table public.mcp_servers add column if not exists expires_at timestamptz;
-- どの資源のための鍵か（RFC 8707）。引き換えと更新のたびに添える
alter table public.mcp_servers add column if not exists resource text;

comment on column public.mcp_servers.auth_kind is
  'none=鍵不要 / token=社長が貼った鍵 / oauth=相手の認可を踏んだ。**画面には kind だけ返す**';

-- すでに鍵を貼ってある行は「貼った鍵」に印を付ける（**黙って oauth 扱いにしない**）
update public.mcp_servers set auth_kind = 'token' where token is not null and auth_kind = 'none';
