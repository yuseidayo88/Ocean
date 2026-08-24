-- 0016: システムの再点検で出た2件（どちらもリンターの指摘）。
--
-- ① FK に覆いの index が無い31本。ポンプは2.5秒ごとに tasks / runs / deliverables を
--    読むので、行が増えるほど素通しの走査になる。全部 additive（動きは変えない）
-- ② users_update_self が auth.uid() を**行ごとに**再評価していた（initplan の警告）。
--    (select auth.uid()) に包むと1文につき1回になる。意味は同じ

-- ① 実行の道（ポンプ・進捗・記帳が毎回通る）
create index if not exists runs_task_idx            on public.runs (task_id);
create index if not exists runs_employee_idx        on public.runs (employee_id);
create index if not exists tasks_phase_idx          on public.tasks (phase_id);
create index if not exists tasks_assignee_idx       on public.tasks (assignee_employee_id);
create index if not exists deliverables_work_idx    on public.deliverables (work_id);
create index if not exists deliverables_task_idx    on public.deliverables (task_id);
create index if not exists deliverables_by_idx      on public.deliverables (produced_by_employee_id);
create index if not exists decisions_work_idx       on public.decisions (work_id);
create index if not exists decisions_task_idx       on public.decisions (task_id);
create index if not exists decisions_supersedes_idx on public.decisions (supersedes_id);
create index if not exists decision_refs_run_idx    on public.decision_refs (run_id);
create index if not exists token_ledger_run_idx     on public.token_ledger (run_id);
create index if not exists token_ledger_work_idx    on public.token_ledger (work_id);
create index if not exists works_current_phase_idx  on public.works (current_phase_id);
create index if not exists works_origin_phase_idx   on public.works (origin_phase_id);
create index if not exists phases_promoted_idx      on public.phases (promoted_to_work_id);
create index if not exists task_deps_depends_idx    on public.task_deps (depends_on_task_id);

-- ① 会話・質問・入口・社員（読む頻度は低いが、FK の delete 連鎖も index を使う）
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id);
create index if not exists chat_threads_work_idx    on public.chat_threads (work_id);
create index if not exists questions_thread_idx     on public.questions (thread_id);
create index if not exists questions_task_idx       on public.questions (task_id);
create index if not exists questions_promoted_idx   on public.questions (promoted_decision_id);
create index if not exists agent_skills_employee_idx on public.agent_skills (employee_id);
create index if not exists employee_settings_account_idx on public.employee_settings (account_id);
create index if not exists hire_candidates_work_idx on public.hire_candidates (work_id);
create index if not exists hire_candidates_hired_idx on public.hire_candidates (hired_employee_id);
create index if not exists deliverable_inputs_task_idx on public.deliverable_inputs (task_id);
create index if not exists diagnoses_profile_idx    on public.diagnoses (business_profile_id);
create index if not exists imported_sources_profile_idx on public.imported_sources (business_profile_id);
create index if not exists discovery_candidates_session_idx on public.discovery_candidates (session_id);
create index if not exists discovery_candidates_adopted_idx on public.discovery_candidates (adopted_work_id);

-- ② 行ごとの auth.uid() を1文1回に（意味は変えない。RLS の形もこの1本だけ）
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
