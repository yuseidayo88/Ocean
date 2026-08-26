-- セントは整数ではない（2026-08-26）。
--
-- 本番の最初の会社で、**6回の実行が6回とも `cost_cents = 0` で記帳されていた**。
-- トークンは本当に使っている（in 2,081 / out 129）のに、原価が 0 になる:
--
--   in  2,081 × $0.2/1M = $0.000416
--   out   129 × $1.2/1M = $0.000155
--   合計 $0.000571 = **0.057 セント** → bigint に入るとき 0 に丸められる
--
-- `run_ledger`（0014）は `cost_cents > 0` のときだけ台帳に落とすので、
-- **台帳には1行も入らない**。つまり:
--   ・残高が減らない → 「残高が尽きたら paused」が永久に効かない
--   ・きょう使ったぶんが 0 のまま → 1日の上限（0026 の通知も）が永久に効かない
--   ・`/billing` の「これまでの出入り」に、使ったぶんが1行も出ない
--
-- 1セント = 1,000トークン（→ docs/design/05）なので、2,000トークンの往復が
-- 1セントに満たないのは**ふつうのこと**。整数で持っていたのが間違いだった。
--
-- **単位は変えない**（セントのまま）。端数を捨てないだけ。
-- 不変条件2（残高は台帳の合計から導出する）はそのまま。

alter table runs
  alter column cost_cents type numeric(20,6) using cost_cents::numeric;

alter table token_ledger
  alter column delta_cents type numeric(20,6) using delta_cents::numeric;

-- 合計の型も揃える（戻り型が変わるので作り直し）
drop function if exists account_balance_cents(uuid);
create function account_balance_cents(a uuid) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(delta_cents), 0) from token_ledger where account_id = a
$$;

comment on column runs.cost_cents is
  'この実行の原価（セント。端数を持つ — 2,000トークンの往復は 0.06 セントほど）';
comment on column token_ledger.delta_cents is
  '出入り（セント。付与は正・消費は負。端数を持つ）';
