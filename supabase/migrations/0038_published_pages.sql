-- 0038: 公開したページ（2026-08-27。社長の「他のやつから順に」の③）。
--
-- AI社員は LP を書ける（`page` の成果物）。でも**出し先がなかった** —
-- 書いたものはアプリの中にしかなく、⬇ で落として自分でどこかに上げるしかない。
-- 一人社長にそれをやらせるなら、**作れたことに意味がない**。
--
-- 出し先は**このアプリ自身**（`/p/<slug>`）。外の業者の鍵を待たないので、いま動く。
--
-- ## この表だけ、誰でも読める
--
-- ほかの28本のポリシーは全部 `account_id = private.current_account_id()` だが、
-- **ここは公開したものを置く場所**なので、そこを守っても意味がない
-- （守ったら、公開したページが誰にも見えない）。
--
-- そのかわり:
--   ・入るのは**社長が押したときだけ**（外に出る道具は Approval 必須）
--   ・入るのは**承認済の成果物だけ**（コード側 `whyNot` で止める）
--   ・**やめれば消える**（`revoked_at` が入った行は、公開の側からは読めない）
--   ・slug に**短い符号**を足すので、隣の会社の `/p/lp` を当てずっぽうで開けない
--
-- **公開したページは、URL を知らない人にも見つかりうる**（この表を読めば並ぶ）。
-- 公開とはそういうことなので、画面でもそう言う — **黙って「秘密の URL」だと思わせない**。

create table published_pages (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null default private.current_account_id()
                 references accounts(id) on delete cascade,
  -- どの成果物を出したか。成果物が消えたら公開も消える
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  -- 行き先の名前。**題から作り、後ろに短い符号**（`lib/deliver/publish.ts` の `slugOf`）
  slug           text not null unique,
  title          text not null,
  -- **押した時点の中身**（script を落としたもの）。あとから直しても勝手には変わらない
  html           text not null,
  -- 落としたものの名前（社長に「何を消したか」を言うため）
  removed        text[] not null default '{}',
  published_at   timestamptz not null default now(),
  -- 公開をやめた時刻。**行は消さない**（いつ出して、いつ下げたかが台帳になる）
  revoked_at     timestamptz
);

-- **1つの成果物につき1枚**（二度押し・同時押しで2枚にならない。0015 / 0017 と同じ姿勢）。
-- もう一度公開すると、この行が入れ替わる
create unique index published_pages_once on published_pages (account_id, deliverable_id);
-- 公開の側は slug で1行だけ引く
create index on published_pages (slug) where revoked_at is null;

alter table published_pages enable row level security;
alter table published_pages force row level security;

-- ① **公開したものは誰でも読める。** これがこの表の目的
create policy published_pages_public on published_pages for select
  to anon, authenticated
  using (revoked_at is null);

-- ② 自分の会社のものは、下げたあとも読める（いつ出していたかが分かる）
create policy published_pages_own on published_pages for select
  to authenticated
  using (account_id = private.current_account_id());

-- ③ 書けるのは自分の会社のものだけ。**ここは 0003 と同じ一形**
create policy published_pages_write on published_pages for insert
  to authenticated
  with check (account_id = private.current_account_id());
create policy published_pages_edit on published_pages for update
  to authenticated
  using (account_id = private.current_account_id())
  with check (account_id = private.current_account_id());

grant select on published_pages to anon;
grant select, insert, update on published_pages to authenticated;
-- **消す口は開けない。** 下げるのは `revoked_at` で、出した記録は残る
