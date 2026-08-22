-- RLS — テナント表はすべて account_id で絞る。
-- ここを1か所にまとめてあるのは、表を足したときに書き忘れないため。

do $$
declare t text;
begin
  foreach t in array array[
    'accounts','users',
    'works','phases','tasks','employees','employee_settings','agent_skills',
    'runs','run_steps','deliverables','decisions',
    'discovery_sessions','discovery_candidates',
    'business_profiles','imported_sources','diagnoses',
    'chat_threads','chat_messages','questions',
    'hire_candidates','notifications','token_ledger','audit_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- accounts / users は自分のぶんだけ
create policy account_self on accounts
  for select using (id = current_account_id());
create policy users_same_account on users
  for select using (account_id = current_account_id());
create policy users_update_self on users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- account_id を持つ表は一律で同じ形
do $$
declare t text;
begin
  foreach t in array array[
    'works','phases','tasks','employees','employee_settings','agent_skills',
    'runs','run_steps','deliverables','decisions',
    'discovery_sessions','discovery_candidates',
    'business_profiles','imported_sources','diagnoses',
    'chat_threads','chat_messages','questions',
    'hire_candidates','notifications','token_ledger','audit_events'
  ] loop
    execute format(
      'create policy %I on %I for all using (account_id = current_account_id())
         with check (account_id = current_account_id())', t || '_tenant', t);
  end loop;
end $$;

-- 中間表は親をたどって絞る
alter table task_deps          enable row level security;
alter table deliverable_inputs enable row level security;
alter table decision_refs      enable row level security;

create policy task_deps_tenant on task_deps for all
  using (exists (select 1 from tasks x where x.id = task_id and x.account_id = current_account_id()))
  with check (exists (select 1 from tasks x where x.id = task_id and x.account_id = current_account_id()));

create policy deliverable_inputs_tenant on deliverable_inputs for all
  using (exists (select 1 from deliverables d where d.id = deliverable_id and d.account_id = current_account_id()))
  with check (exists (select 1 from deliverables d where d.id = deliverable_id and d.account_id = current_account_id()));

create policy decision_refs_tenant on decision_refs for all
  using (exists (select 1 from decisions d where d.id = decision_id and d.account_id = current_account_id()))
  with check (exists (select 1 from decisions d where d.id = decision_id and d.account_id = current_account_id()));

-- 残高・実行の記録・監査は社長に書かせない（不変条件 1 / 2 / 5）。書くのはバックエンドだけ
revoke insert, update, delete on token_ledger from authenticated;
revoke insert, update, delete on run_steps    from authenticated;
revoke insert, update, delete on audit_events from authenticated;

-- 不変条件 1: 進捗はどこからも直接書かれない。
-- 列単位の revoke は表単位の update 権限があると効かないので、トリガで止める。
-- バックエンドだけが onefound.backend = 'on' を立てて書ける。
create or replace function tasks_progress_is_derived() returns trigger
language plpgsql as $$
begin
  if new.progress is distinct from old.progress
     and coalesce(current_setting('onefound.backend', true), 'off') <> 'on' then
    raise exception '進捗は run_steps から導出される値です。直接は書けません';
  end if;
  return new;
end $$;
create trigger tasks_progress_is_derived before update on tasks
  for each row execute function tasks_progress_is_derived();

-- サインアップで会社と自分の行を1つずつ作る
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  insert into accounts (name) values (coalesce(new.email, 'あなたの会社')) returning id into a;
  insert into users (id, account_id, email) values (new.id, a, new.email);
  insert into token_ledger (account_id, delta_cents, reason)
    values (a, 500, 'grant');            -- 7日トライアルの初期枠（$5.00）
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
