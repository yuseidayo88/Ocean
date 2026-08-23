-- 並びを決定的にする。
--
-- `questions` と `tasks` は **1本の insert 文でまとめて入る**ので、
-- `created_at`（＝トランザクション開始時刻）が**全行同じ**になる。
-- それを `order by created_at` で並べていたので、順番は出たとこ勝負だった。
--   ・`answer(work, index)` が**別の質問に答えを書き込みうる**
--   ・Work 画面の「いま動いているもの」の順が読み込むたびに変わりうる
-- （実測: 同じ文で入れた質問3件の created_at の種類数 = 1）
--
-- フェーズには最初から `seq` がある。質問とタスクにも同じものを置く。

alter table questions add column seq integer not null default 0;
alter table tasks     add column seq integer not null default 0;

-- すでに入っている行は、いまの並び（created_at → id）で番号を振る
update questions q set seq = x.n from (
  select id, row_number() over (partition by work_id order by created_at, id) as n from questions
) x where q.id = x.id;

update tasks t set seq = x.n from (
  select id, row_number() over (partition by work_id order by created_at, id) as n from tasks
) x where t.id = x.id;

create index if not exists questions_work_seq on questions (work_id, seq);
create index if not exists tasks_work_seq on tasks (work_id, seq);

comment on column questions.seq is
  '統括AIが聞いた順。1始まり。created_at は同じ insert 文で同着になるので当てにしない';
comment on column tasks.seq is
  'そのフェーズの中での順。1始まり。created_at は同着になるので当てにしない';
