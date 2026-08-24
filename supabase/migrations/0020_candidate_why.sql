-- 候補の「推す理由」（3行）。summary（なぜ合うか1〜2文）とは別で、
-- 右ペインの「この案をすすめる理由」に箇条書きで出す。
-- fit（3スコア）に混ぜない — fit は数字だけ、という 0002 の注釈を守る。
alter table discovery_candidates add column why jsonb not null default '[]'::jsonb;
