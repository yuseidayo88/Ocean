-- 統括AIが言った担当を捨てない。
--
-- `draft_plan` の `first_phase_tasks[].owner_hint` は「このタスクは誰がやるか」の提案だが、
-- どこにも保存していなかった。結果:
--   ・計画画面は **最初のタスクの** owner_hint を「そのフェーズの担当」として出す
--   ・承認は **フェーズ1の全タスクを crew[0]** に割り当てる
-- 画面とデータベースが、同じことについて別々の推測をしていた。
--
-- ここに置いておけば、承認のときに名前で引き当てられる。
-- **社員そのものではなく「言われた名前」を持つ**（採用前なので employees の行はまだ無い）。

alter table tasks add column owner_hint text;

comment on column tasks.owner_hint is
  '統括AIが提案した担当の表示名。採用のあと display_name で引き当てて assignee に写す。
   割り当て済みなら assignee_employee_id のほうが真実';
