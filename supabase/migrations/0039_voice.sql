-- 0039: 会社が声を出すかどうか（社長が押す栓）と、どの声で読むか。
--
-- 2026-08-27。社長の「他のやつから順にお願いします」の④。
--
-- 名簿には台本を書く人（執筆担当）はいるが、**読み上げる手が無かった** —
-- 動画のナレーションも、聞ける説明も、社長が自分で吹き込むしかない。
--
-- **絵（0036）とまったく同じ作法にする** —
--   ・**既定はオフ。** 声も従量で課金される。黙って有料にしない
--   ・**社長が押す。** メンバー画面の「全員に効くこと」から入り切りする
--   ・**表を増やさない。** 会社ぜんぶに効く設定なので `agent_prefs` の
--     統括AIの行（`employee_id` が null）に持つ
--
-- モデルは会社に1つ（読み上げるのは執筆担当だけなので、8人ぶんの設定にしない）。
-- 名前は `lib/ai/catalog.ts` の `VOICE_MODELS` の `id`。**知らない名前は既定に落ちる。**
alter table public.agent_prefs add column if not exists voice boolean not null default false;
alter table public.agent_prefs add column if not exists voice_model text;
