-- 0015: 「1つしか無いはず」をDBでも守る（進捗・台帳と同じ姿勢）。
-- アプリ側の「あったら書かない」は、同時に来ると両方すり抜ける（check-then-act）。

-- 朝の報告は1日1通。タブが2つ同時に開いても、2通目は 23505 で止まる
create unique index if not exists notifications_morning_daily
  on public.notifications (account_id, group_key)
  where group_key like 'morning-%';

-- 在籍は定義ごとに1人。「採用する」を同時に押しても、調査担当は2人にならない
-- （retired は除く — 辞めさせてからの再採用はできる）
create unique index if not exists employees_one_per_definition
  on public.employees (account_id, definition_id)
  where status <> 'retired';
