-- 実行の原価を台帳に写す（Phase 11）。
--
-- `token_ledger` は**アプリから書けない**（authenticated は SELECT のみ —
-- 開けると正の delta で残高を偽造できる）。works の監査（0008）と同じく引き金にする:
-- 実行が終わったら、runs.cost_cents をそのまま負の1行として台帳に落とす。
--
-- **正直な注記**: runs は authenticated が UPDATE できるので、悪意ある呼び手が
-- cost_cents を 0 にしてから閉じれば記帳を免れられる。ここで守っているのは
-- 「アプリの書き忘れ」であって「悪意」ではない。悪意まで守るのは、実行が
-- 自分の credential を持つ場所（Cloudflare の Durable Object）へ移るとき。
-- → docs/design/05-tech-and-cost.md

create or replace function private.run_ledger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('done', 'failed') and old.status is distinct from new.status
     and new.cost_cents > 0 then
    insert into token_ledger (account_id, delta_cents, reason, run_id, work_id)
    values (new.account_id, -new.cost_cents, 'consume',
            new.id, (select work_id from tasks where id = new.task_id));
  end if;
  return null;
end $$;

drop trigger if exists run_ledger on runs;
create trigger run_ledger after update on runs
  for each row execute function private.run_ledger();

comment on function private.run_ledger() is
  '実行が終わったら原価を台帳に落とす。アプリは token_ledger に書けない（残高の偽造を防ぐ）';
