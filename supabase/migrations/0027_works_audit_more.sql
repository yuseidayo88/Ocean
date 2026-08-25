-- 0027: 台帳に**はじまりと終わり**も残す（0008 は途中だけ見ていた）。
--
-- 0008 は `after update` しか無かったので、**Work が立ったこと自体が1行も残らない**。
-- 承認と引き直しは残るのに、いつ何のために立った Work なのかが台帳から辿れなかった。
--
-- 会社が**見ていないあいだも動く**ようになった（2026-08-25 の Cron）ので、
-- あとから「何が起きていたのか」を台帳だけで読めることの重みが変わった。
-- 止まった（paused）と終わった（done）も残す。

create or replace function private.works_born() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into audit_events (account_id, actor, actor_id, verb, subject_type, subject_id, payload)
  values (new.account_id, 'user', auth.uid(), 'work.created', 'work', new.id,
          jsonb_build_object('title', new.title, 'status', new.status));
  return null;
end $$;

drop trigger if exists works_born on works;
create trigger works_born after insert on works
  for each row execute function private.works_born();

comment on function private.works_born() is
  'Work が立ったことを audit_events に残す。0008 は update しか見ていなかった';

-- 途中の分岐を足す（0008 の関数を差し替える。承認と引き直しはそのまま）
create or replace function private.works_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'plan_review' and new.status = 'active' then
    insert into audit_events (account_id, actor, actor_id, verb, subject_type, subject_id, payload)
    values (new.account_id, 'user', auth.uid(), 'work.approved', 'work', new.id,
            jsonb_build_object(
              'phases', (select count(*) from phases where work_id = new.id),
              'tasks',  (select count(*) from tasks  where work_id = new.id)));

  elsif new.status = 'plan_review' and new.plan_draft is distinct from old.plan_draft then
    insert into audit_events (account_id, actor, actor_id, verb, subject_type, subject_id, payload)
    values (new.account_id, 'user', auth.uid(), 'work.replanned', 'work', new.id,
            jsonb_build_object(
              'phases', coalesce(jsonb_array_length(new.plan_draft -> 'plan' -> 'phases'), 0)));

  -- 枠に当たって止まった。**社長ではなく仕組みが止めた**ので actor は system
  elsif old.status <> 'paused' and new.status = 'paused' then
    insert into audit_events (account_id, actor, verb, subject_type, subject_id, payload)
    values (new.account_id, 'system', 'work.paused', 'work', new.id,
            jsonb_build_object('from', old.status));

  elsif old.status <> 'done' and new.status = 'done' then
    insert into audit_events (account_id, actor, verb, subject_type, subject_id, payload)
    values (new.account_id, 'system', 'work.done', 'work', new.id,
            jsonb_build_object('phases', (select count(*) from phases where work_id = new.id)));
  end if;
  return null;
end $$;
