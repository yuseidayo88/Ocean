-- 用事（errand）をやめる。
--
-- 「1タスクで終わる頼みごと」を Work の外側に立てる形をやめた。
-- 小さい頼みごとは、**いまある Work の中のタスク**になる。合う Work が無いときだけ Work を提案する。
-- 器が2つ（Work / フェーズ）に減り、tasks は必ず Work に属する。

delete from tasks where kind = 'errand';   -- 本番にはまだ無いが、開発用のデータを消しておく

alter table tasks drop constraint task_kind_shape;      -- 不変条件 7 は work_id NOT NULL に置き換わる
alter table tasks alter column work_id set not null;
alter table tasks drop column kind;

-- Work の切り出し元はフェーズだけになった
alter table works drop constraint works_origin_kind_check;
alter table works drop column origin_kind;
alter table works rename column origin_id to origin_phase_id;
alter table works add constraint works_origin_phase_fk
  foreign key (origin_phase_id) references phases(id) on delete set null;

comment on column tasks.work_id is
  'すべてのタスクは Work に属する。用事（Work の外に立つ1タスク）は 0005 で廃止した';
