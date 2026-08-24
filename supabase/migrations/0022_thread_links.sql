-- チャットが入口になる（2026-08-24）。
--
-- **1チャット = 1 Work**。work_id は 0002 から既にある。
-- 足りないのは「この会話で集めた条件」と「この会話で取り込んだ事業」への紐。
-- カードの中に id を焼き込むだけだと、会話の途中で条件を足せない
-- （どの探索の続きか分からなくなる）。**スレッドが覚える。**
alter table chat_threads add column discovery_id uuid references discovery_sessions(id) on delete set null;
alter table chat_threads add column profile_id   uuid references business_profiles(id)  on delete set null;

-- ポンプもチャットも、この2列で毎回引く（FK の覆い index → 0016 と同じ理由）
create index on chat_threads (discovery_id);
create index on chat_threads (profile_id);
