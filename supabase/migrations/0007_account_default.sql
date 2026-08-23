-- account_id はアプリに書かせない。**データベースが入れる。**
--
-- 表が23ある。1か所でも書き忘れると、そこだけ本番で NOT NULL 違反になる
-- （実際 Phase 5 の insert は全部 account_id を持っていなくて、
--  この環境ではセッションが無いので最後まで気づけなかった）。
-- 既定値を全表に置けば、書き忘れようがない。
--
-- RLS の with check は `account_id = private.current_account_id()` のままなので、
-- 既定値と方針が一致する（**ポリシーは1行も書き換えない** → Phase 11 の複数社も無変更）。
--
-- accounts / users は入れない。users.account_id はサインアップのときに決まるもので、
-- 「いまの会社」から引くものではない。

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
    execute format('alter table %I alter column account_id set default private.current_account_id()', t);
  end loop;
end $$;
