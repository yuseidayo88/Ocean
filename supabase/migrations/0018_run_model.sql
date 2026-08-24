-- 0018: 実行が「どのモデルで走ったか」を残す（AI ガバナンスの土台）。
-- Run ごとの Model / Provider / Cost の記録 — cost と tier は最初からある。
-- 委託先の開示（provider の固定）は Phase 11 の宿題のまま。
alter table runs add column model text;
comment on column runs.model is '実際に使ったモデルの slug（例 anthropic/claude-sonnet-5。鍵の無い環境は fake）';
