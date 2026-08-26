-- 0032: 会社が Web を見るかどうか（社長が押す栓）。
--
-- ここまで、需要は統括AIの**記憶から**言っているだけだった。
-- 候補は自分から「まだ確かめていない」と名乗るようにしたが、
-- **本当に調べる**にはここを開けるしかない（→ `lib/ai/web.ts`）。
--
-- **既定はオフ。** 検索は従量で課金されるので、黙って有料にしない。
-- **表を増やさない** — 会社ぜんぶに効く設定なので、`agent_prefs` の
-- 統括AIの行（`employee_id` が null）に持つ（スキル・設定と同じ書き方）。
alter table public.agent_prefs add column if not exists web boolean not null default false;
