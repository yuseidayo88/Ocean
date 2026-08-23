-- 実行（Phase 7）の書き込み路。
--
-- 方針: **service role は持たない。** 実行は社長のセッション（authenticated）の中で走り、
-- 行は全部 RLS で自分の会社に絞られる。裏方の値（進捗・完了時の100%）は
-- 引き金が導出する — アプリが直接書けない設計（0003 の tasks_progress_is_derived）を守る。

-- ① run_steps に書けるようにする（いままで SELECT だけだった）。
--    RLS はテナントの一形なので、開けるのは自分の会社のぶんだけ
grant insert on run_steps to authenticated;

-- ② 工程の自己申告の進捗。**社員（モデル）が言った値**で、実測ではない。
--    それでも「何も無いのに 74%」よりは正直 — 出どころが run_steps に1行ずつ残る
alter table run_steps add column progress integer
  check (progress is null or (progress >= 0 and progress <= 100));

comment on column run_steps.progress is
  '社員の自己申告の進捗（0-100）。log_step 道具の引数。tasks.progress はここから導出される';

-- ③ 進捗の導出。run_steps が入るたび、親タスクの progress を写す。
--    tasks_progress_is_derived が直接の書き込みを塞いでいるので、
--    引き金の中でだけ backend の旗を立てる
create or replace function private.run_step_progress() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.progress is not null then
    perform set_config('onefound.backend', 'on', true);
    update tasks set progress = new.progress
      where id = (select task_id from runs where id = new.run_id)
        and status = 'running';
    perform set_config('onefound.backend', 'off', true);
  end if;
  return null;
end $$;

drop trigger if exists run_step_progress on run_steps;
create trigger run_step_progress after insert on run_steps
  for each row execute function private.run_step_progress();

-- ④ 実行が終わったら、タスクの進捗を閉じる（done なら 100）。
--    タスクの status はアプリが書く（queued→running→done は守るものが無い）が、
--    progress だけはここでしか動かない
create or replace function private.run_finish_progress() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'done' and old.status is distinct from new.status then
    perform set_config('onefound.backend', 'on', true);
    update tasks set progress = 100 where id = new.task_id;
    perform set_config('onefound.backend', 'off', true);
  end if;
  return null;
end $$;

drop trigger if exists run_finish_progress on runs;
create trigger run_finish_progress after update on runs
  for each row execute function private.run_finish_progress();

-- ⑤ 成果物の中身の置き場。設計の行き先は R2（storage_path）だが、
--    デプロイに CLOUDFLARE_API_TOKEN が要るのでまだ出られない。
--    それまで **markdown を DB に置く**（1件 100KB もいかない。R2 に移すとき列ごと落とす）
alter table deliverables add column body text;

comment on column deliverables.body is
  '成果物の本文（markdown）。R2 に移すまでの置き場。preview は先頭の書き出し数行';
