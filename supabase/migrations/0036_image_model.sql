-- 0036: 会社が絵を描くかどうか（社長が押す栓）と、どのモデルで描くか。
--
-- 2026-08-27。社長の「ロゴ作る時は GPT の AI 使うようにしようかな あと Nano Banana とか」。
--
-- ここまで名簿は**全員が文章を書く人**だったので、「ロゴを作りたい」と言われても
-- 出てくるのはロゴの**説明**だった（実測でそうなった）。デザイン担当を足して、
-- 実際に1枚出せるようにする。
--
-- **Web検索（0032）とまったく同じ作法にする** —
--   ・**既定はオフ。** 画像は従量で課金される。黙って有料にしない
--   ・**社長が押す。** メンバー画面の「全員に効くこと」から入り切りする
--   ・**表を増やさない。** 会社ぜんぶに効く設定なので `agent_prefs` の
--     統括AIの行（`employee_id` が null）に持つ
--
-- モデルは会社に1つ（絵を描くのはデザイン担当だけなので、7人ぶんの設定にしない）。
-- 名前は `lib/ai/catalog.ts` の `IMAGE_MODELS` の `id`。**知らない名前は既定に落ちる。**
alter table public.agent_prefs add column if not exists images boolean not null default false;
alter table public.agent_prefs add column if not exists image_model text;
