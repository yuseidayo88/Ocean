-- 0033: 学びを「ルール」に上げる置き場（2026-08-26）。
--
-- 「ルールにするかは社長が決める（自動では昇格しない）」と画面に書いてあるのに、
-- **その操作がどこにも無かった**。学びは30行の上限で回り、畳まれ、いつか薄まる。
-- 社長が「これは毎回効かせたい」と思った1行を、**残る場所**へ移せるようにする。
--
-- **表を増やさない** — 学びと社長のことと同じ `agent_skills` に、
-- 4つめの出どころ `rule` として置く（`employee_id` ごとに1枚）。
alter table agent_skills drop constraint agent_skills_source_check;
alter table agent_skills add constraint agent_skills_source_check
  check (source in ('builtin', 'user', 'learned', 'agent', 'rule'));
