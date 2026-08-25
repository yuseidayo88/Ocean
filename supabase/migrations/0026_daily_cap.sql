-- 0026: 「きょうのぶんの上限に当たりました」も1日1通（0015 と同じ姿勢）。
-- アプリ側の「あったら書かない」は、ポンプが2か所から同時に来ると両方すり抜ける。
--
-- 上限そのものは列を足さずに `token_ledger` の実績から数える（不変条件2 と同じ考え方）。
-- 見積もりを持たないので、ずれようがない。
create unique index if not exists notifications_cap_daily
  on public.notifications (account_id, group_key)
  where group_key like 'cap-%';
