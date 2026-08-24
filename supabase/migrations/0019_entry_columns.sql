-- 入口（Case B / D）の統括AI接続で要る3列。
--
-- ・diagnoses.facts — 診断の数字の帯（ラベル→数字→補足）。
--   findings は「見つかったこと」の配列のまま（0002 の注釈どおり）。混ぜない
-- ・is_real — 決め打ちのプロバイダ（鍵の無い環境）で作ったものに
--   「仮」と出すための印。計画の real（plan_draft の中）と同じ思想 —
--   偽物と本物を画面で混ぜない
alter table diagnoses          add column facts   jsonb   not null default '[]'::jsonb;
alter table diagnoses          add column is_real boolean not null default true;
alter table discovery_sessions add column is_real boolean not null default true;
