-- 0030: 思い出す（Hermes Agent の "cross-session recall"）。
--
-- あちらは SQLite の FTS5 ＋ LLM 要約でセッションを検索する。
-- ここは Postgres なので、**日本語で効く探し方**を選ぶ必要があった。
--
--   ・`to_tsvector` は日本語を切れない（語の境目が無い）→ 使わない
--   ・pgroonga は日本語に強いが、専用の演算子（`&@~`）が要る。
--     PostgREST から使うには `public` に関数を置くことになり、
--     **それだけでセキュリティ警告が1件増える**（0028 のときに実証済み）
--   ・`ilike '%…%'` は素の絞り込みで書けて、PostgREST からそのまま通る。
--     **pg_trgm の GIN があれば、これが index で効く**
--
-- なので pg_trgm を入れて覆いを付ける。**問い合わせ側は素の ilike のまま** —
-- 関数を置かないので、警告は0件のまま。
--
-- 拡張は `extensions` スキーマに置く（`public` に置くと、それ自体が警告になる）。

create extension if not exists pg_trgm with schema extensions;

-- 探す先は3つ — 作ったもの / 決めたこと / 会話。
-- **会社の記憶は、この3つに全部ある**（成果物の索引はタイトルしか渡していなかった）
create index if not exists deliverables_title_trgm
  on public.deliverables using gin (title extensions.gin_trgm_ops);
create index if not exists deliverables_body_trgm
  on public.deliverables using gin (body extensions.gin_trgm_ops);
create index if not exists decisions_question_trgm
  on public.decisions using gin (question extensions.gin_trgm_ops);
create index if not exists chat_messages_body_trgm
  on public.chat_messages using gin (body extensions.gin_trgm_ops);
