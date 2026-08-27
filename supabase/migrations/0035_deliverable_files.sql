-- 成果物のファイル置き場（2026-08-27。社長の「置き場所は成果物」「ロゴ作る時は GPT の AI を」）
--
-- ここまで成果物は**文章だけ**だった。画像はバイト列なので `deliverables.body`（text）には
-- 置けない（data URI にすると1枚1.5MB が Postgres に載る）。
-- 置き場所は **`deliverables.storage_path`** — 0001 のスキーマが最初から空けていた列で、
-- ここまで一度も使われていなかった。
--
-- **新しい業者を増やさない。** 同じ Supabase プロジェクトの Storage に置く。
-- **公開しない**（private）。画面が読むのは、その都度作る署名つきURL。
--
-- **ポリシーは 28本 を1行も書き換えない。** ここで足すのは storage.objects の側で、
-- 形は同じ — 「いま入っている会社のものだけ見える」。
-- 道は `<account_id>/<deliverable_id>.<ext>`。先頭のフォルダ名が口座なので、
-- 1行めのフォルダを口座と突き合わせるだけで絞れる。

insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

-- 読む: 自分の会社のフォルダだけ
drop policy if exists "deliverables read own account" on storage.objects;
create policy "deliverables read own account" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] = private.current_account_id()::text
  );

-- 置く: 自分の会社のフォルダにだけ（実行が書く）
drop policy if exists "deliverables write own account" on storage.objects;
create policy "deliverables write own account" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] = private.current_account_id()::text
  );

-- **消す道は開けない。** 成果物は追記のみ（版が増えるだけ。決定事項と同じ考え方 → 0013 / 0021）。
-- 会社ごと消えるときは、accounts の cascade ではなく運用で片づける。
