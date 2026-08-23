-- 承認と引き直しを台帳に残す。**アプリには書かせない。**
--
-- `audit_events` は裏方が書く表で、`authenticated` に insert は渡していない
-- （`run_steps` `token_ledger` と同じ。渡すと executive / system の行まで偽造できる）。
-- かといって `public` に SECURITY DEFINER の関数を置くと `/rest/v1/rpc` から叩けてしまい、
-- リンターの警告が1件増える。**警告0件は守る。**
--
-- なので引き金にする。`works` の状態が変わったら台帳に1行できる —
-- アプリが呼び忘れることも、嘘の数を書くこともできない
-- （→ `docs/RUNNING.md`「データベース側で守っていること」）。

create or replace function private.works_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- 承認して動きだした
  if old.status = 'plan_review' and new.status = 'active' then
    insert into audit_events (account_id, actor, actor_id, verb, subject_type, subject_id, payload)
    values (new.account_id, 'user', auth.uid(), 'work.approved', 'work', new.id,
            jsonb_build_object(
              'phases', (select count(*) from phases where work_id = new.id),
              'tasks',  (select count(*) from tasks  where work_id = new.id)));

  -- 承認前に計画を引き直した（フェーズとタスクはこのあと入れ替わるので、控えのほうを数える）
  elsif new.status = 'plan_review' and new.plan_draft is distinct from old.plan_draft then
    insert into audit_events (account_id, actor, actor_id, verb, subject_type, subject_id, payload)
    values (new.account_id, 'user', auth.uid(), 'work.replanned', 'work', new.id,
            jsonb_build_object(
              'phases', coalesce(jsonb_array_length(new.plan_draft -> 'plan' -> 'phases'), 0)));
  end if;
  return null;
end $$;

drop trigger if exists works_audit on works;
create trigger works_audit after update on works
  for each row execute function private.works_audit();

comment on function private.works_audit() is
  '承認（plan_review → active）と引き直しを audit_events に残す。
   アプリは audit_events に insert できないので、ここが唯一の経路';

-- 0008 の前の案（public.log_user_event）は撤回した。
-- 外から叩ける SECURITY DEFINER を1つ増やすより、引き金のほうが強くて静か
drop function if exists public.log_user_event(text, text, uuid, jsonb);
